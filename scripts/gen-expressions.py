# ペットの表情差分を生成する（Issue #2 の素材運用）。
#
#   python3 scripts/gen-expressions.py gen public/pets/*/normal.png --expr happy
#   python3 scripts/gen-expressions.py sheet public/pets/*/normal.png --out docs/design/pets-expressions.png
#
# 汎用版は ~/.claude/skills/pixel-expressions/（他プロジェクトでも使えるスキル）。
# 自動生成が SKIP されたキャラは `map` で座標を読んで `edit` で手作りする。
# 素材の追加・差し替え手順は public/pets/README.md を参照。

import sys, os, zlib, struct, argparse
from math import gcd

DARK_DEFAULT = (23, 23, 27)


# ---------------------------------------------------------------------------
# PNG 入出力（標準ライブラリのみ）
# ---------------------------------------------------------------------------

def read_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"PNGではありません: {path}")
    pos, idat, w, h, depth, ctype = 8, b"", 0, 0, 0, 0
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if tag == b"IHDR":
            w, h, depth, ctype = struct.unpack(">IIBB", chunk[:10])
        elif tag == b"IDAT":
            idat += chunk
        pos += 12 + ln
    if depth != 8:
        raise ValueError(f"8bit深度のみ対応（この画像は{depth}bit）: {path}")
    raw = zlib.decompress(idat)
    ch = {0: 1, 2: 3, 4: 2, 6: 4}.get(ctype)
    if ch is None:
        raise ValueError(f"未対応のカラータイプ{ctype}（パレットPNGは事前にRGBA変換が必要）: {path}")
    stride = w * ch
    rows, prev, p = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b, c = prev[i], (prev[i - ch] if i >= ch else 0)
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        rows.append(bytes(line)); prev = line
    px = []
    for row in rows:
        r = []
        for x in range(w):
            o = x * ch
            if ch == 4:
                r.append((row[o], row[o + 1], row[o + 2], row[o + 3]))
            elif ch == 3:
                r.append((row[o], row[o + 1], row[o + 2], 255))
            elif ch == 2:
                r.append((row[o], row[o], row[o], row[o + 1]))
            else:
                r.append((row[o], row[o], row[o], 255))
        px.append(r)
    return w, h, px


def write_png(path, w, h, px):
    raw = b""
    for row in px:
        raw += b"\x00" + b"".join(struct.pack("4B", *p) for p in row)
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))
    open(path, "wb").write(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


# ---------------------------------------------------------------------------
# ドットグリッド化
# ---------------------------------------------------------------------------

def detect_block(px, w, h):
    """同色ランの長さのGCDから「1ドット＝何ピクセルか」を推定"""
    g = 0
    for y in range(0, h, max(1, h // 40)):
        run, prev = 0, None
        for x in range(w):
            c = px[y][x]
            if c == prev:
                run += 1
            else:
                if prev is not None:
                    g = gcd(g, run)
                run, prev = 1, c
        g = gcd(g, run)
    return max(1, g)


class Sprite:
    def __init__(self, path, dark=DARK_DEFAULT, block=None):
        self.path = path
        self.w, self.h, self.px = read_png(path)
        self.b = block or detect_block(self.px, self.w, self.h)
        self.gw, self.gh = self.w // self.b, self.h // self.b
        self.dark = dark
        self.cells = [
            [self.px[y * self.b + self.b // 2][x * self.b + self.b // 2] for x in range(self.gw)]
            for y in range(self.gh)
        ]
        self.out = [list(r) for r in self.px]
        self.touched = set()   # 実際に書き換えたセル（安全確認に使う）

    def is_dark(self, c):
        return c[3] > 128 and max(abs(c[i] - self.dark[i]) for i in range(3)) < 45

    def solid(self, x, y):
        return 0 <= x < self.gw and 0 <= y < self.gh and self.cells[y][x][3] > 128

    def body(self, x, y):
        """不透明かつ暗色でない＝顔の地の部分（白目・肌・体色）"""
        return self.solid(x, y) and not self.is_dark(self.cells[y][x])

    def copy_from(self, dst, src):
        dx, dy = dst; sx, sy = src
        for j in range(self.b):
            for i in range(self.b):
                self.out[dy * self.b + j][dx * self.b + i] = self.px[sy * self.b + j][sx * self.b + i]

    def erase(self, x, y):
        """隣接する地の色ブロックで塗りつぶす（白目や体色をそのまま複製）"""
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1), (0, -2), (0, 2), (-2, 0), (2, 0)):
            if self.body(x + dx, y + dy):
                self.copy_from((x, y), (x + dx, y + dy))
                self.touched.add((x, y))
                return True
        return False

    def paint(self, x, y):
        if not self.solid(x, y):
            return False
        for j in range(self.b):
            for i in range(self.b):
                self.out[y * self.b + j][x * self.b + i] = (*self.dark, 255)
        self.touched.add((x, y))
        return True

    def eye_style(self, seg, y):
        """目の構造を見分ける。
        'pupil' = 白目の中の黒目（左右に地の色がある）→ 消しても目は残る
        'bar'   = 塗りつぶしの黒棒だけ → 消すと目そのものが消滅するので動かして表現する
        """
        left_ok = self.body(seg[0] - 1, y)
        right_ok = self.body(seg[-1] + 1, y)
        return "pupil" if (left_ok and right_ok) else "bar"

    def check_detection(self):
        """検出結果が信用できるか判定する。生成前に必ず通す。
        自動検出は「顔でないもの」を顔と誤認することがあり、そのまま描くと
        作者の絵に黒い塊や穴を作ってしまう。怪しいときは作らない方が安全。"""
        eyes, mouth = self.features()
        if not eyes:
            return False, "目を検出できない"
        rows = sorted(set(y for y, _, _ in eyes))
        if rows[-1] - rows[0] > 2:
            return False, f"目の検出行が散らばりすぎ（{rows}）＝顔以外を拾っている疑い"
        if mouth and mouth[0] - rows[-1] > 4:
            return False, f"口が目から離れすぎ（目{rows[-1]}行/口{mouth[0]}行）"
        return True, ""

    def verify_edits(self):
        """書き換えたセルが顔の範囲に収まっているかを検算する。
        範囲外を触っていたら、それは検出ミスで別のパーツを壊している。"""
        if not self.touched:
            return False, "何も書き換えられなかった"
        eyes, mouth = self.features()
        rows = [y for y, _, _ in eyes]
        lo, hi = min(rows) - 1, max(rows) + 1
        if mouth:
            hi = max(hi, mouth[0] + 1)
        stray = [(x, y) for x, y in self.touched if not (lo <= y <= hi)]
        if stray:
            return False, f"顔の範囲({lo}〜{hi}行)の外を書き換えた: {sorted(stray)[:4]}"
        return True, ""

    def save(self, path):
        write_png(path, self.w, self.h, self.out)

    # --- 解析 ---
    def inner_dark(self):
        """輪郭線を除いた内側の暗色セル＝顔パーツ候補"""
        parts = set()
        for y in range(self.gh):
            xs = [x for x in range(self.gw) if self.solid(x, y)]
            if len(xs) < 4:
                continue
            lo, hi = min(xs), max(xs)
            for x in range(lo + 2, hi - 1):
                if not self.is_dark(self.cells[y][x]):
                    continue
                if self.body(x, y - 1) or self.body(x, y + 1):
                    parts.add((x, y))
        return parts

    def features(self):
        """目（左右対のセグメント）と口（中央をまたぐ横長セグメント）を返す"""
        rows = {}
        for x, y in self.inner_dark():
            rows.setdefault(y, []).append(x)
        mid = (self.gw - 1) / 2
        eyes, mouths = [], []
        for y in sorted(rows):
            segs = _segments(rows[y])
            left = [s for s in segs if max(s) < mid]
            right = [s for s in segs if min(s) > mid]
            spans = [s for s in segs if min(s) <= mid <= max(s)]
            if left and right and not spans and y < self.gh * 0.72:
                eyes.append((y, left[-1], right[0]))
            elif len(segs) == 1 and spans and len(segs[0]) >= 3:
                # 顔幅いっぱいに伸びる横線は口ではなく装飾の帯（箱のフタ・ラベル等）。
                # 口として扱うと、帯の一部を持ち上げて絵に黒い塊を作ってしまう。
                width_at_row = len([x for x in range(self.gw) if self.solid(x, y)])
                if len(segs[0]) <= width_at_row * 0.7:
                    mouths.append((y, segs[0]))
        if eyes:
            last = max(y for y, _, _ in eyes)
            # 口は目のすぐ下（4行以内）。離れた横縞は装飾なので拾わない
            mouths = [m for m in mouths if last < m[0] <= last + 4]
        return eyes, (mouths[0] if mouths else None)


def _segments(xs):
    xs = sorted(set(xs))
    segs, cur = [], [xs[0]]
    for x in xs[1:]:
        if x == cur[-1] + 1:
            cur.append(x)
        else:
            segs.append(cur); cur = [x]
    segs.append(cur)
    return segs


# ---------------------------------------------------------------------------
# 表情の変形レシピ
# ---------------------------------------------------------------------------

def apply_expression(sp, expr):
    """表情ごとの変形。戻り値: 変更内容の説明リスト（空なら検出失敗）"""
    eyes, mouth = sp.features()
    log = []

    if expr == "happy":
        # 目を細める（黒目の上端を消す）／1行しかない目は1段下げて伏し目に
        if len(eyes) >= 2:
            y, l, r = eyes[0]
            for x in l + r:
                if sp.erase(x, y):
                    log.append(f"eye_slim({x},{y})")
        elif len(eyes) == 1:
            y, l, r = eyes[0]
            if all(sp.body(x, y + 1) for x in l + r):
                for x in l + r:
                    sp.erase(x, y)
                for x in l + r:
                    sp.paint(x, y + 1)
                log.append(f"eyes_down@{y}")
        # 口角を上げる（◡ = 両端が上・中央が下）
        if mouth:
            my, seg = mouth
            if sp.body(seg[0], my - 1) and sp.body(seg[-1], my - 1):
                for x in (seg[0], seg[-1]):
                    sp.erase(x, my); sp.paint(x, my - 1)
                log.append(f"smile^({seg[0]}-{seg[-1]}@{my})")
            elif sp.body(seg[len(seg) // 2], my + 1):
                for x in seg[1:-1]:
                    if sp.body(x, my + 1):
                        sp.paint(x, my + 1)
                log.append(f"smile_v({seg[0]}-{seg[-1]}@{my})")

    elif expr == "sad":
        # 目を下げ、口角を下げる（⌒）
        if eyes:
            y, l, r = eyes[-1]
            if all(sp.body(x, y + 1) for x in l + r):
                for x in l + r:
                    sp.erase(x, y)
                for x in l + r:
                    sp.paint(x, y + 1)
                log.append(f"eyes_down@{y}")
        if mouth:
            my, seg = mouth
            if sp.body(seg[0], my + 1) and sp.body(seg[-1], my + 1):
                for x in (seg[0], seg[-1]):
                    sp.erase(x, my); sp.paint(x, my + 1)
                log.append(f"frown({seg[0]}-{seg[-1]}@{my})")

    elif expr == "sleep":
        # 目を閉じる。目の構造によって作り方が変わる:
        #  pupil（白目の中の黒目）… 黒目を消して白目の中央に横一文字を引く
        #  bar  （塗りつぶしの黒棒）… 消すと目が消滅するので、1段下げて左右に広げる
        #        （開いた目との差が出るように幅を変えるのがポイント）
        if eyes:
            y0, l0, r0 = eyes[0]
            style = sp.eye_style(l0, y0)
            if style == "pupil" and len(eyes) >= 2:
                rows = sorted(set(y for y, _, _ in eyes))
                base = rows[len(rows) // 2]
                for y, l, r in eyes:
                    for x in l + r:
                        sp.erase(x, y)
                for _, l, r in eyes:
                    for x in l + r:
                        sp.paint(x, base)
                log.append(f"eyes_closed@{base}")
            else:
                y, l, r = eyes[-1]
                if all(sp.body(x, y + 1) for x in l + r):
                    for x in l + r:
                        sp.erase(x, y)
                    for seg in (l, r):
                        wide = [seg[0] - 1] + seg + [seg[-1] + 1]
                        for x in wide:
                            if sp.body(x, y + 1) or x in seg:
                                sp.paint(x, y + 1)
                    log.append(f"eyes_closed_wide@{y + 1}")
        if mouth:
            my, seg = mouth
            if len(seg) >= 4:
                for x in (seg[0], seg[-1]):
                    sp.erase(x, my)
                log.append(f"mouth_small@{my}")

    elif expr == "surprise":
        # 目を縦に広げ、口を丸く開く
        if eyes:
            y, l, r = eyes[0]
            for x in l + r:
                if sp.body(x, y - 1):
                    sp.paint(x, y - 1)
            log.append(f"eyes_wide@{y}")
        if mouth:
            my, seg = mouth
            cx = seg[len(seg) // 2]
            for x in seg:
                if x not in (cx, cx - 1) and sp.body(x, my):
                    sp.erase(x, my)
            if sp.body(cx, my + 1):
                sp.paint(cx, my + 1)
                if sp.body(cx - 1, my + 1):
                    sp.paint(cx - 1, my + 1)
            log.append(f"mouth_open@{my}")

    else:
        raise SystemExit(f"未知の表情: {expr}")

    return log


# ---------------------------------------------------------------------------
# サブコマンド
# ---------------------------------------------------------------------------

def cmd_map(args):
    for path in args.files:
        sp = Sprite(path, block=args.block)
        parts = sp.inner_dark()
        eyes, mouth = sp.features()
        print(f"== {path}")
        print(f"   {sp.w}x{sp.h}px / 1ドット={sp.b}px / グリッド {sp.gw}x{sp.gh}")
        print("   凡例: '.'=透明 'K'=暗色(輪郭) '@'=顔パーツ候補 'B'=地の色")
        print("      " + "".join(str(x % 10) for x in range(sp.gw)))
        for y in range(sp.gh):
            line = ""
            for x in range(sp.gw):
                c = sp.cells[y][x]
                if c[3] < 128:
                    line += "."
                elif (x, y) in parts:
                    line += "@"
                elif sp.is_dark(c):
                    line += "K"
                else:
                    line += "B"
            print(f"   {y:>2} {line}")
        print(f"   検出 → 目: {[(y, l, r) for y, l, r in eyes] or 'なし'}")
        print(f"          口: {mouth or 'なし'}")


def cmd_gen(args):
    """生成の前後で2回チェックする。自動検出は顔以外を顔と誤認することがあり、
    そのまま書き出すと作者の絵に黒い塊や穴が残る。壊れた差分を出すくらいなら
    作らずに手作業（edit）へ回した方が良い、という方針。"""
    ok, skipped = 0, []
    for path in args.files:
        out = args.out or path.replace("normal", args.expr)
        if out == path:
            base, ext = os.path.splitext(path)
            out = f"{base}-{args.expr}{ext}"
        sp = Sprite(path, block=args.block)
        label = os.path.basename(os.path.dirname(path)) or os.path.basename(path)

        trusted, why = sp.check_detection()
        if not trusted and not args.force:
            print(f"SKIP {label:<18} 検出が怪しい: {why}")
            skipped.append(label)
            continue

        log = apply_expression(sp, args.expr)
        if not log:
            print(f"SKIP {label:<18} 変形できる目・口が見つからない")
            skipped.append(label)
            continue

        safe, problem = sp.verify_edits()
        if not safe and not args.force:
            print(f"SKIP {label:<18} 検算で不正: {problem}")
            skipped.append(label)
            continue

        sp.save(out)
        ok += 1
        print(f"OK   {label:<18} {' '.join(log)}")

    print(f"-- {ok}/{len(args.files)} 件生成")
    if skipped:
        print(f"-- 手作業が必要: {', '.join(skipped)}")
        print("   `map` で目・口の座標を読み、`edit --erase/--paint` で描き換えること")


def cmd_edit(args):
    """例: edit in.png out.png --erase 3,4 4,4 --paint 3,5 4,5"""
    sp = Sprite(args.src, block=args.block)
    def coords(vals):
        return [tuple(int(v) for v in s.split(",")) for s in (vals or [])]
    for x, y in coords(args.erase):
        print(("erase" if sp.erase(x, y) else "erase失敗(地の色が隣にない)") + f" ({x},{y})")
    for x, y in coords(args.paint):
        print(("paint" if sp.paint(x, y) else "paint失敗(透明部分)") + f" ({x},{y})")
    sp.save(args.dst)
    print(f"→ {args.dst}")


def cmd_sheet(args):
    cell, pad, cols = args.cell, 8, args.cols
    pairs = []
    for a in args.pairs:
        if ":" in a:
            n, h = a.split(":", 1)
        else:
            n, h = a, a.replace("normal", args.expr)
        pairs.append((n, h))
    per = cell * 2 + pad
    rows_n = (len(pairs) + cols - 1) // cols
    W, H = cols * per + pad, rows_n * (cell + pad) + pad
    canvas = [[(215, 231, 244, 255)] * W for _ in range(H)]
    for idx, (a, b) in enumerate(pairs):
        ox = pad + (idx % cols) * per
        oy = pad + (idx // cols) * (cell + pad)
        for k, p in enumerate((a, b)):
            if not os.path.exists(p):
                continue
            w, h, px = read_png(p)
            sc = min(cell / w, cell / h)
            for y in range(cell):
                for x in range(cell):
                    sx, sy = int(x / sc), int(y / sc)
                    if sx >= w or sy >= h:
                        continue
                    c = px[sy][sx]
                    if c[3] < 128:
                        continue
                    canvas[oy + y][ox + k * cell + x] = (c[0], c[1], c[2], 255)
    write_png(args.out, W, H, canvas)
    print(f"シート: {args.out} ({W}x{H}) {len(pairs)}組 — 必ず目で見て確認すること")


def main():
    ap = argparse.ArgumentParser(description="ドット絵PNGの表情差分ツール")
    ap.add_argument("--block", type=int, help="1ドットのピクセル数（通常は自動検出）")
    sub = ap.add_subparsers(dest="cmd", required=True)

    m = sub.add_parser("map", help="ドットグリッドをASCII表示")
    m.add_argument("files", nargs="+")
    m.set_defaults(func=cmd_map)

    g = sub.add_parser("gen", help="表情差分を自動生成")
    g.add_argument("files", nargs="+")
    g.add_argument("--expr", default="happy", choices=["happy", "sad", "sleep", "surprise"])
    g.add_argument("--out", help="出力パス（1ファイル時のみ）")
    g.add_argument("--force", action="store_true",
                   help="安全チェックを無視して出力する（結果は必ず目で確認すること）")
    g.set_defaults(func=cmd_gen)

    e = sub.add_parser("edit", help="セル座標を指定して手で描き換える")
    e.add_argument("src"); e.add_argument("dst")
    e.add_argument("--erase", nargs="*", metavar="X,Y")
    e.add_argument("--paint", nargs="*", metavar="X,Y")
    e.set_defaults(func=cmd_edit)

    s = sub.add_parser("sheet", help="before/after 確認シート")
    s.add_argument("pairs", nargs="+", metavar="NORMAL[:VARIANT]")
    s.add_argument("--out", default="expressions-sheet.png")
    s.add_argument("--expr", default="happy")
    s.add_argument("--cols", type=int, default=3,
                   help="横に並べる組数（少ないほど1体が大きく写る・既定3）")
    s.add_argument("--cell", type=int, default=224,
                   help="1体あたりの表示px（小さすぎると破損を見逃す・既定224）")
    s.set_defaults(func=cmd_sheet)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
