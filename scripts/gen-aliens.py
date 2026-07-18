# Issue #7: LOADING宇宙人20種（10形状×2カラー）+ にっこり差分の生成スクリプト
# 使い方: python3 scripts/gen-aliens.py → public/aliens/*.png と docs/design/aliens-sheet*.png を再生成
# ドット絵はこのファイルの文字マップが原本。1文字=1ドット。編集して再実行するだけで差し替え可能
# テイスト: 極太黒アウトライン・チャンキーピクセル・フラット彩色（20x20ドット）
import zlib, struct, os

import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = str(ROOT / "public" / "aliens")
SHEETS = str(ROOT / "docs" / "design")
os.makedirs(BASE, exist_ok=True)

# 共通色（アプリのパレットに準拠）。b/s は キャラごとに差し替え
COMMON = {
    ".": None,
    "k": (26, 26, 36),    # 極太アウトライン
    "w": (255, 255, 255),
    "p": (242, 78, 156),  # ほっぺ
    "y": (255, 216, 77),  # アンテナ玉
    "m": (68, 34, 85),    # 口の中
}

def sym(half):  # 左半分10文字 → 左右対称20文字
    assert len(half) == 10, half
    return half + half[::-1]

# --- 共通パーツ ---
TOP_ANTENNA2 = [
    "....kk........kk....",
    "...kyyk......kyyk...",
    "...kyyk......kyyk...",
    "....kk........kk....",
    "....k..........k....",
]
HEAD_TOP = "...kkkkkkkkkkkkkk..."
FACE = [
    "..kbbbbbbbbbbbbbbk..",
    ".kbbbbbbbbbbbbbbbbk.",
    ".kbkkkbbbbbbbkkkbbk.",
    ".kbkwkbbbbbbbkwkbbk.",
    ".kbkkkbbbbbbbkkkbbk.",
    ".kbpbbbbbbbbbbbpbbk.",
    ".kbbbbbkkkkkbbbbbbk.",
    "..kbbbbbbbbbbbbbbk..",
]
FACE_SMILE = {  # FACE 先頭行を0とした相対行 → 差し替え
    2: ".kbkbkbbbbbbbkbkbbk.",
    3: ".kbkbkbbbbbbbkbkbbk.",
    4: ".kbbkbbbbbbbbbkbbbk.",
    6: ".kbbbbkbbbbbbkbbbbk.",
    7: "..kbbbbkkkkkkbbbbk..",
}
BODY_BIPED = [
    "...kkkkkkkkkkkkkk...",
    "......kbbbbbbk......",
    "...kbbkbbbbbbkbbk...",
    "...kkkkbbbbbbkkkk...",
    "......kbbkkbbk......",
    "......kkk..kkk......",
]

def face_at(offset):
    return {offset + r: row for r, row in FACE_SMILE.items()}

# --- 形状定義: (normal 20行, smile差し替え {行: 文字列}) ---
SHAPES = {}

# 1. クラシック（触角2本・二足）
SHAPES["classic"] = (TOP_ANTENNA2 + [HEAD_TOP] + FACE + BODY_BIPED, face_at(6))

# 2. タコ型（ドーム頭・触手4本）
SHAPES["tako"] = (
    [
        sym(".........."),
        sym(".........."),
        sym(".....kkkkk"),
        sym("...kkbbbbb"),
        sym("..kbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbkkkbbbb"),
        sym(".kbkwkbbbb"),
        sym(".kbkkkbbbb"),
        sym(".kbpbbbbbb"),
        sym(".kbbbbbkkk"),
        sym(".kbbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym("..kbbbbbbb"),
        sym("..kbbbbbbb"),
        sym("..kkbkbbkb"),
        sym("...kbk.kbk"),
        sym("...kbk.kbk"),
        sym("...kkk.kkk"),
        sym(".........."),
    ],
    {
        6: sym(".kbkbkbbbb"),
        7: sym(".kbkbkbbbb"),
        8: sym(".kbbkbbbbb"),
        10: sym(".kbbbkbbbk"),
        11: sym(".kbbbbkkkk"),
    },
)

# 3. ロボ（中央アンテナ・グリル口・箱ボディ）
SHAPES["robo"] = (
    [
        sym(".........k"),
        sym("........ky"),
        sym(".........k"),
        sym("...kkkkkkk"),
        sym("..kbbbbbbb"),
        sym("..kbkkkbbb"),
        sym("..kbkwkbbb"),
        sym("..kbkkkbbb"),
        sym("..kbbbbbbb"),
        sym("..kbbskssk"),
        sym("..kbbbbbbb"),
        sym("...kkkkkkk"),
        sym("....kbbbbb"),
        sym("..kkkbbbbb"),
        sym("..kbkbbbbb"),
        sym("..kkkbbbbb"),
        sym("....kbbbbb"),
        sym("....kbkkbb"),
        sym("....kbk.kb"),
        sym("....kkk.kk"),
    ],
    {
        5: sym("..kbkbkbbb"),
        6: sym("..kbkbkbbb"),
        7: sym("..kbbkbbbb"),
    },
)

# 4. 単眼（サイクロプス・触角1本）
SHAPES["cyclops"] = (
    [
        sym(".........k"),
        sym("........ky"),
        sym("........ky"),
        sym(".........k"),
        sym(".........."),
        [HEAD_TOP][0],
        "..kbbbbbbbbbbbbbbk..",
        ".kbbbbbbbbbbbbbbbbk.",
        ".kbbbbbkkkkkkbbbbbk.",
        ".kbbbbkwwkwwkbbbbbk.",
        ".kbbbbbkkkkkkbbbbbk.",
        ".kbpbbbbbbbbbbbpbbk.",
        ".kbbbbbbkkkkbbbbbbk.",
        "..kbbbbbbbbbbbbbbk..",
    ]
    + BODY_BIPED,
    {
        8: ".kbbbbbkbbbbkbbbbbk.",
        9: ".kbbbbbbkkkkbbbbbbk.",
        10: ".kbbbbbbbbbbbbbbbbk.",
        12: ".kbbbbbkmmmmkbbbbbk.",
        13: "..kbbbbbkkkkbbbbbk..",
    },
)

# 5. ぷよ（まんまる・アホ毛・スタブ足）
SHAPES["puyo"] = (
    [
        sym(".........k"),
        sym("........k."),
        sym(".....kkkkk"),
        sym("...kkbbbbb"),
        sym("..kbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbkkkbbbb"),
        sym(".kbkwkbbbb"),
        sym(".kbkkkbbbb"),
        sym(".kbpbbbbbb"),
        sym(".kbbbbbkkk"),
        sym(".kbbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym("..kbbbbbbb"),
        sym("...kkbbbbb"),
        sym("....kkkkkk"),
        sym("......kbbk"),
        sym("......kkkk"),
        sym(".........."),
    ],
    {
        6: sym(".kbkbkbbbb"),
        7: sym(".kbkbkbbbb"),
        8: sym(".kbbkbbbbb"),
        10: sym(".kbbbkbbbk"),
        11: sym(".kbbbbkkkk"),
    },
)

# 6. きのこ（カサ=s色+白ドット・二足）
SHAPES["kinoko"] = (
    [
        sym("......kkkk"),
        sym("....kkssss"),
        sym("...ksssws."[:10]),
        sym("..ksssssss"),
        sym(".kssswssss"),
        sym(".kkkkkkkkk"),
        "..kbbbbbbbbbbbbbbk..",
        ".kbkkkbbbbbbbkkkbbk.",
        ".kbkwkbbbbbbbkwkbbk.",
        ".kbkkkbbbbbbbkkkbbk.",
        ".kbpbbbbbbbbbbbpbbk.",
        ".kbbbbbkkkkkbbbbbbk.",
        "..kbbbbbbbbbbbbbbk..",
        "...kkkkkkkkkkkkkk...",
    ]
    + BODY_BIPED[1:],
    {
        7: ".kbkbkbbbbbbbkbkbbk.",
        8: ".kbkbkbbbbbbbkbkbbk.",
        9: ".kbbkbbbbbbbbbkbbbk.",
        11: ".kbbbbkbbbbbbkbbbbk.",
        12: "..kbbbbkkkkkkbbbbk..",
    },
)

# 7. おばけ（ドーム頭・ギザギザ裾・浮遊）
SHAPES["obake"] = (
    [
        sym(".........."),
        sym(".....kkkkk"),
        sym("...kkbbbbb"),
        sym("..kbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbkkkbbbb"),
        sym(".kbkwkbbbb"),
        sym(".kbkkkbbbb"),
        sym(".kbpbbbbbb"),
        sym(".kbbbbbkkk"),
        sym(".kbbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbbkbbbbb"),
        sym(".kbkkbkbbb"),
        sym(".kkk.kkbkb"),
        sym("......kkkk"),
        sym(".........."),
        sym(".........."),
    ],
    {
        5: sym(".kbkbkbbbb"),
        6: sym(".kbkbkbbbb"),
        7: sym(".kbbkbbbbb"),
        9: sym(".kbbbkbbbk"),
        10: sym(".kbbbbkkkk"),
    },
)

# 8. ネコ耳（三角耳・ωロ・二足）
SHAPES["neko"] = (
    [
        sym("...k......"),
        sym("...kk....."),
        sym("...kbk...."),
        sym("..kbbk...."),
        sym("..kbbbk..."),
        HEAD_TOP,
        "..kbbbbbbbbbbbbbbk..",
        ".kbkkkbbbbbbbkkkbbk.",
        ".kbkwkbbbbbbbkwkbbk.",
        ".kbkkkbbbbbbbkkkbbk.",
        ".kbpbbbbbbbbbbbpbbk.",
        ".kbbbbkkbkkbkkbbbbk.",
        "..kbbbbbbbbbbbbbbk..",
        "...kkkkkkkkkkkkkk...",
    ]
    + BODY_BIPED[1:],
    {
        7: ".kbkbkbbbbbbbkbkbbk.",
        8: ".kbkbkbbbbbbbkbkbbk.",
        9: ".kbbkbbbbbbbbbkbbbk.",
        11: ".kbbbbbkmmmmkbbbbbk.",
        12: "..kbbbbbkkkkbbbbbk..",
    },
)

# 9. ツノ（2本ヅノ・キバ口・二足）
SHAPES["tsuno"] = (
    [
        sym("..kk......"),
        sym("..ksk....."),
        sym("...ksk...."),
        sym("....kk...."),
        HEAD_TOP,
        "..kbbbbbbbbbbbbbbk..",
        ".kbbbbbbbbbbbbbbbbk.",
        ".kbkkkbbbbbbbkkkbbk.",
        ".kbkwkbbbbbbbkwkbbk.",
        ".kbkkkbbbbbbbkkkbbk.",
        ".kbpbbkkkkkkbbbpbbk.",
        ".kbbbbkwbbwkbbbbbbk.",
        "..kbbbbkkkkbbbbbbk..",
        "...kkkkkkkkkkkkkk...",
    ]
    + BODY_BIPED[1:],
    {
        7: ".kbkbkbbbbbbbkbkbbk.",
        8: ".kbkbkbbbbbbbkbkbbk.",
        9: ".kbbkbbbbbbbbbkbbbk.",
        10: ".kbpbbkkkkkkbbbpbbk.",
        11: ".kbbbbkwmmwkbbbbbbk.",
    },
)

# 10. スライム（しずく型・ワイドボトム）
SHAPES["slime"] = (
    [
        sym(".........."),
        sym(".........."),
        sym(".........."),
        sym("......kkkk"),
        sym(".....kbbbb"),
        sym("....kbbbbb"),
        sym("...kbbbbbb"),
        sym("..kbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbkkkbbbb"),
        sym(".kbkwkbbbb"),
        sym(".kbkkkbbbb"),
        sym(".kbpbbbbbb"),
        sym(".kbbbbbkkk"),
        sym(".kbbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kbbbbbbbb"),
        sym(".kkkkkkkkk"),
        sym(".........."),
        sym(".........."),
    ],
    {
        9: sym(".kbkbkbbbb"),
        10: sym(".kbkbkbbbb"),
        11: sym(".kbbkbbbbb"),
        13: sym(".kbbbkbbbk"),
        14: sym(".kbbbbkkkk"),
    },
)

# --- 20キャラ = 10形状 × 2カラー ---
CHARS = [
    ("01", "classic", "みどりん", (137, 224, 137), (94, 189, 108)),
    ("02", "classic", "そらん", (126, 200, 242), (78, 154, 209)),
    ("03", "tako", "たこすけ", (200, 155, 232), (168, 116, 209)),
    ("04", "tako", "たこもも", (242, 167, 206), (224, 123, 176)),
    ("05", "robo", "ろぼこ", (201, 205, 216), (154, 161, 181)),
    ("06", "robo", "ろぼお", (126, 200, 242), (78, 154, 209)),
    ("07", "cyclops", "ひとみん", (126, 200, 242), (78, 154, 209)),
    ("08", "cyclops", "みかんめ", (242, 179, 107), (224, 123, 57)),
    ("09", "puyo", "くりーむ", (242, 227, 194), (216, 196, 154)),
    ("10", "puyo", "めろん", (137, 224, 137), (94, 189, 108)),
    ("11", "kinoko", "きのこん", (242, 227, 194), (229, 72, 77)),
    ("12", "kinoko", "たまごけ", (242, 227, 194), (255, 216, 77)),
    ("13", "obake", "ふわり", (221, 235, 247), (170, 200, 230)),
    ("14", "obake", "むらさきち", (200, 155, 232), (168, 116, 209)),
    ("15", "neko", "にゃんた", (255, 216, 77), (232, 160, 19)),
    ("16", "neko", "はいにゃん", (201, 205, 216), (154, 161, 181)),
    ("17", "tsuno", "おにお", (242, 179, 107), (224, 123, 57)),
    ("18", "tsuno", "みずつの", (126, 217, 195), (78, 184, 158)),
    ("19", "slime", "ぷるみ", (126, 217, 195), (78, 184, 158)),
    ("20", "slime", "いちごぷる", (242, 167, 206), (224, 123, 176)),
]

def render(rows, colors, scale):
    w, h = 20 * scale, 20 * scale
    raw = b""
    for row in rows:
        assert len(row) == 20, f"len {len(row)}: {row}"
        line = b""
        for ch in row:
            c = colors.get(ch)
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

def write_char(cid, shape, name, body, sub):
    colors = dict(COMMON, b=None)
    colors["b"] = body
    colors["s"] = sub
    normal, smile_patch = SHAPES[shape]
    smile = [smile_patch.get(i, row) for i, row in enumerate(normal)]
    for kind, rows in (("normal", normal), ("smile", smile)):
        raw, w, h = render(rows, colors, 12)
        with open(f"{BASE}/alien-{cid}-{kind}.png", "wb") as f:
            f.write(png_bytes(raw, w, h))
    return normal

# 一覧シート: 5列×4行、各キャラ（scale 6 = 120px）+ 余白
def contact_sheet(all_rows_colors, out="contact-sheet.png"):
    scale, pad = 6, 12
    cell = 20 * scale + pad
    cols_n, rows_n = 5, 4
    W, H = cols_n * cell + pad, rows_n * cell + pad
    canvas = [[(215, 231, 244, 255)] * W for _ in range(H)]  # 方眼紙ブルー背景
    for idx, (rows, colors) in enumerate(all_rows_colors):
        ox = pad + (idx % cols_n) * cell
        oy = pad + (idx // cols_n) * cell
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                c = colors.get(ch)
                if not c:
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        canvas[oy + y * scale + dy][ox + x * scale + dx] = (*c, 255)
    raw = b""
    for line in canvas:
        raw += b"\x00" + b"".join(struct.pack("4B", *px) for px in line)
    with open(f"{SHEETS}/{out}", "wb") as f:
        f.write(png_bytes(raw, W, H))

sheet, sheet_smile = [], []
for cid, shape, name, body, sub in CHARS:
    normal = write_char(cid, shape, name, body, sub)
    smile_patch = SHAPES[shape][1]
    smile = [smile_patch.get(i, row) for i, row in enumerate(normal)]
    colors = dict(COMMON)
    colors["b"] = body
    colors["s"] = sub
    sheet.append((normal, colors))
    sheet_smile.append((smile, colors))
contact_sheet(sheet, "aliens-sheet.png")
contact_sheet(sheet_smile, "aliens-sheet-smile.png")
print("done:", len(CHARS) * 2, "PNGs + 2 sheets")
