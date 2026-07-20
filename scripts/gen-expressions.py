# 手描きドット絵PNGから表情差分（happy）を生成する。
#
# 使い方:
#   python3 scripts/gen-expressions.py public/pets/*/normal.png     # 差分生成
#   python3 scripts/gen-expressions.py --sheet docs/design/pets-expressions.png  # 確認シート
#
# 仕組み: PNGを自前デコード → ブロックサイズ（1ドットの画素数）を自動検出して
# ドットグリッドに量子化 → 輪郭を除いた内側のダークセルから目・口を検出 →
#   目: 黒目の上端を消して細める（1行しかない目は1段下げて伏し目に）
#   口: 横一文字の両端を1段上げて口角を上げる（◡）
# 色はブロック単位でコピーするので、元絵のグラデや質感を壊さない。
#
# 素材の追加・差し替えの手順は public/pets/README.md を参照。
import sys, zlib, struct, os
from math import gcd


def read_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, idat, w, h, bitdepth, colortype = 8, b"", 0, 0, 0, 0
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos+4])[0]
        tag = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if tag == b"IHDR":
            w, h, bitdepth, colortype = struct.unpack(">IIBB", chunk[:10])
        elif tag == b"IDAT":
            idat += chunk
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1, 2:3, 3:1, 4:2, 6:4}[colortype]
    assert bitdepth == 8, f"bitdepth {bitdepth}"
    stride = w * ch
    out, prev = [], bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(ch, stride): line[i] = (line[i] + line[i-ch]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                b = prev[i]
                c = prev[i-ch] if i >= ch else 0
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out.append(bytes(line)); prev = line
    return w, h, ch, out

def pixels(path):
    w, h, ch, rows = read_png(path)
    px = []
    for row in rows:
        r = []
        for x in range(w):
            o = x*ch
            if ch == 4: r.append((row[o], row[o+1], row[o+2], row[o+3]))
            elif ch == 3: r.append((row[o], row[o+1], row[o+2], 255))
            else: r.append((row[o], row[o], row[o], 255))
        px.append(r)
    return w, h, px

def detect_block(px, w, h):
    # 水平方向の同色ラン長のGCDでブロックサイズを推定
    from math import gcd
    g = 0
    for y in range(0, h, 3):
        run, prev = 0, None
        for x in range(w):
            c = px[y][x]
            if c == prev: run += 1
            else:
                if prev is not None: g = gcd(g, run)
                run, prev = 1, c
        g = gcd(g, run)
    return g


DARK = (23, 23, 27)
VERBOSE = False

def is_dark(c):
    return c[3] > 128 and max(abs(c[i] - DARK[i]) for i in range(3)) < 45

def load(path):
    w, h, px = pixels(path)
    b = detect_block(px, w, h)
    gw, gh = w // b, h // b
    cells = [[px[y * b + b // 2][x * b + b // 2] for x in range(gw)] for y in range(gh)]
    return px, w, h, b, gw, gh, cells

def inner_dark(cells, gw, gh):
    """輪郭を除いた内側のダークセル（顔パーツ候補）"""
    parts = set()
    for y in range(gh):
        xs = [x for x in range(gw) if cells[y][x][3] > 128]
        if len(xs) < 4:
            continue
        lo, hi = min(xs), max(xs)
        for x in range(lo + 2, hi - 1):
            if not is_dark(cells[y][x]):
                continue
            up = cells[y - 1][x] if y > 0 else (0, 0, 0, 0)
            dn = cells[y + 1][x] if y < gh - 1 else (0, 0, 0, 0)
            if (up[3] > 128 and not is_dark(up)) or (dn[3] > 128 and not is_dark(dn)):
                parts.add((x, y))
    return parts

def segments(xs):
    xs = sorted(xs)
    segs, cur = [], [xs[0]]
    for x in xs[1:]:
        if x == cur[-1] + 1:
            cur.append(x)
        else:
            segs.append(cur)
            cur = [x]
    segs.append(cur)
    return segs

def find_features(parts, gw, gh):
    """目（左右対のセグメント群）と口（中央をまたぐ横長セグメント）"""
    rows = {}
    for x, y in parts:
        rows.setdefault(y, []).append(x)
    mid = (gw - 1) / 2
    eye_rows, mouths = [], []
    for y in sorted(rows):
        segs = segments(rows[y])
        left = [s for s in segs if max(s) < mid]
        right = [s for s in segs if min(s) > mid]
        spans = [s for s in segs if min(s) <= mid <= max(s)]
        if left and right and not spans and y < gh * 0.72:
            eye_rows.append((y, left[-1], right[0]))
        elif len(segs) == 1 and spans and len(segs[0]) >= 3:
            mouths.append((y, segs[0]))
    if eye_rows:
        # 口は目のすぐ下（4行以内）にあるものだけ。装飾の横縞を誤検出しないため
        last_eye = max(y for y, _, _ in eye_rows)
        mouths = [m for m in mouths if last_eye < m[0] <= last_eye + 4]
    return eye_rows, (mouths[0] if mouths else None)

def make_happy(path, out_path):
    px, w, h, b, gw, gh, cells = load(path)
    eye_rows, mouth = find_features(inner_dark(cells, gw, gh), gw, gh)
    out = [list(r) for r in px]
    changes = []

    def copy_block(dst, src):
        (dx_, dy_), (sx, sy) = dst, src
        for j in range(b):
            for i in range(b):
                out[dy_ * b + j][dx_ * b + i] = px[sy * b + j][sx * b + i]

    def fill_dark(gx, gy):
        for j in range(b):
            for i in range(b):
                out[gy * b + j][gx * b + i] = (*DARK, 255)

    def erase(gx, gy):
        """非ダークの隣接ブロック（白目・体色）で埋める。無ければ何もしない"""
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1), (0, -2), (0, 2)):
            nx, ny = gx + dx, gy + dy
            if 0 <= nx < gw and 0 <= ny < gh:
                c = cells[ny][nx]
                if c[3] > 128 and not is_dark(c):
                    copy_block((gx, gy), (nx, ny))
                    return True
        return False

    # --- 目: 黒目の最上行を消して細める（2行以上あるときだけ） ---
    if len(eye_rows) >= 2:
        top = eye_rows[0]
        for seg in (top[1], top[2]):
            for x in seg:
                if erase(x, top[0]):
                    changes.append(f"eye({x},{top[0]})")
    elif len(eye_rows) == 1:
        # 1行しかない目は1段下げて伏し目（やわらかい笑み）にする
        y, lseg, rseg = eye_rows[0]
        can_drop = all(
            y + 1 < gh and cells[y + 1][x][3] > 128 and not is_dark(cells[y + 1][x])
            for x in lseg + rseg
        )
        if can_drop:
            for x in lseg + rseg:
                erase(x, y)
            for x in lseg + rseg:
                fill_dark(x, y + 1)
            changes.append(f"eyes_down@{y}")
        else:
            for seg in (lseg, rseg):
                if len(seg) >= 2:
                    erase(seg[0] if seg is lseg else seg[-1], y)
            changes.append(f"eyes_narrow@{y}")

    # --- 口: 両端を1段“上げて”口角を上げる（◡ = 端が上・中央が下） ---
    if mouth:
        my, seg = mouth
        def free(x, y):
            return (
                0 <= y < gh
                and cells[y][x][3] > 128
                and not is_dark(cells[y][x])
            )
        if free(seg[0], my - 1) and free(seg[-1], my - 1):
            for x in (seg[0], seg[-1]):
                erase(x, my)
                fill_dark(x, my - 1)
            changes.append(f"mouth^({seg[0]}-{seg[-1]}@{my})")
        elif free(seg[len(seg) // 2], my + 1):
            # 上に余白がなければ中央を1段下げて笑い口にする
            for x in seg[1:-1]:
                if free(x, my + 1):
                    fill_dark(x, my + 1)
            changes.append(f"mouthv({seg[0]}-{seg[-1]}@{my})")

    if not changes:
        return False, "変換対象を検出できませんでした"
    write_png(out_path, w, h, out)
    return True, " ".join(changes)

def write_png(path, w, h, rows):
    raw = b""
    for row in rows:
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
# 確認用シート（normal | happy を並べて目視チェック）
# ---------------------------------------------------------------------------

def contact_sheet(pairs, out, cols=6, cell=112, pad=8):
    per = cell * 2 + pad
    rows_n = (len(pairs) + cols - 1) // cols
    W, H = cols * per + pad, rows_n * (cell + pad) + pad
    canvas = [[(215, 231, 244, 255)] * W for _ in range(H)]
    for idx, (npath, hpath) in enumerate(pairs):
        ox = pad + (idx % cols) * per
        oy = pad + (idx // cols) * (cell + pad)
        for k, p in enumerate((npath, hpath)):
            if not os.path.exists(p):
                continue
            w, h, px = pixels(p)
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
    write_png(out, W, H, canvas)
    print(f"sheet: {out} ({W}x{H})")


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pets = os.path.join(root, "public", "pets")
    if "--sheet" in sys.argv:
        out = sys.argv[sys.argv.index("--sheet") + 1]
        ids = sorted(d for d in os.listdir(pets) if os.path.isdir(os.path.join(pets, d)))
        contact_sheet(
            [(f"{pets}/{i}/normal.png", f"{pets}/{i}/happy.png") for i in ids],
            os.path.join(root, out) if not os.path.isabs(out) else out,
        )
    else:
        targets = [a for a in sys.argv[1:] if a.endswith(".png")]
        if not targets:
            targets = [f"{pets}/{d}/normal.png" for d in sorted(os.listdir(pets))
                       if os.path.isdir(os.path.join(pets, d))]
        for p in targets:
            ok, msg = make_happy(p, p.replace("normal.png", "happy.png"))
            print(f"{'OK' if ok else 'NG'} {os.path.basename(os.path.dirname(p)):<18} {msg}")
