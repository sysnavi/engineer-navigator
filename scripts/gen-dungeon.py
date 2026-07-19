# ダンジョンのドット絵生成（Issue #3）。gen-aliens.py と同方式（1文字=1ドット）。
# 使い方: python3 scripts/gen-dungeon.py → public/dungeon/*.png と docs/design/dungeon-sheet.png
# モンスター/アイコンを足すときはここに文字マップを追加して再実行 → content.ts の sprite にIDを書く
import zlib, struct, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = ROOT / "public" / "dungeon"
SHEETS = ROOT / "docs" / "design"
BASE.mkdir(parents=True, exist_ok=True)

PALETTE = {
    ".": None,
    "k": (26, 26, 36),     # アウトライン
    "w": (255, 255, 255),
    "y": (255, 216, 77),   # レモン
    "p": (242, 78, 156),   # ピンク
    "r": (229, 72, 77),    # 赤
    "g": (137, 224, 137),  # 緑
    "G": (78, 162, 78),    # 濃緑
    "b": (126, 200, 242),  # 空色
    "v": (200, 155, 232),  # 紫
    "o": (242, 179, 107),  # 橙
    "c": (126, 217, 195),  # ティール
    "s": (201, 205, 216),  # 灰
    "S": (154, 161, 181),  # 濃灰
    "n": (176, 128, 80),   # 茶
    "m": (68, 34, 85),     # 口の中・影
}

def sym(half):  # 左半分 → 左右対称（幅=len*2）
    return half + half[::-1]

def pad(rows, w, h):  # 幅w・高hに整形（不足行は透明で埋める）
    out = [r if len(r) == w else (_ for _ in ()).throw(AssertionError(f"len {len(r)}: {r}")) for r in rows]
    while len(out) < h:
        out.append("." * w)
    assert len(out) == h, f"rows {len(out)}"
    return out

# ---------------------------------------------------------------------------
# モンスター 16x16
# ---------------------------------------------------------------------------
MONSTERS = {}

MONSTERS["mon-minibug"] = pad([
    sym("...k...."),
    sym("....k..."),
    sym("..kkkkkk"),
    sym(".kgggggg"),
    sym(".kgkwkgg"),
    sym(".kgkkkgg"),
    sym(".kgggggg"),
    sym(".kgmgmgg"),
    sym("..kkkkkk"),
    sym(".k.k.k.."),
], 16, 16)

MONSTERS["mon-typo"] = pad([
    sym(".....kk."),
    sym("....kvk."),
    sym("...kvvk."),
    sym("..kvvvvk"),
    sym(".kkkkkkk"),
    sym("..knnnnn"),
    sym("..knkwkn"),
    sym("..knnnnn"),
    sym("..knmmnn"),
    sym("...kkkkk"),
    sym("...kn.nk"),
    sym("...kk.kk"),
], 16, 16)

MONSTERS["mon-offbyone"] = pad([
    "......kkkk......",
    ".....kbbbbk.....",
    "....kbkwbbbk....",
    "....kbkkbbbk....",
    "...kbbbbbbbkyk..",
    "..kbbbbbbbbkyyk.",
    "..kbbbbbbbbbkk..",
    "...kbbbbbbbk....",
    "....kkkkkkk.....",
    "......k..k......",
    ".....kk...k.....",
], 16, 16)

MONSTERS["mon-mojibake"] = pad([
    sym("...kkkkk"),
    sym("..kvvvvv"),
    sym(".kvvvvvv"),
    sym(".kvkkvvk"),
    sym(".kvkwvvk"),
    sym(".kvvvvvv"),
    sym(".kvwkwvv"),
    sym(".kvvvvvv"),
    sym(".kvvvvvv"),
    sym(".kvkvvkv"),
    sym(".kk.kk.k"),
], 16, 16)

MONSTERS["mon-infloop"] = pad([
    sym("...kkkkk"),
    sym("..kGGGGG"),
    sym(".kGkkkGG"),
    ".kGk...kGGk.kkk.",
    ".kGk....kGkkGGk.",
    ".kGk....kGGGGk..",
    ".kGk...kwkGGk...",
    ".kGGk.kkkkk.....",
    sym("..kGGGGG"),
    sym("...kkkkk"),
], 16, 16)

MONSTERS["mon-nullpo"] = pad([
    sym("..k.k.k."),
    sym(".k......"),
    sym("........"),
    sym(".k..kk.."),
    sym("....kk.."),
    sym(".k......"),
    sym("........"),
    sym(".k...kk."),
    sym("........"),
    sym("..k.k.k."),
], 16, 16)

MONSTERS["mon-memleak"] = pad([
    sym("....kkkk"),
    sym("..kkcccc"),
    sym(".kcccccc"),
    sym(".kckkccc"),
    sym(".kckwccc"),
    sym(".kcccccc"),
    sym(".kcmmccc"),
    sym("kcCccccc".replace("C", "c")),
    sym("kccccccc"),
    sym("kkkkkkkk"),
    sym(".kc..kc."),
    sym(".kk..kk."),
], 16, 16)

MONSTERS["mon-deadlock"] = pad([
    "..kk........kk..",
    ".krrk......krrk.",
    ".krrkk....kkrrk.",
    "..kkrrkkkkrrkk..",
    "...kkrrrrrrkk...",
    "..krrrrrrrrrrk..",
    ".krkwkrrrrkwkrk.",
    ".krkkkrrrrkkkrk.",
    "..krrrrrrrrrrk..",
    "...kkrrrrrrkk...",
    "..k.kkkkkkkk.k..",
    ".k..k......k..k.",
], 16, 16)

MONSTERS["mon-cacheghost"] = pad([
    "....kkkkk.......",
    "...kssssskkkk...",
    "..kssssssssssk..",
    "..kskkssskkssk..",
    "..kskwssskwssk..",
    "..kssssssssssk..",
    "..ksssmmsssssk..",
    "..kssssssssssk..",
    "..ksksskskssssk.",
    "..kk.kk.kk.kkk..",
], 16, 16)

MONSTERS["mon-flaky"] = pad([
    "kk............kk",
    "kvkk........kkvk",
    "kvvvkk.kkk.kkvvk".replace(".kkk.", "kkkkk"),
    ".kvvvkkvvvkkvvk.",
    ".kvvvvvvvvvvvk..",
    "..kvkkvvvkkvk...",
    "..kvkwvvvkwvk...",
    "..kvvvvvvvvvk...",
    "...kvmmmmvvk....",
    "....kkkkkkk.....",
], 16, 16)

MONSTERS["mon-specchange"] = pad([
    ".....kkkkkk.....",
    "...kkggggookk...",
    "..kgggggoooook..",
    ".kgkkgggookkook.",
    ".kgkwgggookwook.",
    ".kggggggooooook.",
    ".kggggggooooook.",
    "..kggggkkoooook.",
    "...kkkk..kkkkk..",
    "....kg....ok....",
    "....kk....kk....",
], 16, 16)

MONSTERS["mon-debtgolem"] = pad([
    sym("..kkkkkk"),
    sym(".kSSSSSS"),
    sym(".kSkkSSS"),
    sym(".kSkySSS"),
    sym(".kSSSSSS"),
    sym("kSSmmSSS"),
    sym("kSSSSSSk".replace("k", "S", 1)[:8] if False else "kSSSSSSS"),
    sym("kSkSSSkS"),
    sym("kSSSSSSS"),
    sym("kkkkkkkk"),
    sym(".kSS.kSS"),
    sym(".kkk.kkk"),
], 16, 16)

MONSTERS["mon-legacydragon"] = pad([
    "..kk........kk..",
    ".kGGk......kGGk.",
    ".kGGGkkkkkkGGGk.",
    "..kGGGGGGGGGGk..",
    ".kGGGGGGGGGGGGk.",
    ".kGkkGGGGGGkkGk.",
    ".kGkyGGGGGGkyGk.",
    ".kGGGGGGGGGGGGk.",
    ".kGGwkwkwkwGGGk.",
    "..kGGkkkkkkGGk..",
    "...kGGGGGGGGk...",
    "....kkkkkkkk....",
    "...kG.k..k.Gk...",
    "...kk.k..k.kk...",
], 16, 16)

MONSTERS["mon-prodhydra"] = pad([
    ".kk....kk....kk.",
    "krrk..krrk..krrk",
    "krkwk.krkwk.krkw".replace("krkw$", "krkwk")[:16],
    "krrrk.krrrk.krrk",
    ".krrk..krrk.krrk",
    ".krrrk.krrk.krrk".replace("k.krrk.k", "kkkrrkkk")[:16],
    "..krrkkkrrkkrrk.",
    "...krrrrrrrrrk..",
    "....krrrrrrrk...",
    "....krrmmrrrk...",
    ".....krrrrrk....",
    "......kkkkk.....",
], 16, 16)

# ---------------------------------------------------------------------------
# アイコン 12x12（宝箱・罠・休憩 + ガジェットカテゴリ8種）
# ---------------------------------------------------------------------------
ICONS = {}

ICONS["icon-chest"] = pad([
    sym(".kkkkk"),
    sym("knnnnn"),
    sym("knnnnn"),
    sym("kkkkkk"),
    sym("knnykk".replace("ykk", "kyk")),
    sym("knnkyk"),
    sym("knnnnn"),
    sym("knnnnn"),
    sym(".kkkkk"),
], 12, 12)

ICONS["icon-trap"] = pad([
    sym(".....k"),
    sym("....ky"),
    sym("...kyy"),
    sym("...kyk"),
    sym("..kyyk"),
    sym("..kyyy"),
    sym(".kyyyk"),
    sym(".kyyyy"),
    sym("kkkkkk"),
], 12, 12)

ICONS["icon-rest"] = pad([
    "....w..w....",
    "...w..w.....",
    "..kkkkkkkk..",
    ".kwwwwwwwwkk",
    ".kwwwwwwwwkk",
    ".kwwwwwwwkk.",
    "..kwwwwwwk..",
    "...kkkkkk...",
    "..kkkkkkkk..",
], 12, 12)

ICONS["cat-kb"] = pad([
    sym("kkkkkk"),
    sym("kwswsw".replace("wsw", "sws")),
    sym("ksssss"),
    sym("kswsws"),
    sym("ksssss"),
    sym("kswwww"),
    sym("kkkkkk"),
], 12, 12)

ICONS["cat-pt"] = pad([
    sym("..kkkk"),
    sym(".kssss"),
    sym("kswwss"),
    sym("kswsss"),
    sym("ksssss"),
    sym(".kssss"),
    sym("..kkkk"),
], 12, 12)

ICONS["cat-dp"] = pad([
    sym("kkkkkk"),
    sym("kbbbbb"),
    sym("kbwbbb"),
    sym("kbbbbb"),
    sym("kkkkkk"),
    sym("...kk."),
    sym("..kkkk"),
], 12, 12)

ICONS["cat-dk"] = pad([
    sym("kkkkkk"),
    sym("kccccc"),
    sym("kkkkkk"),
    sym("kc...."),
    sym("kkkkkk"),
    sym("kc..kc"),
    sym("kk..kk"),
], 12, 12)

ICONS["cat-au"] = pad([
    sym(".kkkkk"),
    sym("kk...."),
    sym("k....."),
    sym("kkk..."),
    sym("kvk..."),
    sym("kvk..."),
    sym("kkk..."),
], 12, 12)

ICONS["cat-pc"] = pad([
    sym("kkkkkk"),
    sym("ksssss"),
    sym("kswsss"),
    sym("kkkkkk"),
    sym("ksssss"),
    sym("kswsss"),
    sym("kkkkkk"),
], 12, 12)

ICONS["cat-tl"] = pad([
    "....kkk.....",
    "...kssk.....",
    "...kssskk...",
    "....kssssk..",
    ".....kssssk.",
    "......kssk..",
    ".......kk...",
], 12, 12)

ICONS["cat-rt"] = pad([
    sym("kkkkkk"),
    sym("knnnnn"),
    sym("knggnn"),
    sym("knggnn"),
    sym("knnnnn"),
    sym("kkkkkk"),
    sym("kn..kn"),
], 12, 12)

# ---------------------------------------------------------------------------
# 出力
# ---------------------------------------------------------------------------

def render(rows, scale):
    w, h = len(rows[0]) * scale, len(rows) * scale
    raw = b""
    for row in rows:
        line = b""
        for ch in row:
            c = PALETTE.get(ch)
            px = struct.pack("4B", *c, 255) if c else b"\x00\x00\x00\x00"
            line += px * scale
        raw += (b"\x00" + line) * scale
    return raw, w, h

def png_bytes(raw, w, h):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))

ALL = {**MONSTERS, **ICONS}
for name, rows in ALL.items():
    raw, w, h = render(rows, 12)
    (BASE / f"{name}.png").write_bytes(png_bytes(raw, w, h))

# 一覧シート（確認用）
def contact_sheet(items, out, cols=7, cell_px=16, scale=8, pad_px=10):
    cell = cell_px * scale + pad_px
    rows_n = (len(items) + cols - 1) // cols
    W, H = cols * cell + pad_px, rows_n * cell + pad_px
    canvas = [[(215, 231, 244, 255)] * W for _ in range(H)]
    for idx, (name, rows) in enumerate(items):
        ox = pad_px + (idx % cols) * cell
        oy = pad_px + (idx // cols) * cell
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                c = PALETTE.get(ch)
                if not c:
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        py, px_ = oy + y * scale + dy, ox + x * scale + dx
                        if py < H and px_ < W:
                            canvas[py][px_] = (*c, 255)
    raw = b""
    for line in canvas:
        raw += b"\x00" + b"".join(struct.pack("4B", *px) for px in line)
    (SHEETS / out).write_bytes(png_bytes(raw, W, H))

contact_sheet(list(ALL.items()), "dungeon-sheet.png")
print("done:", len(ALL), "sprites + dungeon-sheet.png")
