# ファビコン／PWAアイコンを16x16のドット絵から生成する。
#
#   python3 scripts/gen-icons.py
#
# デザイン: 「▶ PRESS START」— ロイヤル地にホットピンクの三角。
# サイトの行動ボタン（▶ 提出する / ▶ ダンジョンに潜る）の文法と揃えてある。
# 16pxの実サイズで読めることを最優先に、要素をひとつに絞った。
#
# ピクセルアートは拡大時にアンチエイリアスが入ると輪郭がぼやけて台無しになるので、
# next/og の動的生成ではなく **1ドット=整数ピクセルの静的PNG** として書き出す。
# 出力先:
#   src/app/icon.png        … ブラウザタブ（Nextのapp/icon規約）
#   src/app/favicon.ico     … 旧来のfavicon（16/32/48を同梱）
#   src/app/apple-icon.png  … iOSホーム画面
#   public/icon-192.png / icon-512.png … PWAマニフェスト
import zlib, struct, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PALETTE = {
    ".": None,
    "k": (18, 35, 95),    # ネイビー（輪郭）
    "r": (0, 74, 173),    # ロイヤル（地）
    "p": (242, 78, 156),  # ホットピンク（行動色）
}

# ▶ PRESS START（16x16）。左右に余白を持たせPWAのマスカブル安全域(中央80%)に収める
ART = [
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrkkrrrrrrrrrrr",
    "rrrkppkkrrrrrrrr",
    "rrrkppppkkrrrrrr",
    "rrrkppppppkkrrrr",
    "rrrkppppppppkkrr",
    "rrrkpppppppppkrr",
    "rrrkpppppppppkrr",
    "rrrkppppppppkkrr",
    "rrrkppppppkkrrrr",
    "rrrkppppkkrrrrrr",
    "rrrkppkkrrrrrrrr",
    "rrrkkrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
    "rrrrrrrrrrrrrrrr",
]
BG = PALETTE["r"]


def render(scale, canvas=None):
    """1ドット=scale px で描く。canvas を指定すると地の色で中央寄せパディングする"""
    w = len(ART[0]) * scale
    rows = []
    for line in ART:
        row = []
        for ch in line:
            c = PALETTE[ch] or BG
            row.extend([(*c, 255)] * scale)
        rows.extend([list(row) for _ in range(scale)])
    if canvas and canvas != w:
        pad = (canvas - w) // 2
        out = [[(*BG, 255)] * canvas for _ in range(canvas)]
        for y, row in enumerate(rows):
            for x, px in enumerate(row):
                out[pad + y][pad + x] = px
        return out, canvas
    return rows, w


def png_bytes(pixels, size):
    raw = b""
    for row in pixels:
        raw += b"\x00" + b"".join(struct.pack("4B", *p) for p in row)
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def write_png(path, scale, canvas=None):
    pixels, size = render(scale, canvas)
    with open(path, "wb") as f:
        f.write(png_bytes(pixels, size))
    print(f"  {os.path.relpath(path, ROOT)}  {size}x{size}")


def write_ico(path, scales):
    """複数サイズを同梱したICO（中身はPNG。Vista以降が対応）"""
    images = []
    for sc in scales:
        pixels, size = render(sc)
        images.append((size, png_bytes(pixels, size)))
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = len(header) + 16 * len(images)
    entries, blobs = b"", b""
    for size, data in images:
        entries += struct.pack(
            "<BBBBHHII",
            size if size < 256 else 0, size if size < 256 else 0,
            0, 0, 1, 32, len(data), offset,
        )
        blobs += data
        offset += len(data)
    with open(path, "wb") as f:
        f.write(header + entries + blobs)
    print(f"  {os.path.relpath(path, ROOT)}  {'/'.join(str(s) for s, _ in images)}")


if __name__ == "__main__":
    app = os.path.join(ROOT, "src", "app")
    pub = os.path.join(ROOT, "public")
    print("アイコンを生成:")
    write_png(os.path.join(app, "icon.png"), 4)                 # 64px タブ用
    write_ico(os.path.join(app, "favicon.ico"), [1, 2, 3])      # 16/32/48
    write_png(os.path.join(app, "apple-icon.png"), 11, 180)     # 176を180に中央寄せ
    write_png(os.path.join(pub, "icon-192.png"), 12)            # 192
    write_png(os.path.join(pub, "icon-512.png"), 32)            # 512
