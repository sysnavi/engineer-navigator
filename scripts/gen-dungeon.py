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
# ガジェット個別スプライト（松: カテゴリ共通絵を卒業）
# 幅・高さは自由（横長モニタ/縦長ラックなどアスペクト比で個性を出す）。
# content.ts の sprite: "gad-<id>" と1対1で対応させる。
# ---------------------------------------------------------------------------
GADGET_ART = {}

# --- kb ---
GADGET_ART["gad-cha-kb"] = pad([
    "kkkkkkkkkkkkkkkkkkkk",
    "k" + "s" * 18 + "k",
    "k" + "sww" * 6 + "k",
    "k" + "sww" * 6 + "k",
    "k" + "s" * 18 + "k",
    "k" + "sww" * 6 + "k",
    "k" + "s" + "n" * 16 + "s" + "k",  # 茶軸カラーのスペース行
    "kkkkkkkkkkkkkkkkkkkk",
], 20, 8)

GADGET_ART["gad-split-kb"] = pad([
    "kkkkkkkkkk..kkkkkkkkkk",
    "kssssssssk..kssssssssk",
    "kswwswwssk..ksswwswwsk",
    "kswwswwssk..ksswwswwsk",
    "kssssssssk..kssssssssk",
    "ksnnnnsssk..ksssnnnnsk",
    "kkkkkkkkkk..kkkkkkkkkk",
], 22, 7)

GADGET_ART["gad-jisaku-kb-kit"] = pad([
    "...kk....kk.......",
    "..kwwk..kwwk......",
    "..kkkk..kkkk......",
    ".kkkkkkkkkkkkkk...",
    ".kGGGGGGGGGGGGk...",
    ".kGgGoGGgGoGgGk...",
    ".kGGGGGGGGGGGGk...",
    ".kkkkkkkkkkkkkk...",
], 18, 8)

GADGET_ART["gad-capacitive-board"] = pad([
    "kkkkkkkkkkkkkkkkkk",
    "k" + "S" * 16 + "k",
    "k" + "wSS" * 5 + "w" + "k",
    "k" + "S" * 16 + "k",
    "k" + "wSS" * 5 + "w" + "k",
    "k" + "SSS" + "w" * 10 + "SSS" + "k",
    "kkkkkkkkkkkkkkkkkk",
], 18, 7)

GADGET_ART["gad-forty-kb"] = pad([
    "kkkkkkkkkkkk",
    "kssssssssssk",
    "kswwswwswwsk",
    "kssssssssssk",
    "ksswwwwwwssk",
    "kkkkkkkkkkkk",
], 12, 6)

GADGET_ART["gad-legend-enter"] = pad([
    "..kkkkkkkkkk..",
    ".kyyyyyyyyyyk.",
    "kyywyyyyyyyyyk",
    "kyyyyyyyykyyyk",
    "kyyykyyyykyyyk",
    "kyykkkkkkkyyyk",
    "kyyykyyyyyyyyk",
    "kyyyyyyyyyyyyk",
    ".kyyyyyyyyyyk.",
    "..kkkkkkkkkk..",
], 14, 10)

# --- pt ---
GADGET_ART["gad-ergo-mouse"] = pad([
    "...kkkk...",
    "..kssssk..",
    ".kssssssk.",
    ".kswssssk.",
    "kssssssssk",
    "kssssssssk",
    ".kssssssk.",
    "..kkkkkk..",
], 10, 8)

GADGET_ART["gad-trackball"] = pad([
    "...kkkk.....",
    "..krrrrk....",
    "..krwrrk....",
    ".kkrrrrkkk..",
    ".kssssssssk.",
    ".kssssssssk.",
    "..kssssssk..",
    "...kkkkkk...",
], 12, 8)

# --- dp ---
GADGET_ART["gad-monitor-arm"] = pad([
    "kkkkkkkk..",
    "kSSSSSSk..",
    "kkkkkSSk..",
    "....kSSk..",
    "....kSSk..",
    "....kSSk..",
    "....kSSk..",
    "...kkSSkk.",
    "...kSSSSk.",
    "...kkkkkk.",
], 10, 10)

GADGET_ART["gad-tate-monitor"] = pad([
    "kkkkkkkkkkkk",
    "kbbbbbbbbbbk",
    "kbggbbbbbbbk",
    "kbbbbwwbbbbk",
    "kbgggbbbbbbk",
    "kbbbbbbbbbbk",
    "kbwwbbbbbbbk",
    "kbbbggbbbbbk",
    "kbggbbbbbbbk",
    "kbbbbbbbbbbk",
    "kbbwwwbbbbbk",
    "kbbbbbbbbbbk",
    "kkkkkkkkkkkk",
    "....kkkk....",
    "....kSSk....",
    "...kkkkkk...",
    "..kkkkkkkk..",
], 12, 17)

GADGET_ART["gad-ultrawide"] = pad([
    "k" * 32,
    "k" + "b" * 30 + "k",
    "k" + "bggbbbb" + "wwbb" + "bbbbbb" + "gggg" + "bbbbbbbbb" + "k",
    "k" + "b" * 30 + "k",
    "k" + "bwwbbb" + "gg" + "bbbbbb" + "gg" + "bbbbbb" + "www" + "bbbbb" + "k",
    "k" + "b" * 30 + "k",
    "k" + "bb" + "gggg" + "bbbbb" + "ww" + "bbbb" + "gg" + "bbbbbbbb" + "gg" + "b" + "k",
    "k" + "b" * 30 + "k",
    "k" * 32,
    "." * 13 + "kkkkkk" + "." * 13,
    "." * 12 + "kkkkkkkk" + "." * 12,
], 32, 11)

GADGET_ART["gad-curved49"] = pad([
    "." + "k" * 38 + ".",
    "k" + "b" * 38 + "k",
    "k" + "b" * 38 + "k",
    "k" + "bb" + "w" * 8 + "b" * 14 + "w" * 10 + "bbbb" + "k",
    "k" + "bb" + "w" + "g" * 6 + "w" + "b" * 14 + "w" + "g" * 8 + "w" + "bbbb" + "k",
    "k" + "vv" + "w" + "g" * 6 + "w" + "v" * 14 + "w" + "g" * 8 + "w" + "vvvv" + "k",
    "k" + "vv" + "w" * 8 + "v" * 14 + "w" * 10 + "vvvv" + "k",
    "k" + "v" * 38 + "k",
    "." + "k" * 38 + ".",
    "." * 17 + "kkkkkk" + "." * 17,
    "." * 15 + "kkkkkkkkkk" + "." * 15,
], 40, 11)

# --- au ---
GADGET_ART["gad-nc-headphone"] = pad([
    "...kkkkkk...",
    "..kssssssk..",
    ".kss....ssk.",
    ".ks......sk.",
    "kkk......kkk",
    "kSSk....kSSk",
    "kSSk....kSSk",
    "kSSk....kSSk",
    "kkk......kkk",
], 12, 9)

GADGET_ART["gad-condenser-mic"] = pad([
    "..kkkkk...",
    ".ksssssk..",
    ".kswsssk..",
    ".ksssssk..",
    ".ksssssk..",
    "..kkkkk...",
    "....kk....",
    "....kk....",
    "...kkkk...",
    "..kkkkkk..",
], 10, 10)

# --- dk ---
GADGET_ART["gad-wrist-rest"] = pad([
    ".kkkkkkkkkkkk.",
    "knnnnnnnnnnnnk",
    "knwnnnnnnnnnnk",
    ".kkkkkkkkkkkk.",
], 14, 4)

GADGET_ART["gad-desk-mat"] = pad([
    "..kkkkkkkkkkkkkkkkkkkkkk..",
    ".k" + "c" * 22 + "k.",
    "k" + "c" * 24 + "k",
    "k" + "c" * 24 + "k",
    "k" + "c" * 20 + "gggg" + "k",
    "k" + "c" * 24 + "k",
    "k" * 26,
], 26, 7)

GADGET_ART["gad-succulent"] = pad([
    "....gg....",
    "..gggggg..",
    ".gGggggGg.",
    "..gGggGg..",
    "...kkkk...",
    "..knnnnk..",
    "..knnnnk..",
    "...kkkk...",
], 10, 8)

GADGET_ART["gad-elec-desk"] = pad([
    "k" * 30,
    "k" + "n" * 28 + "k",
    "k" + "nn" + "ww" + "n" * 8 + "ww" + "n" * 8 + "ww" + "nnnn" + "k",
    "k" * 30,
    "..kSSk" + "." * 18 + "kSSk..",
    "..kSSk" + "." * 18 + "kSSk..",
    "..kSSk" + "." * 18 + "kSSk..",
    "..kSSk" + "." * 18 + "kSSk..",
    ".kkSSkk" + "." * 16 + "kkSSkk.",
], 30, 9)

GADGET_ART["gad-balance-ball"] = pad([
    "....kkkkkk....",
    "..kkvvvvvvkk..",
    ".kvvvvvvvvvvk.",
    ".kvwwvvvvvvvk.",
    "kvvwwvvvvvvvvk",
    "kvvvvvvvvvvvvk",
    "kvvvvvvvvvvvvk",
    "kvvvvvvvvvvvvk",
    ".kvvvvvvvvvvk.",
    "..kkvvvvvvkk..",
    "....kkkkkk....",
], 14, 11)

# --- pc ---
GADGET_ART["gad-ups"] = pad([
    ".kkkkkkkkkk.",
    ".kSSSSSSSSk.",
    ".kSggSSSSSk.",
    ".kSSSSSSSSk.",
    ".kSSwwwSSSk.",
    ".kSSSSSSSSk.",
    ".kSSSSSSSSk.",
    ".kSSSSSSSSk.",
    ".kSSSSSSSSk.",
    ".kkkkkkkkkk.",
], 12, 10)

GADGET_ART["gad-raspi-cluster"] = pad([
    ".kkkkkkkkkkkk.",
    ".kGGggGGGGggk.",
    ".kkkkkkkkkkkk.",
    "..kk......kk..",
    ".kkkkkkkkkkkk.",
    ".kGGggGGGGggk.",
    ".kkkkkkkkkkkk.",
    "..kk......kk..",
    ".kkkkkkkkkkkk.",
    ".kGGggGGGGggk.",
    ".kkkkkkkkkkkk.",
], 14, 11)

GADGET_ART["gad-rack-server"] = pad([
    "kkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSk",
    "kSgSSSSSSSSoSk",
    "kkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSk",
    "kSgSSSSSSSSgSk",
    "kkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSk",
    "kSoSSSSSSSSgSk",
    "kkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSk",
    "kSgSSSSSSSSgSk",
    "kkkkkkkkkkkkkk",
], 14, 13)

GADGET_ART["gad-rack42u"] = pad([
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSgS" + "s" * 8 + "SoSk",
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSgS" + "s" * 8 + "SgSk",
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSoS" + "s" * 8 + "SgSk",
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSgS" + "s" * 8 + "SgSk",
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSgS" + "s" * 8 + "SoSk",
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSgS" + "s" * 8 + "SgSk",
    "kkkkkkkkkkkkkkkk",
    "kk" + "." * 12 + "kk",
], 16, 20)

# --- tl ---
GADGET_ART["gad-cable-tray"] = pad([
    "kkkkkkkkkkkkkkkkkkkk",
    "k" + "s" * 18 + "k",
    "k" + "ks" * 9 + "k",
    "kkkkkkkkkkkkkkkkkkkk",
    "..b....o......b.....",
    "..b....o......b.....",
    "..bb...oo....bb.....",
], 20, 7)

GADGET_ART["gad-kvm"] = pad([
    "kkkkkkkkkkkk",
    "kSSSSSSSSSSk",
    "kSgSSSSSSoSk",
    "kSSSwwSSSSSk",
    "kkkkkkkkkkkk",
], 12, 5)

GADGET_ART["gad-printer3d"] = pad([
    "kkkkkkkkkkkkkkkkkk",
    "kSSk..........kSSk",
    "kSSk...kkk....kSSk",
    "kSSk...kok....kSSk",
    "kSSk....o.....kSSk",
    "kSSk...ooo....kSSk",
    "kSSk..ooooo...kSSk",
    "kkkkkkkkkkkkkkkkkk",
    ".kSSSSSSSSSSSSSSk.",
    ".kkkkkkkkkkkkkkkk.",
], 18, 10)

GADGET_ART["gad-solder-station"] = pad([
    "kkkkkkkkkk......",
    "kssssssssk...kk.",
    "ksrssssssk..kSk.",
    "kssswwsssk..kSk.",
    "kssssssssk.kkSkk",
    "kkkkkkkkkk..knk.",
    "............knk.",
    "............kkk.",
], 16, 8)

GADGET_ART["gad-golden-solder"] = pad([
    "kkkkkkkkkk....w.",
    "kyyyyyyyyk...kk.",
    "kyryyyyyyk..kok.",
    "kyyywwyyyk..kok.",
    "kyyyyyyyyk.kkokk",
    "kkkkkkkkkk..kyk.",
    "......w.....kyk.",
    "............kkk.",
], 16, 8)

GADGET_ART["gad-arcade-stick"] = pad([
    "......kk..........",
    ".....krrk.........",
    "......kk..........",
    "......kk..........",
    "kkkkkkkkkkkkkkkkkk",
    "k" + "ssssssss" + "rr" + "ss" + "rr" + "ss" + "k",
    "k" + "s" * 16 + "k",
    "kkkkkkkkkkkkkkkkkk",
], 18, 8)

GADGET_ART["gad-pedal"] = pad([
    ".kkkk..kkkk.",
    "ksssskkssssk",
    "kswsskkswssk",
    "kkkkkkkkkkkk",
], 12, 4)

# --- rt ---
GADGET_ART["gad-crt"] = pad([
    ".kkkkkkkkkkkkkk.",
    ".knnnnnnnnnnnnk.",
    ".knkkkkkkkkkknk.",
    ".knkggggggggknk.",
    ".knkgwwgggggknk.",
    ".knkggggggggknk.",
    ".knkggggggggknk.",
    ".knkkkkkkkkkknk.",
    ".knnnnnnnnnonnk.",
    ".kkkkkkkkkkkkkk.",
    "..kkkkkkkkkkkk..",
], 16, 11)

GADGET_ART["gad-retro-pc"] = pad([
    ".kkkkkkkkkkkkkkkk.",
    ".kwwwwwwwwwwwwwwk.",
    ".kwkkkkkkkkkkkkwk.",
    ".kwkbbbbbbbbbbkwk.",
    ".kwkbwbbbbbbbbkwk.",
    ".kwkbbbbbbbbbbkwk.",
    ".kwkkkkkkkkkkkkwk.",
    ".k" + "wwwwww" + "ss" + "wwwwww" + "k.",
    ".kwwwwwwwwwwwwwwk.",
    ".kkkkkkkkkkkkkkkk.",
], 18, 10)

GADGET_ART["gad-punch-card"] = pad([
    "kkkkkkkkkk..",
    "kwwwwwwwwkk.",
    "kwkwkwwkwwk.",
    "kwwwwwwwwwk.",
    "kwkwwkwkwwk.",
    "kwwwwwwwwwk.",
    "kkkkkkkkkkk.",
], 12, 7)

GADGET_ART["gad-acoustic-coupler"] = pad([
    "..kkkk....kkkk....",
    ".kmmmmk..kmmmmk...",
    ".kmmmmk..kmmmmk...",
    "kkkkkkkkkkkkkkkkkk",
    "knnnnnnnnnnnnnnnnk",
    "k" + "nw" + "n" * 12 + "on" + "k",
    "kkkkkkkkkkkkkkkkkk",
], 18, 7)

# ネオンサイン "DEPLOY": 3x5フォントから組み立てる（手打ちよりミスが出ない）
_NEON_FONT = {
    "D": ["pp.", "p.p", "p.p", "p.p", "pp."],
    "E": ["ppp", "p..", "pp.", "p..", "ppp"],
    "P": ["pp.", "p.p", "pp.", "p..", "p.."],
    "L": ["p..", "p..", "p..", "p..", "ppp"],
    "O": [".p.", "p.p", "p.p", "p.p", ".p."],
    "Y": ["p.p", "p.p", ".p.", ".p.", ".p."],
}

def _neon(word):
    inner = 4 * len(word) - 1  # 3px文字 + 1px間隔
    rows = ["k" * (inner + 4), "k" + "m" * (inner + 2) + "k"]
    for i in range(5):
        line = "m".join(_NEON_FONT[ch][i] for ch in word)
        rows.append("k" + "m" + line.replace(".", "m") + "m" + "k")
    rows += ["k" + "m" * (inner + 2) + "k", "k" * (inner + 4)]
    return rows

GADGET_ART["gad-neon-deploy"] = pad(_neon("DEPLOY"), 27, 9)

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

ALL = {**MONSTERS, **ICONS, **GADGET_ART}
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

contact_sheet(list({**MONSTERS, **ICONS}.items()), "dungeon-sheet.png")
# ガジェットは横長/縦長があるのでセルを大きく取った専用シート
contact_sheet(list(GADGET_ART.items()), "gadget-sheet.png", cols=6, cell_px=40, scale=6)
print("done:", len(ALL), "sprites + dungeon-sheet.png + gadget-sheet.png")
