// おさんぽの世界（ファミコン風タイルワールド）の定義と描画。
//
// 内部解像度 320x180 の canvas に、9つのビオーム（草原・堤防・河原・街中・山道・
// 洞窟・塔・田舎道・公園）を巡回で描く。巡回順はセッションごとにシャッフル。
// 遠景/中景/地面の3層視差。地面はワールド座標に固定（列ごとにビオーム判定）
// なので境界がそのままスクロールで流れ、遠景・中景は境界の道標が画面を横切る間に
// クロスフェードで入れ替わる（エリア境界のパースずれを演出で隠す・ファミコンの常套手段）。
// 洞窟・塔は「壁が空を覆う」屋内型ビオーム: クロスフェードがそのまま入口の暗転演出になる。
//
// 描画関数は全て ctx を引数に取る純関数寄り。プロップのドット絵は文字マップ
// （pixel-icon.tsx と同方式）を遅延でオフスクリーンcanvasに焼いて使い回す。

import type { TimeBucket, WeatherBucket } from "./mutter";

export const W = 320;
export const H = 180;
export const HORIZON = 108;
export const PATH_TOP = 146;
export const PATH_BOT = 170;
/** ペットの立ち位置（画面x・足元y） */
export const PET_X = 110;
export const PET_FOOT_Y = 166;

export type BiomeId =
  | "kusahara"
  | "teibo"
  | "kawara"
  | "machi"
  | "yama"
  | "doukutsu"
  | "tou"
  | "inaka"
  | "kouen"
  // レア分岐（低確率でしか行けない）
  | "kazan"
  | "makai"
  | "ikuukan"
  | "sekaiju"
  // カギアイテムで解放される行き先
  | "uchuu"
  | "kaichuu"
  | "shinkai"
  | "yukiyama"
  | "cherick";

const BIOME_ALL: BiomeId[] = [
  "kusahara",
  "teibo",
  "kawara",
  "machi",
  "yama",
  "doukutsu",
  "tou",
  "inaka",
  "kouen",
];

/** ビオーム境界ごとに約4%で紛れこむレア行き先（巡回には入らない） */
export const RARE_BIOMES: BiomeId[] = ["kazan", "makai", "ikuukan", "sekaiju"];
/** カギアイテム所持で巡回に混ざる特別な行き先（items.ts参照） */
export const SPECIAL_BIOMES: BiomeId[] = [
  "uchuu",
  "kaichuu",
  "shinkai",
  "yukiyama",
  "cherick",
];

/** シャッフル巡回順を作る（LCG + Fisher-Yates）。seed固定なのでセッション内は決定的 */
function shuffledSeq(list: BiomeId[], seed: number): BiomeId[] {
  const arr = [...list];
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 巡回順はページロードごとにシャッフル（開くたび違う旅程になる）。
// seedはモジュール初期化時に1度だけ決めるので「毎フレーム同じ景色」の原則は保たれる。
// SSR側は描画しないので固定seedで良い（hydration後もこの配列は描画にしか使われない）
const WORLD_SEED = typeof window === "undefined" ? 1 : (Math.random() * 0x7fffffff) | 0;

let SEQ: BiomeId[] = shuffledSeq(BIOME_ALL, WORLD_SEED);

/** 解放済みの特別ビオームを巡回に混ぜる（walk-canvas がマウント時に呼ぶ） */
export function setUnlockedBiomes(unlocked: BiomeId[]) {
  const specials = SPECIAL_BIOMES.filter((b) => unlocked.includes(b));
  SEQ = shuffledSeq([...BIOME_ALL, ...specials], WORLD_SEED);
}

/** 区間番号 → ビオーム。約4%でレア分岐（seed込みなので場所はセッションごとに変わる） */
export function biomeForSeg(seg: number): BiomeId {
  if (hash(seg * 977 + WORLD_SEED) % 100 < 4) {
    return RARE_BIOMES[hash(seg * 613 + WORLD_SEED) % RARE_BIOMES.length];
  }
  const n = SEQ.length;
  return SEQ[((seg % n) + n) % n];
}

/** デバッグ・行き先選択: 指定ビオームが最初に現れる区間を探す（レア分岐も探せる） */
export function findSegOf(b: BiomeId, maxSeg = 4000): number | null {
  for (let s = 0; s < maxSeg; s++) if (biomeForSeg(s) === b) return s;
  return null;
}

/** 天気パーティクルを降らせないビオーム（屋内・水中・宇宙・異空間） */
export const INDOOR_BIOMES: ReadonlySet<BiomeId> = new Set([
  "doukutsu",
  "tou",
  "ikuukan",
  "uchuu",
  "kaichuu",
  "shinkai",
]);

/** そのビオームでは天気を強制上書きする（雪山は常に雪） */
export const FORCED_WEATHER: Partial<Record<BiomeId, WeatherBucket>> = {
  yukiyama: "snow",
};

/** レア・特別ビオームに入った瞬間のひとこと（walk-scene が onBiomeChange で出す） */
export const ENTRY_LINES: Partial<Record<BiomeId, string>> = {
  kazan: "…あつっ！？ ここ、かざん じゃない？",
  makai: "……ここ、どこ？ そらが むらさきいろ してる…。",
  ikuukan: "え。ここ……なに？ せかいの そとがわ？",
  sekaiju: "みあげても てっぺんが みえない…。せかいじゅ、だ。",
  uchuu: "ついた…！ ここが うちゅう！ ふわふわ する〜。",
  kaichuu: "おまもりが ひかってる。……みずのなか、いける！",
  shinkai: "すずの おとが ひびいてる…。ふかい ふかい うみのそこ。",
  yukiyama: "ゆきぐつ、ばっちり。ゆきやま とうちゃく！",
  cherick: "ちずの とおりだ…！ みどりの そらの ほし、チェリックせい！",
};

export const BIOME_LEN = 1280; // 1ビオームのワールド長(px)
export const BIOME_JA: Record<BiomeId, string> = {
  kusahara: "草原",
  teibo: "堤防",
  kawara: "河原",
  machi: "街中",
  yama: "山道",
  doukutsu: "洞窟",
  tou: "塔",
  inaka: "田舎道",
  kouen: "公園",
  kazan: "火山",
  makai: "魔界",
  ikuukan: "異空間",
  sekaiju: "世界樹",
  uchuu: "宇宙",
  kaichuu: "海中",
  shinkai: "深海",
  yukiyama: "雪山",
  cherick: "チェリック星",
};

export function biomeAt(worldX: number): BiomeId {
  return biomeForSeg(Math.floor(worldX / BIOME_LEN));
}

/** worldX 以降で最初に来るビオーム境界のワールドx */
export function nextBoundary(worldX: number): number {
  return (Math.floor(worldX / BIOME_LEN) + 1) * BIOME_LEN;
}

/** 決定的ハッシュ（毎フレーム同じ景色を出すため乱数は使わない） */
export function hash(n: number): number {
  let h = (n | 0) ^ 0x2545f491;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^= h >>> 16) >>> 0;
}

// ---------------------------------------------------------------------------
// パレット
// ---------------------------------------------------------------------------

const INK = "#12235f"; // アプリ共通のネイビー輪郭

const SKY: Record<TimeBucket, string[]> = {
  // 上→下の6段バンド（なめらかグラデにしない＝8bitの段々空）
  morning: ["#ffdfae", "#ffe7c2", "#dcecd9", "#bfe6ff", "#b0dfff", "#a5daff"],
  noon: ["#7ec8ff", "#8fd0ff", "#a3daff", "#b8e4ff", "#cdeeff", "#def4ff"],
  evening: ["#ffb26b", "#ffbe7e", "#ff9fb8", "#e98fc4", "#c98ad2", "#b98ad6"],
  night: ["#0d1234", "#101743", "#141c4f", "#1b2458", "#232c63", "#2a336d"],
};

// 特別な空を持つビオーム（時刻に関係なくこの空になる。夜の暗幕はDOM側でかかる）
const SKY_BIOME: Partial<Record<BiomeId, string[]>> = {
  kazan: ["#2a0c10", "#3a1013", "#471316", "#54181a", "#63201c", "#732a1e"],
  makai: ["#1c0c2a", "#241033", "#2b123d", "#321447", "#3a1650", "#42195a"],
  ikuukan: ["#07070f", "#090914", "#0b0b18", "#0d0d1c", "#0f0f20", "#111124"],
  sekaiju: ["#0c211e", "#0f2a26", "#12302b", "#153631", "#183e38", "#1c453e"],
  uchuu: ["#04050e", "#050612", "#060715", "#070818", "#08091c", "#0a0b20"],
  kaichuu: ["#2d7fd0", "#2a76c4", "#276db8", "#2464ac", "#215ba0", "#1e5294"],
  shinkai: ["#081226", "#070f20", "#060c1c", "#050a17", "#040812", "#03060e"],
  yukiyama: ["#b8d4e4", "#c0dae8", "#c8e0ec", "#d0e6f0", "#d8ecf4", "#e0f0f7"],
  cherick: ["#4f9e46", "#5aa84e", "#68b45a", "#78c168", "#8ccd74", "#a0d884"],
};

const GRASS = { light: "#8ac559", dark: "#7ebd4e", deep: "#5f9e4a" };
const DIRT = { light: "#d9b784", dark: "#cfa974", edge: "#a97f4f" };
const PAVE = { light: "#c9ced8", dark: "#bcc2cf", edge: "#8f96a6" };
const WATER = { base: "#4f8fd0", deep: "#3f7cba", glint: "#bfe2ff" };
// 洞窟（屋内・昼夜でほぼ変わらない）
const CAVE = {
  wall: "#3a3454",
  wallDark: "#2e2944",
  rock: "#4a4468",
  floor: "#514a66",
  floorDark: "#453f58",
  path: "#6b6278",
  pathDark: "#5a5268",
  edge: "#3a3450",
};
// 塔（石壁＋赤じゅうたん）
const TOWER = {
  wall: "#8b90a6",
  brick: "#6a7088",
  wallN: "#454d6e",
  brickN: "#333a58",
  floor: "#a7acbd",
  floorDark: "#979cb0",
  floorN: "#565e78",
  floorDarkN: "#4a5169",
  carpet: "#b04052",
  carpetDark: "#93384a",
  carpetN: "#7c2c3c",
  gold: "#d9b34a",
};

// ---------------------------------------------------------------------------
// プロップ（文字マップ → オフスクリーンcanvas・1文字=2px）
// ---------------------------------------------------------------------------

const PCOLORS: Record<string, string> = {
  k: INK,
  w: "#ffffff",
  m: "#9aa2b5", // 猫グレー
  M: "#7d8598",
  p: "#f7b2cd",
  n: "#a8794a", // 木
  N: "#8a6039",
  t: "#d9c79a", // 看板の板
  r: "#e05656", // 自販機の赤
  R: "#b23f3f",
  y: "#ffd84d",
  g: "#5f9e4a",
  G: "#487d3a",
  e: "#dfe6f2", // 発光パネル
  s: "#5dade2",
  c: "#79e0d8", // 水晶
  C: "#4db8b0",
  o: "#ff8c2e", // 炎・光る実
  O: "#ffd84d",
  P: "#8d84c9", // 魔界の商人ローブ
  D: "#3a3454", // 暗がり（コウモリ等）
  q: "#f7a8b8", // サンゴ
};

const PROP_MAPS: Record<string, string[]> = {
  // 道標（ビオーム境界）: 右向きの矢印板
  signpost: [
    "..kkkkkkkk..",
    ".kttttttttk.",
    ".kttkkkkttkk",
    ".kttttttttk.",
    "..kkkkkkkk..",
    ".....kNk....",
    ".....kNk....",
    ".....kNk....",
    ".....kNk....",
    ".....kNk....",
    ".....kNk....",
    "....kkNkk...",
  ],
  // ベンチ
  bench: [
    "kkkkkkkkkkkkkk",
    "knnnnnnnnnnnnk",
    "kkkkkkkkkkkkkk",
    "knnnnnnnnnnnnk",
    "kkkkkkkkkkkkkk",
    ".kNk......kNk.",
    ".kNk......kNk.",
  ],
  // すわり猫（左＝歩いてくるペットの方を見ている）
  cat: [
    ".mm.....mm..",
    ".mMm...mMm..",
    ".mmmmmmmmm..",
    ".mkmmmmkmm..",
    ".mmmwwmmmm..",
    ".mmmmmmmmmM.",
    ".mmmmmmmmmM.",
    ".mmmmmmmmM..",
    ".mm.mm.mm...",
  ],
  // 自販機
  vending: [
    "kkkkkkkkkk",
    "kreeeeeerk",
    "kreeeeeerk",
    "krrrrrrrrk",
    "kryryryrrk",
    "krrrrrrrrk",
    "krrkkkkrrk",
    "krrkeekrrk",
    "krrkkkkrrk",
    "kRRRRRRRRk",
    "kRkkkkkkRk",
    "kkkkkkkkkk",
  ],
  // 電柱
  pole: [
    "kkkkkk",
    ".kNNk.",
    "kkNNkk",
    ".kNNk.",
    ".kNNk.",
    ".kNNk.",
    ".kNNk.",
    ".kNNk.",
    ".kNNk.",
    ".kNNk.",
    ".kNNk.",
    ".kNNk.",
    ".kNNk.",
  ],
  // 葦（河原）
  reed: [
    "..g..g",
    ".gg.gg",
    ".gg.gg",
    "..ggg.",
    "..Ggg.",
    "..GG..",
    "..GG..",
  ],
  // 花（草原）
  flowerP: ["..p.", ".pyp", "..p.", "..g."],
  flowerW: ["..w.", ".wyw", "..w.", "..g."],
  // 岩
  rock: ["..MMm.", ".Mmmmm", "Mmmmmm", "kkkkkk"],
  // すべり台（公園）: 右にはしご・左へすべる
  slide: [
    "........kkkk..",
    "........kyyk..",
    "....kkkkkyyk..",
    "....kyyyyyyk..",
    "...kkkyyyykk..",
    "..kkyyyyk.kNk.",
    ".kkyyyyk..kNk.",
    "kkyyyyk...kNk.",
    "kyyyyk....kNk.",
    "kkkkk.....kNk.",
    "kkkkkkkkkkkkkk",
  ],
  // 街灯（公園）
  lamp: [
    ".kkkk.",
    "kyyyyk",
    "kyyyyk",
    ".kkkk.",
    "..MM..",
    "..MM..",
    "..MM..",
    "..MM..",
    "..MM..",
    "..MM..",
    "..MM..",
    ".kMMk.",
    "kkkkkk",
  ],
  // かかし（田舎道）
  kakashi: [
    "..kkkkk..",
    ".kNNNNNk.",
    "kkkkkkkkk",
    "...kwk...",
    "..kwwwk..",
    "kkkkrkkkk",
    "...krk...",
    "...krk...",
    "...kNk...",
    "...kNk...",
    "..kkNkk..",
  ],
  // 水晶（洞窟）
  crystal: ["...c..", "..ccc.", ".ccCc.", ".cCcc.", "ccccCc", "kkkkkk"],
  // 宝箱（塔）
  chest: [
    ".kkkkkkkk.",
    "kNNNNNNNNk",
    "kNnnnnnnNk",
    "kkkkkkkkkk",
    "kNNkyykNNk",
    "kNNkyykNNk",
    "kkkkkkkkkk",
  ],
  // バッタ（草原）
  batta: [".g...", "gg.g.", ".ggg.", "kgkgk"],
  // カエル（河原・田舎道）
  kaeru: [".g.g.", "gwgwg", "ggggg", "g.g.g"],
  // ハト（街中・公園）
  hato: ["..mm.", ".mmmk", "mmmm.", ".m.m."],
  // コウモリ（洞窟・ぶらさがり）
  koumori: ["..k..", ".kDk.", "DkDkD", ".DDD.", "..D.."],
  // スライム（塔）
  slime: [".ggg.", "ggggg", "gkgkg", "ggggg", "kkkkk"],
  // 光る石碑（塔・異空間）
  sekihi: [
    ".kkkkkk.",
    "kMmmmmMk",
    "kMcCcCMk",
    "kMmmmmMk",
    "kMCcCcMk",
    "kMmmmmMk",
    "kkkkkkkk",
  ],
  // 無人販売所（田舎道）
  hanbai: [
    "kkkkkkkkkkkk",
    "kNNNNNNNNNNk",
    "kkkkkkkkkkkk",
    "kNttttttttNk",
    "kNtgtoottoNk",
    "kNttttttttNk",
    "kkkkkkkkkkkk",
    ".kN......Nk.",
  ],
  // 間欠泉（火山）
  geyser: ["..ee..", ".eeee.", "..ee..", "..ee..", "MMeeMM", "kkkkkk"],
  // あやしい商人（魔界）
  shounin: [
    "..kkkk..",
    ".kPPPPk.",
    "kPPPPPPk",
    "kPkPPkPk",
    "kPPPPPPk",
    ".kPPPPk.",
    "kPPPPPPk",
    "kPPPPPPk",
    "kkPkkPkk",
  ],
  // 光る実（世界樹）
  kinomi: [".OOO.", "OoooO", "OoOoO", "OoooO", ".OOO.", "..N.."],
  // サンゴ（海中）
  sango: [".q..q.", "qq.qq.", ".qqq.q", ".qq.qq", "..qqq.", "kkkkkk"],
  // 雪だるま（雪山）
  yukidaruma: [
    "..rrr..",
    "..rrr..",
    ".wwwww.",
    "wkwwwkw",
    "wwwowww",
    ".wwwww.",
    "wwwwwww",
    "wwwwwww",
    ".kkkkk.",
  ],
  // チェリック星の住人（カエルっぽい）
  seijin: [".g.g.", "gkgkg", "ggggg", "gwwwg", ".ggg.", ".g.g."],
};

const propCache = new Map<string, HTMLCanvasElement>();

function propSprite(id: string): HTMLCanvasElement {
  let c = propCache.get(id);
  if (c) return c;
  const rows = PROP_MAPS[id];
  const s = 2; // 1文字=2px
  c = document.createElement("canvas");
  c.width = rows[0].length * s;
  c.height = rows.length * s;
  const g = c.getContext("2d")!;
  rows.forEach((row, y) =>
    row.split("").forEach((ch, x) => {
      const col = PCOLORS[ch];
      if (!col) return;
      g.fillStyle = col;
      g.fillRect(x * s, y * s, s, s);
    })
  );
  propCache.set(id, c);
  return c;
}

// ---------------------------------------------------------------------------
// 空・天体・雲
// ---------------------------------------------------------------------------

export function drawSky(
  ctx: CanvasRenderingContext2D,
  time: TimeBucket,
  weather: WeatherBucket,
  frame: number,
  sx: number,
  biome: BiomeId
) {
  const special = SKY_BIOME[biome];
  const bands = special ?? SKY[time];
  const bh = Math.ceil(HORIZON / bands.length);
  bands.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * bh, W, bh);
  });

  if (special) {
    // 特別な空の天体（太陽・月・雲は通常空だけのもの）
    if (biome === "uchuu" || biome === "ikuukan") {
      // 星ぼし（異空間は反転色まじり）
      for (let i = 0; i < 30; i++) {
        const x = hash(i * 7) % W;
        const y = (hash(i * 13) % (HORIZON - 12)) + 4;
        if ((i + frame) % 9 > 6) continue;
        ctx.fillStyle =
          biome === "ikuukan" && i % 3 === 0
            ? "#ff5ad0"
            : biome === "ikuukan" && i % 3 === 1
              ? "#5af0ff"
              : i % 5 === 0
                ? "#9fc4ff"
                : "#e8ecff";
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (biome === "makai") {
      // 赤い月
      ctx.fillStyle = "rgba(179,36,58,0.16)";
      ctx.fillRect(224, 8, 40, 40);
      ctx.fillStyle = "#8a1c2e";
      ctx.fillRect(230, 14, 26, 26);
      ctx.fillStyle = "#b3243a";
      ctx.fillRect(233, 17, 20, 20);
      ctx.fillStyle = "#d04a56";
      ctx.fillRect(237, 20, 8, 6);
    } else if (biome === "cherick") {
      // ふたつの太陽
      ctx.fillStyle = "#fff7c0";
      ctx.fillRect(228, 14, 16, 16);
      ctx.fillStyle = "#fffceb";
      ctx.fillRect(232, 18, 8, 8);
      ctx.fillStyle = "#ffe9a0";
      ctx.fillRect(196, 30, 10, 10);
      ctx.strokeStyle = INK;
      ctx.strokeRect(227.5, 13.5, 17, 17);
    } else if (biome === "yukiyama") {
      ctx.fillStyle = "#eef4f8";
      ctx.fillRect(244, 16, 14, 14); // 淡い太陽
    } else if (biome === "kazan") {
      // 噴煙がたなびく
      ctx.fillStyle = "rgba(90,70,70,0.5)";
      const dx = (sx * 0.1) % 60;
      ctx.fillRect(200 - dx, 10, 40, 7);
      ctx.fillRect(216 - dx, 4, 30, 6);
    }
    return;
  }

  // 天体
  if (time === "night") {
    // 星（固定位置・2フレームまたたき）
    for (let i = 0; i < 14; i++) {
      const x = hash(i * 7) % W;
      const y = (hash(i * 13) % (HORIZON - 30)) + 6;
      ctx.fillStyle =
        (i + frame) % 2 === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)";
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = "#f4f0d0";
    ctx.fillRect(252, 22, 16, 16);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.strokeRect(251.5, 21.5, 17, 17);
  } else if (weather !== "rain" && weather !== "storm" && weather !== "snow") {
    const sun =
      time === "evening" ? { x: 244, y: 66, c: "#ff9d5c" } : { x: 252, y: 22, c: "#ffdf5a" };
    ctx.fillStyle = sun.c;
    ctx.fillRect(sun.x, sun.y, 18, 18);
    ctx.strokeStyle = INK;
    ctx.strokeRect(sun.x - 0.5, sun.y - 0.5, 19, 19);
  }

  // 雲（ごくゆっくり流れる）。雨雪はDOMオーバーレイに任せて雲は省略
  if (weather === "clear" || weather === "cloudy") {
    const n = weather === "cloudy" ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const speed = 0.06 + (i % 3) * 0.02;
      const cx = W - ((sx * speed + i * 137) % (W + 80));
      const cy = 16 + ((i * 29) % 44);
      ctx.fillStyle = weather === "cloudy" ? "rgba(235,239,246,0.95)" : "rgba(255,255,255,0.92)";
      ctx.fillRect(cx, cy + 4, 44, 8);
      ctx.fillRect(cx + 8, cy, 26, 6);
    }
  }
}

// ---------------------------------------------------------------------------
// 遠景・中景（ビオームごと・phase = sx * 視差係数）
// ---------------------------------------------------------------------------

/** なだらかな丘の高さ（8px列単位で量子化） */
function hillY(x: number, seed: number, amp: number, wave: number): number {
  const t = Math.sin((x + seed) / wave) + Math.sin((x + seed * 2) / (wave * 1.7)) * 0.5;
  return Math.round((t * amp) / 4) * 4;
}

/** ワールド格子をなめらかに滑る画面xで巡回する。
 *  模様は必ずワールド座標（wx）で決めて、画面には wx - phase で置くこと。
 *  画面側の格子に描くと、スクロールのたびに模様が再抽選されて全面が点滅する
 *  （初版の「目にうるさい」の原因）。 */
function worldCols(
  phase: number,
  step: number,
  cb: (wx: number, x: number) => void
) {
  const start = Math.floor(phase / step) * step - step;
  const off = Math.round(phase); // 列ごとに丸めると継ぎ目が割れるので先に丸める
  for (let wx = start; wx < phase + W + step; wx += step) {
    cb(wx, wx - off);
  }
}

export function drawFar(
  ctx: CanvasRenderingContext2D,
  biome: BiomeId,
  phase: number,
  time: TimeBucket
) {
  const night = time === "night";
  if (biome === "kusahara" || biome === "teibo") {
    // 遠い丘（堤防は対岸の丘）。高さはワールドxで決める＝形が変わらず平行移動する
    ctx.fillStyle = night ? "#3d5a52" : "#a7cba0";
    worldCols(phase, 8, (wx, x) => {
      const h = 18 + hillY(wx, 11, 10, 60);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    if (biome === "teibo") {
      // 対岸の小さな家々（44pxのワールド格子に固定）
      worldCols(phase, 44, (wx, x) => {
        const cell = Math.round(wx / 44);
        if (hash(cell * 5) % 3 !== 0) return;
        ctx.fillStyle = night ? "#2c3f63" : "#c7d4e8";
        ctx.fillRect(x + 20, HORIZON - 10, 10, 10);
        ctx.fillStyle = night ? "#ffd84d" : "#8fa3c4";
        ctx.fillRect(x + 23, HORIZON - 7, 3, 3);
      });
    }
  } else if (biome === "kawara" || biome === "yama") {
    // 山なみ（河原=低め・山道=高め2重）
    const big = biome === "yama";
    ctx.fillStyle = night ? "#26355e" : big ? "#7d9bb5" : "#9db8cc";
    worldCols(phase, 8, (wx, x) => {
      const h = (big ? 40 : 24) + hillY(wx, 31, big ? 18 : 10, 52);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    if (big) {
      // 手前の山は少し速い層（phase違い）だが、形はそれぞれのワールドxに固定
      ctx.fillStyle = night ? "#1d2a4e" : "#5f7f9e";
      worldCols(phase * 1.3, 8, (wx, x) => {
        const h = 26 + hillY(wx, 77, 14, 40);
        ctx.fillRect(x, HORIZON - h, 8, h);
      });
    }
  } else if (biome === "inaka") {
    // 遠くの低い山なみ＋すそ野の林
    ctx.fillStyle = night ? "#26355e" : "#9db8cc";
    worldCols(phase, 8, (wx, x) => {
      const h = 20 + hillY(wx, 51, 8, 64);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    ctx.fillStyle = night ? "#2f4a33" : "#7fae6e";
    worldCols(phase, 8, (wx, x) => {
      const h = 8 + hillY(wx, 63, 4, 22);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
  } else if (biome === "kouen") {
    // 公園の外周: 遠くの木々の帯＋低いフェンス
    ctx.fillStyle = night ? "#2f4a33" : "#93bd7e";
    worldCols(phase, 8, (wx, x) => {
      const h = 14 + hillY(wx, 91, 6, 30);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    ctx.fillStyle = night ? "#3a4462" : "#b7c3d6";
    worldCols(phase, 16, (wx, x) => {
      ctx.fillRect(x + 2, HORIZON - 8, 2, 8); // フェンス支柱
    });
    ctx.fillRect(0, HORIZON - 8, W, 2); // フェンス上桟（画面幅で一様）
  } else if (biome === "doukutsu") {
    // 岩壁が空を覆う（屋内）。鍾乳石＋鉱石のきらめき
    ctx.fillStyle = night ? CAVE.wallDark : CAVE.wall;
    ctx.fillRect(0, 0, W, HORIZON);
    ctx.fillStyle = night ? "#252038" : CAVE.wallDark;
    worldCols(phase, 16, (wx, x) => {
      const cell = Math.round(wx / 16);
      const len = 8 + (hash(cell * 17) % 20);
      ctx.fillRect(x + 4, 0, 8, len); // 鍾乳石
      ctx.fillRect(x + 6, len, 4, 4);
    });
    // 岩肌の陰影
    ctx.fillStyle = night ? "#312b48" : CAVE.rock;
    worldCols(phase, 24, (wx, x) => {
      const cell = Math.round(wx / 24);
      if (hash(cell * 7) % 3 === 0)
        ctx.fillRect(x + (hash(cell) % 10), 40 + (hash(cell * 3) % 50), 10, 6);
    });
    // 鉱石のきらめき（川面のきらめきと同じ巻き取り式＝スクロールで自然に流れる）
    const P = W + 40;
    for (let i = 0; i < 8; i++) {
      const x = ((((hash(i * 29) % P) - phase) % P) + P) % P - 20;
      ctx.fillStyle = i % 2 ? "#79e0d8" : "#8d84c9";
      ctx.fillRect(Math.round(x), 30 + (hash(i * 41) % 60), 2, 2);
    }
  } else if (biome === "tou") {
    // 石壁が空を覆う（屋内）。窓は「壁を描かない穴」＝本物の空が覗く
    const wall = night ? TOWER.wallN : TOWER.wall;
    const brick = night ? TOWER.brickN : TOWER.brick;
    worldCols(phase, 64, (wx, x) => {
      const cell = Math.round(wx / 64);
      const hasWin = hash(cell * 11) % 4 !== 0;
      const winX = x + 22,
        winY = 26,
        winW = 20,
        winH = 34;
      ctx.fillStyle = wall;
      if (!hasWin) {
        ctx.fillRect(x, 0, 64, HORIZON);
      } else {
        // 窓のまわりだけ壁を描く（上・下・左・右）
        ctx.fillRect(x, 0, 64, winY);
        ctx.fillRect(x, winY + winH, 64, HORIZON - winY - winH);
        ctx.fillRect(x, winY, 22, winH);
        ctx.fillRect(winX + winW, winY, 64 - 22 - winW, winH);
        // アーチ上部（窓の上端を少し狭める）
        ctx.fillRect(winX, winY, 3, 4);
        ctx.fillRect(winX + winW - 3, winY, 3, 4);
        // 窓枠
        ctx.strokeStyle = INK;
        ctx.strokeRect(winX - 0.5, winY - 0.5, winW + 1, winH + 1);
      }
      // レンガの目地（壁の上にだけ載せる）
      ctx.fillStyle = brick;
      for (let yy = 8; yy < HORIZON; yy += 12) {
        for (let xx = 0; xx < 64; xx += 16) {
          const bx = x + xx + (yy % 24 === 8 ? 0 : 8);
          if (hasWin && bx + 12 > winX && bx < winX + winW && yy + 2 > winY && yy < winY + winH)
            continue;
          ctx.fillRect(bx, yy, 12, 2);
        }
      }
    });
  } else if (biome === "kazan") {
    // 火山のシルエット＋火口の照り返し
    ctx.fillStyle = "#20090d";
    worldCols(phase, 8, (wx, x) => {
      const h = 34 + hillY(wx, 41, 20, 44);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    worldCols(phase, 160, (wx, x) => {
      const cell = Math.round(wx / 160);
      if (hash(cell * 13) % 2 !== 0) return;
      const peak = HORIZON - 58 - (hash(cell * 7) % 10);
      ctx.fillStyle = "#ff5a2e";
      ctx.fillRect(x + 60, peak, 16, 3); // 火口
      ctx.fillStyle = "#ffd75e";
      ctx.fillRect(x + 64, peak, 8, 2);
      ctx.fillStyle = "#ff8c2e";
      ctx.fillRect(x + 66, peak + 3, 3, 12); // 溶岩すじ
    });
  } else if (biome === "makai") {
    // ねじれた尖塔（窓明かりがまたたく）
    worldCols(phase, 40, (wx, x) => {
      const cell = Math.round(wx / 40);
      const top = 20 + (hash(cell * 5) % 26);
      ctx.fillStyle = "#150a1e";
      for (let y = top; y < HORIZON; y += 3) {
        const off = Math.round(Math.sin((y - top) * 0.4 + cell) * 3);
        const w2 = Math.max(3, 9 - ((y - top) / 16) | 0);
        ctx.fillRect(x + 14 + off, y, w2, 3);
      }
      if (hash(cell * 17) % 3 === 0) {
        ctx.fillStyle = (cell + Math.floor(phase / 40)) % 7 === 0 ? "#ff8ca0" : "#ff4a5e";
        ctx.fillRect(x + 16, top + 4, 2, 2);
      }
    });
  } else if (biome === "ikuukan") {
    // 浮かぶ図形（輪郭だけの三角・四角・十字）
    worldCols(phase, 56, (wx, x) => {
      const cell = Math.round(wx / 56);
      const kind = hash(cell * 7) % 3;
      const y = 18 + (hash(cell * 11) % 50);
      if (kind === 0) {
        ctx.strokeStyle = "#5af0ff";
        ctx.strokeRect(x + 16.5, y + 0.5, 14, 14);
      } else if (kind === 1) {
        ctx.fillStyle = "#ff5ad0";
        ctx.fillRect(x + 16, y + 6, 14, 2);
        ctx.fillRect(x + 22, y, 2, 14);
      } else {
        ctx.fillStyle = "#cfd4ff";
        for (let s = 0; s < 7; s++) ctx.fillRect(x + 22 - s, y + s * 2, 2 + s * 2, 2);
      }
    });
  } else if (biome === "sekaiju") {
    // 巨大な幹が何本も。上は光る樹冠
    worldCols(phase, 90, (wx, x) => {
      const cell = Math.round(wx / 90);
      const tw = 26 + (hash(cell * 3) % 14);
      ctx.fillStyle = "#33241c";
      ctx.fillRect(x + 20, 0, tw, HORIZON);
      ctx.fillStyle = "#241812";
      for (let y = 6; y < HORIZON; y += 9)
        ctx.fillRect(x + 24 + ((y * 13) % (tw - 10)), y, 3, 6);
      ctx.fillStyle = "#3e2c22";
      ctx.fillRect(x + 20, 0, 3, HORIZON);
    });
    ctx.fillStyle = "#2a8f5e";
    ctx.fillRect(0, 0, W, 14);
    ctx.fillStyle = "#46d68a";
    worldCols(phase, 20, (wx, x) => {
      if (hash(Math.round(wx / 20) * 9) % 2 === 0) ctx.fillRect(x + 4, 10, 12, 6);
    });
  } else if (biome === "uchuu") {
    // 輪っかの惑星と地球（星は空レイヤー）
    ctx.fillStyle = "#c98a4a";
    ctx.fillRect(226, 18, 26, 22);
    ctx.fillStyle = "#d9a066";
    ctx.fillRect(229, 21, 20, 16);
    ctx.fillStyle = "#e8b980";
    ctx.fillRect(233, 24, 9, 5);
    ctx.fillStyle = "#e8d8a0";
    ctx.fillRect(214, 29, 50, 3);
    ctx.fillStyle = "#2e6fd0";
    ctx.fillRect(52, 20, 13, 12);
    ctx.fillStyle = "#4a8fe0";
    ctx.fillRect(53, 21, 11, 10);
    ctx.fillStyle = "#5ec46a";
    ctx.fillRect(55, 22, 4, 3);
    ctx.fillRect(59, 27, 3, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(54, 26, 3, 1);
  } else if (biome === "kaichuu") {
    // 光のカーテン＋遠くの魚影
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    worldCols(phase * 0.5, 70, (wx, x) => {
      for (let y = 0; y < 70; y += 3) ctx.fillRect(x + 20 + y / 3, y, 6, 3);
    });
    ctx.fillStyle = "rgba(20,50,100,0.5)";
    worldCols(phase, 60, (wx, x) => {
      const cell = Math.round(wx / 60);
      if (hash(cell * 7) % 3 !== 0) return;
      const y = 16 + (hash(cell * 11) % 50);
      ctx.fillRect(x + 20, y, 9, 3);
      ctx.fillRect(x + 29, y - 1, 3, 5);
    });
  } else if (biome === "shinkai") {
    // 海底山脈の影
    ctx.fillStyle = "#0a1524";
    worldCols(phase, 8, (wx, x) => {
      const h = 20 + hillY(wx, 87, 12, 40);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
  } else if (biome === "yukiyama") {
    // 雪の峰ふたつ重ね
    ctx.fillStyle = "#8fa8bc";
    worldCols(phase, 8, (wx, x) => {
      const h = 40 + hillY(wx, 19, 18, 50);
      ctx.fillRect(x, HORIZON - h, 8, h);
      ctx.fillStyle = "#f4f8fb";
      ctx.fillRect(x, HORIZON - h, 8, Math.min(12, h)); // 冠雪
      ctx.fillStyle = "#8fa8bc";
    });
    ctx.fillStyle = "#a5bccc";
    worldCols(phase * 1.3, 8, (wx, x) => {
      const h = 24 + hillY(wx, 67, 12, 38);
      ctx.fillRect(x, HORIZON - h, 8, h);
      ctx.fillStyle = "#eef4f8";
      ctx.fillRect(x, HORIZON - h, 8, Math.min(8, h));
      ctx.fillStyle = "#a5bccc";
    });
  } else if (biome === "cherick") {
    // 青緑の丘と、ふしぎな木のシルエット
    ctx.fillStyle = "#3f8f88";
    worldCols(phase, 8, (wx, x) => {
      const h = 16 + hillY(wx, 33, 8, 56);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    worldCols(phase, 48, (wx, x) => {
      const cell = Math.round(wx / 48);
      if (hash(cell * 5) % 3 !== 0) return;
      ctx.fillStyle = "#d8d4c0";
      ctx.fillRect(x + 20, HORIZON - 18, 3, 18);
      ctx.fillStyle = "#2e8f88";
      ctx.fillRect(x + 13, HORIZON - 28, 17, 11);
      ctx.fillStyle = "#5ec4bc";
      ctx.fillRect(x + 17, HORIZON - 25, 7, 4);
    });
  } else {
    // 街のスカイライン。窓はビル内の行列番号で決める＝ビルに固定されて流れる
    worldCols(phase, 26, (wx, x) => {
      const bi = Math.round(wx / 26);
      const h = 16 + (hash(bi * 3) % 26);
      ctx.fillStyle = night ? "#222c52" : "#aab6cf";
      ctx.fillRect(x, HORIZON - h, 22, h);
      const win = night ? "#ffd84d" : "#8fa0c0";
      const rows = Math.floor((h - 8) / 6);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 3; c++) {
          if (hash(bi * 91 + r * 7 + c) % (night ? 3 : 4) === 0) {
            ctx.fillStyle = win;
            ctx.fillRect(x + 3 + c * 6, HORIZON - h + 4 + r * 6, 3, 3);
          }
        }
      }
    });
  }
}

export function drawMid(
  ctx: CanvasRenderingContext2D,
  biome: BiomeId,
  phase: number,
  time: TimeBucket,
  frame: number,
  /** 実時間(秒)。魚・火の粉など「住民」のなめらかな動きに使う（reduced時は0固定） */
  nowSec = 0
) {
  const night = time === "night";
  if (biome === "kusahara") {
    // 茂み（形はワールドxに固定）
    ctx.fillStyle = night ? "#2f4a33" : GRASS.deep;
    worldCols(phase, 8, (wx, x) => {
      const h = 10 + hillY(wx, 7, 8, 26);
      ctx.fillRect(x, HORIZON - h + 8, 8, h);
    });
  } else if (biome === "teibo" || biome === "kawara") {
    // 川面。きらめきは位置が滑らかに流れ、明滅だけ2フレームで行う
    // （位置をframeで動かすとカクカク跳ねて目にうるさい）
    const top = biome === "teibo" ? HORIZON - 2 : HORIZON + 2;
    const deep = biome === "teibo" ? 16 : 26;
    ctx.fillStyle = night ? "#27427a" : WATER.base;
    ctx.fillRect(0, top, W, deep);
    ctx.fillStyle = night ? "#1e3766" : WATER.deep;
    ctx.fillRect(0, top + deep - 6, W, 6);
    const P = W + 40;
    for (let i = 0; i < 26; i++) {
      const x = ((((hash(i * 17) % P) - phase * 1.4) % P) + P) % P - 20;
      const y = top + 3 + (hash(i * 23) % (deep - 8));
      const bright = (i + frame) % 2 === 0;
      ctx.fillStyle = night
        ? `rgba(200,220,255,${bright ? 0.55 : 0.25})`
        : bright
          ? WATER.glint
          : "rgba(191,226,255,0.45)";
      ctx.fillRect(Math.round(x), y, 4, 2);
    }
  } else if (biome === "machi") {
    // 家並み（屋根＋窓）。38pxのワールド格子に固定
    worldCols(phase, 38, (wx, x) => {
      const bi = Math.round(wx / 38);
      const h = 18 + (hash(bi * 13) % 10);
      ctx.fillStyle = night ? "#31406b" : "#dfe6f2";
      ctx.fillRect(x, HORIZON - h + 14, 30, h);
      ctx.fillStyle = night ? "#1d2a4e" : "#6f81a8";
      ctx.fillRect(x - 2, HORIZON - h + 8, 34, 8); // 屋根
      ctx.fillStyle = night ? "#ffd84d" : "#9fb0d0";
      ctx.fillRect(x + 5, HORIZON - h + 20, 5, 5);
      ctx.fillRect(x + 19, HORIZON - h + 20, 5, 5);
    });
  } else if (biome === "inaka") {
    // たんぼ（水面＋苗の列）と、たまに農家
    ctx.fillStyle = night ? "#27427a" : "#a8cbe0";
    ctx.fillRect(0, HORIZON - 14, W, 14); // 水鏡
    ctx.fillStyle = night ? "#2f4a33" : "#69a84e";
    worldCols(phase, 8, (wx, x) => {
      ctx.fillRect(x + 1, HORIZON - 12, 2, 10); // 苗の列
      ctx.fillRect(x + 5, HORIZON - 11, 2, 9);
    });
    worldCols(phase, 96, (wx, x) => {
      const cell = Math.round(wx / 96);
      if (hash(cell * 19) % 3 !== 0) return;
      ctx.fillStyle = night ? "#2a2317" : "#7a6047";
      ctx.fillRect(x + 8, HORIZON - 30, 34, 8); // 屋根
      ctx.fillStyle = night ? "#31406b" : "#efe9da";
      ctx.fillRect(x + 12, HORIZON - 22, 26, 12); // 壁
      ctx.fillStyle = night ? "#ffd84d" : "#8fa3c4";
      ctx.fillRect(x + 16, HORIZON - 18, 4, 4); // 窓
    });
  } else if (biome === "kouen") {
    // 丸い木＋ときどき街灯（夜は点灯）
    worldCols(phase, 30, (wx, x) => {
      const ti = Math.round(wx / 30);
      if (hash(ti * 13) % 4 === 0) {
        // 街灯
        ctx.fillStyle = night ? "#3a4462" : "#8f96a6";
        ctx.fillRect(x + 13, HORIZON - 26, 3, 26);
        ctx.fillStyle = night ? "#ffd84d" : "#d9dee8";
        ctx.fillRect(x + 10, HORIZON - 30, 9, 5);
        if (night) {
          ctx.fillStyle = "rgba(255,216,77,0.18)";
          ctx.fillRect(x + 4, HORIZON - 28, 21, 16);
        }
      } else {
        const h = 20 + (hash(ti * 7) % 8);
        ctx.fillStyle = night ? "#2a2317" : "#8a6039";
        ctx.fillRect(x + 12, HORIZON - 8, 5, 8); // 幹
        ctx.fillStyle = night ? "#1e3a2c" : hash(ti) % 2 ? "#57a05a" : "#6fb268";
        ctx.fillRect(x + 4, HORIZON - h, 21, h - 10); // まるい樹冠（角ばり8bit）
        ctx.fillRect(x + 8, HORIZON - h - 4, 13, 6);
      }
    });
  } else if (biome === "doukutsu") {
    // 奥の岩層＋たいまつ（炎はframeで揺れる）＋水晶の群れ
    ctx.fillStyle = night ? "#252038" : CAVE.wallDark;
    worldCols(phase, 8, (wx, x) => {
      const h = 16 + hillY(wx, 27, 8, 30);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    worldCols(phase, 88, (wx, x) => {
      const cell = Math.round(wx / 88);
      if (hash(cell * 23) % 3 === 0) {
        // たいまつ
        ctx.fillStyle = "#8a6039";
        ctx.fillRect(x + 20, HORIZON - 22, 3, 12);
        ctx.fillStyle = frame % 2 ? "#ff8c2e" : "#ffb347";
        ctx.fillRect(x + 18, HORIZON - 28, 7, 7);
        ctx.fillStyle = frame % 2 ? "#ffd84d" : "#ff8c2e";
        ctx.fillRect(x + 20, HORIZON - 26, 3, 3);
        ctx.fillStyle = "rgba(255,150,60,0.14)";
        ctx.fillRect(x + 8, HORIZON - 38, 27, 30);
      } else if (hash(cell * 29) % 4 === 0) {
        // 水晶の群れ（またたき）
        ctx.fillStyle = "#4db8b0";
        ctx.fillRect(x + 30, HORIZON - 10, 4, 10);
        ctx.fillRect(x + 35, HORIZON - 7, 3, 7);
        ctx.fillStyle = (cell + frame) % 2 ? "#79e0d8" : "#4db8b0";
        ctx.fillRect(x + 31, HORIZON - 9, 2, 5);
      }
    });
  } else if (biome === "tou") {
    // 壁ぎわの調度: たいまつ＋垂れ旗＋柱
    worldCols(phase, 72, (wx, x) => {
      const cell = Math.round(wx / 72);
      const kind = hash(cell * 31) % 3;
      if (kind === 0) {
        // 垂れ旗
        ctx.fillStyle = night ? "#7c2c3c" : "#c94b5e";
        ctx.fillRect(x + 28, HORIZON - 44, 12, 26);
        ctx.fillRect(x + 30, HORIZON - 18, 8, 4);
        ctx.fillStyle = TOWER.gold;
        ctx.fillRect(x + 28, HORIZON - 44, 12, 2);
        ctx.fillRect(x + 32, HORIZON - 34, 4, 4); // 紋章
      } else if (kind === 1) {
        // たいまつ
        ctx.fillStyle = "#8a6039";
        ctx.fillRect(x + 33, HORIZON - 30, 3, 12);
        ctx.fillStyle = frame % 2 ? "#ff8c2e" : "#ffb347";
        ctx.fillRect(x + 31, HORIZON - 36, 7, 7);
        ctx.fillStyle = "rgba(255,150,60,0.14)";
        ctx.fillRect(x + 21, HORIZON - 46, 27, 30);
      } else {
        // 柱
        ctx.fillStyle = night ? TOWER.brickN : TOWER.brick;
        ctx.fillRect(x + 30, 0, 10, HORIZON);
        ctx.fillStyle = night ? "#2c3350" : "#595f78";
        ctx.fillRect(x + 30, 0, 2, HORIZON);
      }
    });
  } else if (biome === "kazan") {
    // 溶岩の川（川面と同じ構造・色ちがい）＋のぼる火の粉
    ctx.fillStyle = "#5c1610";
    ctx.fillRect(0, HORIZON - 4, W, 4);
    ctx.fillStyle = "#ff7a2e";
    ctx.fillRect(0, HORIZON, W, 14);
    ctx.fillStyle = "#d9531e";
    ctx.fillRect(0, HORIZON + 10, W, 4);
    const P = W + 40;
    for (let i = 0; i < 18; i++) {
      const x = ((((hash(i * 17) % P) - phase * 1.4) % P) + P) % P - 20;
      ctx.fillStyle = (i + frame) % 2 === 0 ? "#ffd75e" : "#ffb347";
      ctx.fillRect(Math.round(x), HORIZON + 2 + (hash(i * 23) % 9), 5, 2);
    }
    for (let i = 0; i < 8; i++) {
      const ex = (hash(i * 31) % W | 0);
      const ey = HORIZON - ((nowSec * 22 + i * 17) % 70);
      ctx.fillStyle = i % 2 ? "#ffb347" : "#ff5a2e";
      ctx.fillRect(ex, Math.round(ey), 1, 2);
    }
  } else if (biome === "makai") {
    // 骨のとげ＋ふよふよ漂う鬼火
    worldCols(phase, 34, (wx, x) => {
      const cell = Math.round(wx / 34);
      if (hash(cell * 3) % 3 !== 0) return;
      ctx.fillStyle = "#d8cfc0";
      const h = 8 + (hash(cell * 7) % 8);
      for (let s = 0; s < h; s += 2) ctx.fillRect(x + 14 + (s > h / 2 ? 1 : 0), HORIZON - s, 3 - (s > h - 4 ? 1 : 0), 2);
    });
    for (let i = 0; i < 4; i++) {
      const wxr = (hash(i * 43) % (W + 60)) - 30;
      const y = 60 + Math.round(Math.sin(nowSec * 1.2 + i * 2) * 5) - i * 8;
      ctx.fillStyle = "rgba(159,224,122,0.16)";
      ctx.fillRect(wxr - 2, y - 2, 7, 7);
      ctx.fillStyle = "#9fe07a";
      ctx.fillRect(wxr, y, 3, 3);
      ctx.fillStyle = "#e0ffc0";
      ctx.fillRect(wxr + 1, y + 1, 1, 1);
    }
  } else if (biome === "ikuukan") {
    // さかさまの扉と浮かぶ環
    worldCols(phase, 110, (wx, x) => {
      const cell = Math.round(wx / 110);
      const bob = Math.round(Math.sin(nowSec * 0.8 + cell) * 3);
      if (hash(cell * 9) % 2 === 0) {
        ctx.fillStyle = "#1c1c30";
        ctx.fillRect(x + 40, 40 + bob, 14, 24);
        ctx.strokeStyle = "#5af0ff";
        ctx.strokeRect(x + 40.5, 40.5 + bob, 13, 23);
        ctx.fillStyle = "#5af0ff";
        ctx.fillRect(x + 43, 52 + bob, 2, 2);
      } else {
        ctx.strokeStyle = "#ff5ad0";
        ctx.strokeRect(x + 42.5, 56.5 - bob, 18, 6);
      }
    });
  } else if (biome === "sekaiju") {
    // 根のうねり＋のぼる光の胞子
    ctx.fillStyle = "#241812";
    worldCols(phase, 8, (wx, x) => {
      const h = 8 + hillY(wx, 97, 5, 20);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    for (let i = 0; i < 9; i++) {
      const mx = (hash(i * 29) % W | 0);
      const my = HORIZON - ((nowSec * 12 + i * 23) % 100);
      ctx.fillStyle = "#a8ffcf";
      ctx.fillRect(mx, Math.round(my), 1, 1);
      if (i % 3 === 0) {
        ctx.fillStyle = "rgba(138,240,180,0.2)";
        ctx.fillRect(mx - 1, Math.round(my) - 1, 3, 3);
      }
    }
  } else if (biome === "uchuu") {
    // 遠くのクレーター丘＋ときどき流れる人工衛星
    ctx.fillStyle = "#3a3a44";
    worldCols(phase, 8, (wx, x) => {
      const h = 10 + hillY(wx, 53, 6, 34);
      ctx.fillRect(x, HORIZON - h, 8, h);
    });
    const t = nowSec % 14;
    if (t < 2.2) {
      const sxx = t * 190 - 40;
      const syy = 26 + t * 16;
      ctx.fillStyle = "#e8ecff";
      ctx.fillRect(Math.round(sxx), Math.round(syy), 4, 2);
      ctx.fillStyle = "#8a8fb0";
      ctx.fillRect(Math.round(sxx) - 6, Math.round(syy), 5, 1);
    }
  } else if (biome === "kaichuu") {
    // ゆらめく海藻＋泳ぐ魚＋のぼる泡
    worldCols(phase, 26, (wx, x) => {
      const cell = Math.round(wx / 26);
      if (hash(cell * 3) % 2 !== 0) return;
      ctx.fillStyle = hash(cell) % 2 ? "#2f9e5a" : "#3aa864";
      for (let s = 0; s < 5; s++) {
        const sway = Math.round(Math.sin(nowSec * 1.5 + s + cell) * 2);
        ctx.fillRect(x + 12 + sway, HORIZON - 6 - s * 5, 4, 6);
      }
    });
    const FISH = [
      { y: 34, c: "#ff9a3e", sp: 26, off: 0 },
      { y: 52, c: "#ffd75e", sp: 20, off: 130 },
      { y: 66, c: "#6fd8c9", sp: 32, off: 240 },
      { y: 44, c: "#ff9a3e", sp: 17, off: 320 },
    ];
    for (const f of FISH) {
      const P2 = W + 60;
      const fx = P2 - ((nowSec * f.sp + f.off) % P2) - 30;
      const fy = f.y + Math.round(Math.sin(nowSec * 2 + f.off) * 2);
      ctx.fillStyle = f.c;
      ctx.fillRect(Math.round(fx), fy, 8, 3);
      ctx.fillRect(Math.round(fx) + 8, fy - 1, 2, 5);
      ctx.fillStyle = INK;
      ctx.fillRect(Math.round(fx) + 1, fy + 1, 1, 1);
    }
    for (let i = 0; i < 7; i++) {
      const bx = (hash(i * 37) % W | 0) + Math.round(Math.sin(nowSec * 2 + i) * 2);
      const by = H - ((nowSec * 26 + i * 31) % (H + 10));
      ctx.fillStyle = "rgba(191,228,255,0.8)";
      ctx.fillRect(bx, Math.round(by), 2, 2);
    }
  } else if (biome === "shinkai") {
    // マリンスノー＋チョウチンアンコウ＋クラゲ＋リュウグウノツカイ
    for (let i = 0; i < 16; i++) {
      const mx = (hash(i * 13) % W | 0);
      const my = ((nowSec * 7 + hash(i * 7) % 90) % (H + 6)) - 3;
      ctx.fillStyle = i % 3 ? "rgba(200,215,235,0.28)" : "rgba(200,215,235,0.55)";
      ctx.fillRect(mx, Math.round(my), 1, 1);
    }
    const ax = 200 + Math.round(Math.sin(nowSec * 0.4) * 26);
    const ay = 44 + Math.round(Math.sin(nowSec * 0.9) * 5);
    const glow = Math.floor(nowSec * 2) % 2 === 0;
    if (glow) {
      ctx.fillStyle = "rgba(174,240,255,0.16)";
      ctx.fillRect(ax + 8, ay - 14, 12, 12);
    }
    ctx.fillStyle = "#2a3644";
    ctx.fillRect(ax, ay, 16, 9);
    ctx.fillRect(ax + 15, ay + 2, 4, 5);
    ctx.fillRect(ax - 3, ay + 2, 3, 5);
    ctx.fillStyle = "#0e1620";
    ctx.fillRect(ax + 2, ay + 6, 11, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(ax + 3, ay + 6, 1, 2);
    ctx.fillRect(ax + 6, ay + 6, 1, 2);
    ctx.fillRect(ax + 9, ay + 6, 1, 2);
    ctx.fillStyle = "#e8f4ff";
    ctx.fillRect(ax + 3, ay + 2, 2, 2);
    ctx.fillStyle = "#4a5866";
    ctx.fillRect(ax + 10, ay - 5, 1, 5);
    ctx.fillStyle = glow ? "#aef0ff" : "#7ac4e0";
    ctx.fillRect(ax + 9, ay - 9, 3, 4);
    const jy = H - ((nowSec * 9) % (H + 30));
    ctx.fillStyle = "rgba(120,150,220,0.35)";
    ctx.fillRect(60, Math.round(jy), 10, 5);
    ctx.fillRect(61, Math.round(jy) + 5, 1, 6);
    ctx.fillRect(64, Math.round(jy) + 5, 1, 7);
    ctx.fillRect(68, Math.round(jy) + 5, 1, 6);
    const ox = W + 40 - ((nowSec * 11) % (W + 120));
    ctx.fillStyle = "#c8ccd8";
    ctx.fillRect(Math.round(ox), 16, 30, 2);
    ctx.fillStyle = "#e86a7a";
    ctx.fillRect(Math.round(ox) + 2, 14, 24, 1);
    ctx.fillStyle = "#e8ecf4";
    ctx.fillRect(Math.round(ox) + 28, 15, 3, 4);
  } else if (biome === "yukiyama") {
    // 雪をかぶったモミの木
    worldCols(phase, 26, (wx, x) => {
      const ti = Math.round(wx / 26);
      const h = 22 + (hash(ti * 7) % 10);
      ctx.fillStyle = hash(ti) % 2 ? "#2a5a3e" : "#33654a";
      for (let s = 0; s < 4; s++) {
        const w2 = 4 + s * 4;
        ctx.fillRect(x + 12 - w2 / 2, HORIZON - h + s * (h / 5), w2, h / 5 + 1);
      }
      ctx.fillStyle = "#f4f8fb";
      for (let s = 0; s < 3; s++) {
        const w2 = 3 + s * 4;
        ctx.fillRect(x + 12 - w2 / 2, HORIZON - h + s * (h / 5), w2, 2);
      }
      ctx.fillStyle = "#4a3a28";
      ctx.fillRect(x + 10, HORIZON - 6, 4, 6);
    });
  } else if (biome === "cherick") {
    // 白いまるい家＋青緑のふしぎな木
    worldCols(phase, 64, (wx, x) => {
      const cell = Math.round(wx / 64);
      const kind = hash(cell * 7) % 3;
      if (kind === 0) {
        ctx.fillStyle = "#e8ecea";
        ctx.fillRect(x + 18, HORIZON - 24, 18, 24);
        ctx.fillStyle = "#f6f8f7";
        ctx.fillRect(x + 20, HORIZON - 29, 14, 6);
        ctx.fillRect(x + 24, HORIZON - 33, 6, 5);
        ctx.fillStyle = "#3a6a8a";
        ctx.fillRect(x + 22, HORIZON - 18, 4, 5);
        ctx.fillRect(x + 29, HORIZON - 14, 4, 5);
      } else if (kind === 1) {
        ctx.fillStyle = "#d8d4c0";
        ctx.fillRect(x + 26, HORIZON - 16, 4, 16);
        ctx.fillStyle = "#2e8f88";
        ctx.fillRect(x + 17, HORIZON - 30, 22, 15);
        ctx.fillStyle = "#3aa8a0";
        ctx.fillRect(x + 21, HORIZON - 34, 14, 8);
        ctx.fillStyle = "#5ec4bc";
        ctx.fillRect(x + 24, HORIZON - 32, 7, 4);
      }
    });
  } else {
    // 針葉樹の列（22pxのワールド格子に固定）
    worldCols(phase, 22, (wx, x) => {
      const ti = Math.round(wx / 22);
      const h = 22 + (hash(ti * 7) % 12);
      ctx.fillStyle = night ? "#1e3a2c" : hash(ti) % 2 ? "#3f7043" : "#487d3a";
      // 三角形を段々で
      for (let s = 0; s < 4; s++) {
        const w2 = 4 + s * 4;
        ctx.fillRect(x + 10 - w2 / 2, HORIZON - h + s * (h / 5), w2, h / 5 + 1);
      }
      ctx.fillStyle = night ? "#2a2317" : "#8a6039";
      ctx.fillRect(x + 8, HORIZON - 6, 4, 6);
    });
  }
}

// ---------------------------------------------------------------------------
// 地面（ワールド座標固定・8px列ごとにビオーム判定＝境界が自然に流れてくる）
// ---------------------------------------------------------------------------

// ベース面が「一色＋ちらし」で足りる新ビオーム（自光する世界なので昼夜同色。夜はDOM暗幕が乗る）
const SIMPLE_GROUND: Partial<
  Record<BiomeId, { b1: string; b2: string; acc: string }>
> = {
  kazan: { b1: "#241014", b2: "#1c0e10", acc: "#ff7a2e" },
  makai: { b1: "#1a0f24", b2: "#150c1e", acc: "#d8cfc0" },
  sekaiju: { b1: "#1e3a2a", b2: "#1a3325", acc: "#46d68a" },
  uchuu: { b1: "#7a7a85", b2: "#70707c", acc: "#5f5f6a" },
  kaichuu: { b1: "#d8c07a", b2: "#cdb670", acc: "#f7a8b8" },
  shinkai: { b1: "#0e1a2c", b2: "#0a1424", acc: "#24405e" },
  yukiyama: { b1: "#eef3f7", b2: "#e6edf3", acc: "#ffffff" },
  cherick: { b1: "#4a8fd8", b2: "#3f7fc9", acc: "#2e68b0" },
};

// 道の帯の色（未登録ビオームは土 or 舗装のデフォルト）
const PATH_STYLE: Partial<Record<BiomeId, { light: string; dark: string; edge: string }>> = {
  kazan: { light: "#3a2a2c", dark: "#2e2022", edge: "#1c1214" },
  makai: { light: "#2a1a38", dark: "#221430", edge: "#150c1e" },
  ikuukan: { light: "#14142a", dark: "#0e0e20", edge: "#5af0ff" },
  sekaiju: { light: "#4a3a2a", dark: "#3e3022", edge: "#2a2014" },
  uchuu: { light: "#8a8a95", dark: "#7e7e8a", edge: "#5f5f6a" },
  kaichuu: { light: "#e5d08c", dark: "#d8c07a", edge: "#b09a58" },
  shinkai: { light: "#16243a", dark: "#101c30", edge: "#0a1424" },
  yukiyama: { light: "#dde8f0", dark: "#d0dde8", edge: "#b8c9d6" },
  cherick: { light: "#d9cf9a", dark: "#cdc28c", edge: "#a89e6a" },
};

// 道の下の前景フチ
const FRONT_EDGE: Partial<Record<BiomeId, string>> = {
  kazan: "#160a0c",
  makai: "#120a1a",
  ikuukan: "#0a0a16",
  sekaiju: "#152a1e",
  uchuu: "#5f5f6a",
  kaichuu: "#b09a58",
  shinkai: "#081020",
  yukiyama: "#c9d8e2",
  cherick: "#2e68b0",
};

export function drawGround(
  ctx: CanvasRenderingContext2D,
  sx: number,
  time: TimeBucket
) {
  const night = time === "night";
  // 模様は全てワールド格子（整数wx）で決め、画面をなめらかに滑らせる。
  // 画面格子に描くと8pxごとに模様が再抽選されて全面が点滅する
  worldCols(sx, 8, (wx, x) => {
    const b = biomeAt(wx);
    // 上段（地面のベース: 草 or 舗装 or 石原）
    if (b === "machi") {
      ctx.fillStyle = night ? "#565e73" : PAVE.dark;
      ctx.fillRect(x, HORIZON, 8, PATH_TOP - HORIZON);
    } else if (b === "kawara") {
      ctx.fillStyle = night ? "#4c5568" : "#b9bdc9";
      ctx.fillRect(x, HORIZON + 28, 8, PATH_TOP - HORIZON - 28);
      ctx.fillStyle = night ? "#3d5a52" : GRASS.dark;
      ctx.fillRect(x, HORIZON, 8, 28); // 川面(mid)との間の草
      if (hash(wx >> 3) % 4 === 0) {
        ctx.fillStyle = night ? "#5a6377" : "#cfd3dd";
        ctx.fillRect(x + 2, HORIZON + 32 + (hash(wx) % 6), 4, 3);
      }
    } else if (b === "doukutsu") {
      // 岩床＋石筍・岩くず
      ctx.fillStyle = night ? CAVE.floorDark : CAVE.floor;
      ctx.fillRect(x, HORIZON, 8, PATH_TOP - HORIZON);
      if (hash(wx >> 3) % 5 === 0) {
        ctx.fillStyle = night ? "#3a3450" : CAVE.rock;
        ctx.fillRect(x + 2, HORIZON + 4 + (hash(wx) % 20), 4, 4);
      }
    } else if (b === "tou") {
      // 石タイルの床＋目地
      ctx.fillStyle = night ? TOWER.floorN : TOWER.floor;
      ctx.fillRect(x, HORIZON, 8, PATH_TOP - HORIZON);
      if ((wx >> 3) % 3 === 0) {
        ctx.fillStyle = night ? TOWER.floorDarkN : TOWER.floorDark;
        ctx.fillRect(x, HORIZON + 8 + (hash(wx >> 3) % 16), 8, 2);
      }
    } else if (b === "ikuukan") {
      // 市松もようの床
      for (let y = HORIZON; y < PATH_TOP; y += 8) {
        ctx.fillStyle = ((wx >> 3) + ((y - HORIZON) >> 3)) % 2 ? "#181832" : "#0c0c1c";
        ctx.fillRect(x, y, 8, Math.min(8, PATH_TOP - y));
      }
    } else if (SIMPLE_GROUND[b]) {
      const g = SIMPLE_GROUND[b]!;
      ctx.fillStyle = hash(wx >> 3) % 2 ? g.b1 : g.b2;
      ctx.fillRect(x, HORIZON, 8, PATH_TOP - HORIZON);
      if (hash(wx >> 3) % 5 === 0) {
        ctx.fillStyle = g.acc;
        ctx.fillRect(x + 2, HORIZON + 6 + (hash(wx * 3) % 24), 4, 3);
      }
    } else {
      ctx.fillStyle = night
        ? hash(wx >> 3) % 2
          ? "#33513a"
          : "#2f4a33"
        : hash(wx >> 3) % 2
          ? GRASS.light
          : GRASS.dark;
      ctx.fillRect(x, HORIZON, 8, PATH_TOP - HORIZON);
      // 草むらのアクセント
      if (hash(wx >> 3) % 5 === 0) {
        ctx.fillStyle = night ? "#3d6647" : GRASS.deep;
        ctx.fillRect(x + 2, HORIZON + 6 + (hash(wx * 3) % 24), 4, 3);
      }
    }

    // 道（共通の帯。街中は舗装・塔は赤じゅうたん・洞窟は石の道）
    const pave = b === "machi";
    if (b === "tou") {
      ctx.fillStyle = night ? TOWER.carpetN : TOWER.carpet;
      ctx.fillRect(x, PATH_TOP, 8, PATH_BOT - PATH_TOP);
      ctx.fillStyle = night ? "#6a2434" : TOWER.carpetDark;
      if (hash(wx >> 3) % 3 === 0)
        ctx.fillRect(x + 2, PATH_TOP + 8 + (hash(wx) % 10), 4, 2);
      ctx.fillStyle = TOWER.gold; // 金の縁どり
      ctx.fillRect(x, PATH_TOP, 8, 2);
      ctx.fillRect(x, PATH_BOT - 2, 8, 2);
    } else if (b === "doukutsu") {
      ctx.fillStyle = night ? CAVE.pathDark : CAVE.path;
      ctx.fillRect(x, PATH_TOP, 8, PATH_BOT - PATH_TOP);
      ctx.fillStyle = night ? "#4e4760" : "#5e566e";
      if (hash(wx >> 3) % 3 === 0)
        ctx.fillRect(x + 2, PATH_TOP + 8 + (hash(wx) % 10), 4, 2);
      ctx.fillStyle = CAVE.edge;
      ctx.fillRect(x, PATH_TOP, 8, 2);
      ctx.fillRect(x, PATH_BOT - 2, 8, 2);
    } else if (PATH_STYLE[b]) {
      const stl = PATH_STYLE[b]!;
      ctx.fillStyle = stl.light;
      ctx.fillRect(x, PATH_TOP, 8, PATH_BOT - PATH_TOP);
      ctx.fillStyle = stl.dark;
      if (hash(wx >> 3) % 3 === 0)
        ctx.fillRect(x + 2, PATH_TOP + 8 + (hash(wx) % 10), 4, 2);
      ctx.fillStyle = stl.edge;
      ctx.fillRect(x, PATH_TOP, 8, 2);
      ctx.fillRect(x, PATH_BOT - 2, 8, 2);
    } else {
      ctx.fillStyle = pave
        ? night
          ? "#6a7186"
          : PAVE.light
        : night
          ? "#6e5b3f"
          : DIRT.light;
      ctx.fillRect(x, PATH_TOP, 8, PATH_BOT - PATH_TOP);
      ctx.fillStyle = pave
        ? night
          ? "#565e73"
          : PAVE.dark
        : night
          ? "#5d4c34"
          : DIRT.dark;
      if (hash(wx >> 3) % 3 === 0) ctx.fillRect(x + 2, PATH_TOP + 8 + (hash(wx) % 10), 4, 2);
      // 道の縁
      ctx.fillStyle = pave ? PAVE.edge : DIRT.edge;
      ctx.fillRect(x, PATH_TOP, 8, 2);
      ctx.fillRect(x, PATH_BOT - 2, 8, 2);
    }

    // 道の下の前景フチ
    if (b === "machi") ctx.fillStyle = night ? "#454c5e" : PAVE.edge;
    else if (b === "doukutsu") ctx.fillStyle = night ? "#241f33" : "#3a3450";
    else if (b === "tou") ctx.fillStyle = night ? "#3a415c" : "#7c8199";
    else if (FRONT_EDGE[b]) ctx.fillStyle = FRONT_EDGE[b]!;
    else ctx.fillStyle = night ? "#24382a" : GRASS.deep;
    ctx.fillRect(x, PATH_BOT, 8, H - PATH_BOT);

    // 横断歩道（街中・320ごと）
    if (pave && wx % 320 < 32 && (wx >> 3) % 2 === 0) {
      ctx.fillStyle = night ? "#aeb4c4" : "#eef1f6";
      ctx.fillRect(x + 1, PATH_TOP + 4, 6, PATH_BOT - PATH_TOP - 8);
    }
    // ガードレール（堤防・道の上側）
    if (b === "teibo") {
      ctx.fillStyle = night ? "#8b94a8" : "#e5eaf2";
      ctx.fillRect(x, PATH_TOP - 8, 8, 3);
      if (wx % 32 < 8) {
        ctx.fillRect(x + 3, PATH_TOP - 8, 3, 8);
      }
    }
    // 山道の木の根・石
    if (b === "yama" && hash(wx >> 3) % 6 === 0) {
      ctx.fillStyle = night ? "#4a3b28" : "#8a6039";
      ctx.fillRect(x + 1, PATH_TOP + 3 + (hash(wx * 7) % 12), 6, 2);
    }
    // 田舎道: 用水路のすじ
    if (b === "inaka" && hash(wx >> 3) % 7 === 0) {
      ctx.fillStyle = night ? "#27427a" : "#a8cbe0";
      ctx.fillRect(x, HORIZON + 18 + (hash(wx * 5) % 8), 8, 3);
    }
    // 公園: 生け垣（道の上側）
    if (b === "kouen") {
      ctx.fillStyle = night ? "#1e3a2c" : "#4e8f4a";
      ctx.fillRect(x, PATH_TOP - 6, 8, 4);
      if (hash(wx >> 3) % 3 === 0) {
        ctx.fillStyle = night ? "#2a4a38" : "#5fa356";
        ctx.fillRect(x + 2, PATH_TOP - 7, 4, 2);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// プロップ配置（ビオーム区間ごとに決定的生成）とイベント
// ---------------------------------------------------------------------------

export type WalkEvent = {
  id: string;
  lines: string[];
  /** ふれると拾えるカギアイテム（items.ts の id）。付与判定はサーバー側 */
  item?: string;
};

export type PropInstance = {
  worldX: number;
  sprite: string;
  /** 足元のy（この位置にスプライトの下端を合わせる） */
  footY: number;
  event?: WalkEvent;
  /** イベント消化済みフラグ（canvas側で立てる） */
  done?: boolean;
};

const EVENTS: Record<string, WalkEvent> = {
  cat: {
    id: "cat",
    lines: [
      "…ねこさんだ。ねこさんも さんぽかな。",
      "ねこさん、こんにちは。……つーん とされた。",
      "しっぽ、ゆらゆらしてる。ごきげんかな。",
    ],
  },
  vending: {
    id: "vending",
    lines: [
      "じはんき みっけ。なに のむ？",
      "つめたいの と あったかいの、どっちに する？",
      "あたり つきの じはんき だったら いいのに。",
    ],
  },
  bench: {
    id: "bench",
    lines: [
      "ベンチだ。ちょっとだけ すわってこ。",
      "ここ、いい ばしょだね。おぼえておこ。",
      "ベンチは さんぽの スパイス だからね。",
    ],
  },
  rock: {
    id: "rock",
    lines: [
      "おおきな いし。……のぼりたい。",
      "いしに さわると ひんやり するね。",
      "この いし、なんねん ここに いるんだろ。",
    ],
  },
  signpost: {
    id: "signpost",
    lines: [
      "みちしるべ だ。まだまだ いけるね。",
      "つぎは どんな けしき かな。",
      "みちしるべさん、いつも ありがとね。",
    ],
  },
  batta: {
    id: "batta",
    lines: [
      "バッタ！ こんどこそ……あ、とんだ。",
      "バッタさんの ジャンプ、ぼくより すごい。",
      "しゅんかんいどう みたいだったね、いまの。",
    ],
  },
  kaeru: {
    id: "kaeru",
    lines: [
      "カエルさんだ。せんぱい、こんにちは。",
      "けろっ て いった！ おへんじ かな。",
      "みずべの ちかくには カエルさんが いるんだね。",
    ],
  },
  hato: {
    id: "hato",
    lines: [
      "ハトさんたちの かいぎに おじゃましちゃった。",
      "くるっくー。……いま、ぼくが いったの。",
      "ハトさん、なに たべてるの？ ……みせてくれない。",
    ],
  },
  koumori: {
    id: "koumori",
    lines: [
      "こうもりさん、さかさまで ねてる。ねやすいのかな。",
      "しーっ。おきちゃうから、そーっとね。",
      "はねの おとが ぱさぱさ って きこえた。",
    ],
  },
  crystal: {
    id: "crystal",
    lines: [
      "すいしょうの なかに ひかりが とじこめられてる みたい。",
      "みみを あてると……なにか きこえる ような。",
      "ひとかけら ほしいけど、ここの かざり だもんね。",
    ],
  },
  slime: {
    id: "slime",
    lines: [
      "スライムだ！ ぷにぷに してそう。",
      "スライムさんも おさんぽちゅう かな。",
      "つつくと ぷるん って した。……たのしい。",
    ],
  },
  sekihi: {
    id: "sekihi",
    lines: [
      "いしぶみが ひかってる。こだいの もじだ。",
      "『……よくきた……』って よめた きがする。",
      "なでたら もっと ひかった。よろこんでる？",
    ],
  },
  kakashi: {
    id: "kakashi",
    lines: [
      "かかしさん、きょうも みはり おつかれさま。",
      "かかしさんの ぼうし、ちょっと ほしい。",
      "とりと なかよく なっちゃう かかしさんも いるらしい。",
    ],
  },
  hanbai: {
    id: "hanbai",
    item: "moguri-omamori",
    lines: [
      "むじんはんばいじょ。やさいが ぴかぴかだ。",
      "おかね ここに いれるんだね。しょうじきばこ。",
      "……あれ？ なにか おまけが おいてある。",
    ],
  },
  suberidai: {
    id: "suberidai",
    lines: [
      "すべりだい、いっかいだけ……だめ？",
      "のぼって、しゅーっ。……そうぞうだけで たのしい。",
      "よるの すべりだいは ちょっと つめたいらしいよ。",
    ],
  },
  chest: {
    id: "chest",
    item: "rocket-key",
    lines: [
      "たからばこ！ あけても いい よね…？",
      "ぎぃ……。なにか はいってる！",
      "たからばこの ふた、ぼくの ちからで あいた！",
    ],
  },
  iwa_yama: {
    id: "iwa_yama",
    item: "yukigutsu",
    lines: [
      "やまの いわの すきまに、なにか ある…？",
      "いわの うら、ひんやりしてる。……ん？",
      "こんな ところに なにか かくして ある。",
    ],
  },
  kanketsusen: {
    id: "kanketsusen",
    lines: [
      "じめんから ゆげが……でるぞ でるぞ。",
      "しゅぼーん！ って でた！ すごい！",
      "ちきゅうの くしゃみ みたいだね。",
    ],
  },
  shounin: {
    id: "shounin",
    item: "midori-chizu",
    lines: [
      "……いらっしゃい、って いわれた。あやしい。でも わるいひと じゃなさそう。",
      "フードの おくで めが ひかってる…。",
      "『とおい ほしの ちず、もっていきな』 だって。",
    ],
  },
  zukei: {
    id: "zukei",
    lines: [
      "この いしぶみ……よめない もじ。ここの ことば？",
      "さわると ぞわっと した。でも いやじゃない。",
      "『▲◆●※？』……なんて？",
    ],
  },
  kinomi: {
    id: "kinomi",
    lines: [
      "ひかる み！ せかいじゅの おくりもの かな。",
      "あったかい ひかり。てのひらが ぽかぽか する。",
      "たべたら だめな きがする。ながめるだけ。",
    ],
  },
  gyogun: {
    id: "gyogun",
    item: "shinkai-suzu",
    lines: [
      "サンゴの まわりに おさかな いっぱい！",
      "うわ、さかなの むれに かこまれた！ くすぐったい！",
      "むれの まんなかで、すずの おとが した…？",
    ],
  },
  ugokuiwa: {
    id: "ugokuiwa",
    lines: [
      "いわ……と おもったら、うごいた！？",
      "しんかいの いきものは、いわの ふりが とくい。",
      "めが あった。……おじゃましました。",
    ],
  },
  yukidaruma: {
    id: "yukidaruma",
    lines: [
      "ゆきだるまさん、こんにちは。さむくない？",
      "バケツの ぼうし、にあってるね。",
      "よこに ちいさい ゆきだるま つくって あげよ。",
    ],
  },
  seijin: {
    id: "seijin",
    lines: [
      "この ほしの ひとだ！ ……ちょっと ぼくに にてる？",
      "『ケロ？』……ことば、つうじてる きがする！",
      "おみやげに はっぱを くれた。ありがとう！",
    ],
  },
};

// ---------------------------------------------------------------------------
// 環境イベント（プロップではなく空や道で起きる。発火は walk-canvas のタイマー）
// ---------------------------------------------------------------------------

const OUTDOOR: BiomeId[] = ["kusahara", "teibo", "kawara", "machi", "yama", "inaka", "kouen"];

export type AmbientEvent = {
  id: string;
  lines: string[];
  /** 出る時間帯（未指定=いつでも） */
  time?: TimeBucket[];
  /** 出る天気（未指定=どの天気でも） */
  weather?: WeatherBucket[];
  /** 出るビオーム */
  biomes: BiomeId[];
  /** ペットが立ち止まって眺める */
  pause?: boolean;
};

export const AMBIENT_EVENTS: AmbientEvent[] = [
  {
    id: "ryuusei",
    time: ["night"],
    weather: ["clear", "cloudy"],
    biomes: OUTDOOR,
    pause: true,
    lines: [
      "あ！ ながれぼし！ ……ねがいごと、まにあった？",
      "ほしが ながれた…。いまの、ふたりで みたね。",
      "ながれぼしって、どこに おちるんだろうね。",
    ],
  },
  {
    id: "eisei",
    biomes: ["uchuu"],
    pause: true,
    lines: [
      "みて、なにか とんでった！ じんこうえいせい かな。",
      "うちゅうでは ほしが ながれるんじゃ なくて はしるんだね。",
    ],
  },
  {
    id: "niji",
    weather: ["rain"],
    biomes: OUTDOOR,
    pause: true,
    lines: [
      "あめの むこうに にじ！ ななしょく かぞえよ。",
      "にじの ふもとには たからものが あるんだって。",
      "にじって、みつけた ひとの ものに なるらしいよ。",
    ],
  },
  {
    id: "yuuyake",
    time: ["evening"],
    weather: ["clear", "cloudy"],
    biomes: OUTDOOR,
    pause: true,
    lines: [
      "……ゆうやけ、きれいだね。ちょっとだけ みてこ。",
      "きょうの ゆうひは とくべつ きれいな きがする。",
    ],
  },
  {
    id: "kaminari",
    weather: ["storm"],
    biomes: OUTDOOR,
    pause: true,
    lines: [
      "ちょっと あまやどり……ならぬ かみなりやどり しよ。",
      "ごろごろさんが とおりすぎるまで、ここで まとう。",
    ],
  },
  {
    id: "asamoya",
    time: ["morning"],
    weather: ["fog"],
    biomes: OUTDOOR,
    pause: true,
    lines: [
      "あさもやの なか、せかいが まだ ねぼけてる。",
      "もやの むこうから あさが くるよ。",
    ],
  },
  {
    id: "inu",
    time: ["morning", "noon", "evening"],
    biomes: OUTDOOR,
    pause: true,
    lines: [
      "わんちゃんだ！ こんにちは！ ……いってしまった。",
      "いまの わんちゃん、しっぽ ふってくれた！",
      "わんちゃんも おさんぽちゅう だね。",
    ],
  },
  {
    id: "tori",
    time: ["morning", "noon", "evening"],
    weather: ["clear", "cloudy"],
    biomes: OUTDOOR,
    lines: [
      "とりの むれだ！ どこまで いくんだろう。",
      "ならんで とぶの、じょうずだねえ。",
      "みんなで とべば こわくない、のかな。",
    ],
  },
  {
    id: "hotaru",
    time: ["night"],
    biomes: ["kusahara", "kawara", "inaka"],
    pause: true,
    lines: [
      "ホタルだ…！ ひかりが ふわふわ してる。",
      "ホタルの ひかりは、れんあいの おてがみ なんだって。",
      "しずかに みよ。……きれいだねえ。",
    ],
  },
  {
    id: "chou",
    time: ["morning", "noon"],
    weather: ["clear", "cloudy"],
    biomes: ["kusahara", "kouen", "inaka"],
    lines: [
      "ちょうちょが ぼくの まわりを ひらひら〜。",
      "まって〜。……とまって くれた！",
      "はなの みつ、おいしいのかな。",
    ],
  },
];

/** ビオーム区間 seg（worldX/BIOME_LEN の整数）ごとのプロップ一覧を決定的に生成 */
export function propsForSegment(seg: number): PropInstance[] {
  const b = biomeForSeg(seg);
  const base = seg * BIOME_LEN;
  const out: PropInstance[] = [];
  const put = (sprite: string, worldX: number, footY: number, event?: WalkEvent) =>
    out.push({ worldX, sprite, footY, event });

  // 境界の道標（区間の頭）。たまにイベント化して ひとこと
  put("signpost", base + 24, PATH_TOP - 2, hash(seg * 71) % 3 === 0 ? EVENTS.signpost : undefined);

  // 飾りプロップを散らす
  for (let k = 0; k < 10; k++) {
    const x = base + 120 + ((hash(seg * 100 + k) % (BIOME_LEN - 240)) | 0);
    const r = hash(seg * 200 + k) % 100;
    if (b === "kusahara" && r < 55) put(r % 2 ? "flowerP" : "flowerW", x, PATH_TOP - 1);
    else if (b === "kawara" && r < 50) put("reed", x, PATH_TOP - 1);
    else if (b === "yama" && r < 40) put("rock", x, PATH_TOP - 1);
    else if (b === "machi" && r < 30) put("pole", x, PATH_TOP - 2);
    else if (b === "inaka" && r < 40) put(r % 3 === 0 ? "kakashi" : "pole", x, PATH_TOP - 2);
    else if (b === "kouen" && r < 50) put(r % 3 === 0 ? "lamp" : r % 2 ? "flowerP" : "flowerW", x, PATH_TOP - 1);
    else if (b === "doukutsu" && r < 45) put(r % 2 ? "crystal" : "rock", x, PATH_TOP - 1);
    else if (b === "tou" && r < 25) put("chest", x, PATH_TOP - 1);
    else if ((b === "kazan" || b === "uchuu" || b === "shinkai") && r < 35) put("rock", x, PATH_TOP - 1);
    else if (b === "makai" && r < 30) put("rock", x, PATH_TOP - 1);
    else if (b === "sekaiju" && r < 25) put("kinomi", x, PATH_TOP - 1);
    else if (b === "kaichuu" && r < 40) put("sango", x, PATH_TOP - 1);
    else if (b === "yukiyama" && r < 25) put("rock", x, PATH_TOP - 1);
    else if (b === "cherick" && r < 40) put(r % 2 ? "flowerP" : "flowerW", x, PATH_TOP - 1);
  }

  // イベントプロップ（1区間に最大1つ。通常60%・レア/特別ビオームは確定＝せっかく来たので）
  const er = hash(seg * 31) % 100;
  const guaranteed = RARE_BIOMES.includes(b) || SPECIAL_BIOMES.includes(b);
  if (er < 60 || guaranteed) {
    const x = base + 400 + (hash(seg * 57) % (BIOME_LEN - 700));
    const pick3 = hash(seg * 43) % 3;
    if (b === "kusahara") {
      if (pick3 === 0) put("batta", x, PATH_TOP - 1, EVENTS.batta);
      else put("bench", x, PATH_TOP - 1, EVENTS.bench);
    } else if (b === "teibo") {
      put(er % 2 ? "cat" : "rock", x, PATH_TOP - 1, er % 2 ? EVENTS.cat : EVENTS.rock);
    } else if (b === "kawara") {
      if (pick3 === 0) put("kaeru", x, PATH_TOP - 1, EVENTS.kaeru);
      else put(er % 2 ? "cat" : "rock", x, PATH_TOP - 1, er % 2 ? EVENTS.cat : EVENTS.rock);
    } else if (b === "machi") {
      if (pick3 === 0) put("hato", x, PATH_TOP - 1, EVENTS.hato);
      else put(er % 2 ? "vending" : "cat", x, PATH_TOP - 1, er % 2 ? EVENTS.vending : EVENTS.cat);
    } else if (b === "yama") {
      put("rock", x, PATH_TOP - 1, pick3 === 0 ? EVENTS.iwa_yama : EVENTS.rock);
    } else if (b === "doukutsu") {
      put(
        pick3 === 0 ? "koumori" : pick3 === 1 ? "crystal" : "rock",
        x,
        pick3 === 0 ? PATH_TOP - 20 : PATH_TOP - 1,
        pick3 === 0 ? EVENTS.koumori : pick3 === 1 ? EVENTS.crystal : EVENTS.rock
      );
    } else if (b === "tou") {
      put(
        pick3 === 0 ? "chest" : pick3 === 1 ? "slime" : "sekihi",
        x,
        PATH_TOP - 1,
        pick3 === 0 ? EVENTS.chest : pick3 === 1 ? EVENTS.slime : EVENTS.sekihi
      );
    } else if (b === "inaka") {
      put(
        pick3 === 0 ? "hanbai" : pick3 === 1 ? "kakashi" : "cat",
        x,
        PATH_TOP - 1,
        pick3 === 0 ? EVENTS.hanbai : pick3 === 1 ? EVENTS.kakashi : EVENTS.cat
      );
    } else if (b === "kouen") {
      put(
        pick3 === 0 ? "slide" : pick3 === 1 ? "hato" : "bench",
        x,
        PATH_TOP - 1,
        pick3 === 0 ? EVENTS.suberidai : pick3 === 1 ? EVENTS.hato : EVENTS.bench
      );
    } else if (b === "kazan") {
      put("geyser", x, PATH_TOP - 1, EVENTS.kanketsusen);
    } else if (b === "makai") {
      put("shounin", x, PATH_TOP - 1, EVENTS.shounin);
    } else if (b === "ikuukan") {
      put("sekihi", x, PATH_TOP - 1, EVENTS.zukei);
    } else if (b === "sekaiju") {
      put("kinomi", x, PATH_TOP - 1, EVENTS.kinomi);
    } else if (b === "uchuu") {
      put("rock", x, PATH_TOP - 1, EVENTS.rock);
    } else if (b === "kaichuu") {
      put("sango", x, PATH_TOP - 1, EVENTS.gyogun);
    } else if (b === "shinkai") {
      put("rock", x, PATH_TOP - 1, EVENTS.ugokuiwa);
    } else if (b === "yukiyama") {
      put("yukidaruma", x, PATH_TOP - 1, EVENTS.yukidaruma);
    } else if (b === "cherick") {
      put("seijin", x, PATH_TOP - 1, EVENTS.seijin);
    }
  }

  return out;
}

export function drawProp(ctx: CanvasRenderingContext2D, p: PropInstance, sx: number) {
  const spr = propSprite(p.sprite);
  const x = Math.round(p.worldX - sx);
  if (x < -spr.width || x > W + spr.width) return;
  ctx.drawImage(spr, x - Math.floor(spr.width / 2), p.footY - spr.height);
}

// ---------------------------------------------------------------------------
// 天気（粒で降らせる。世界の一番手前・吹き出しより奥）
// ---------------------------------------------------------------------------

/** 雨・雪・霧をパーティクルで描く。nowMs は実時間（落下アニメの位相に使う） */
export function drawWeather(
  ctx: CanvasRenderingContext2D,
  weather: WeatherBucket,
  nowMs: number
) {
  const t = nowMs / 1000;

  if (weather === "rain" || weather === "storm") {
    const storm = weather === "storm";
    const n = storm ? 130 : 85;
    const fall = storm ? 210 : 150; // px/s
    const wind = storm ? 46 : 26; // 左へ流される
    ctx.fillStyle = storm ? "rgba(210,225,250,0.75)" : "rgba(205,225,250,0.6)";
    for (let i = 0; i < n; i++) {
      const seed = hash(i * 31);
      const y = ((seed >> 4) % (H + 10)) + t * fall;
      const yy = (y % (H + 10)) - 5;
      const x0 = (seed % (W + 24)) - t * wind;
      const xx = ((x0 % (W + 24)) + (W + 24)) % (W + 24) - 12;
      // 2段ずれの短い雨すじ（粒として見える長さ）
      ctx.fillRect(xx + 1, yy, 1, 3);
      ctx.fillRect(xx, yy + 3, 1, 3);
      // 地面に届いた粒は はねる（道の高さ付近で小さなしぶき）
      if (yy > PATH_TOP - 4 && yy < PATH_BOT) {
        ctx.fillRect(xx - 1, PATH_TOP + ((seed >> 6) % 18), 2, 1);
      }
    }
    // 雷雨: ときどき画面が白く光る
    if (storm && hash(Math.floor(nowMs / 90)) % 46 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(0, 0, W, H);
    }
  } else if (weather === "snow") {
    const n = 46;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (let i = 0; i < n; i++) {
      const seed = hash(i * 47);
      const y = (((seed >> 4) % (H + 8)) + t * (16 + (seed % 10))) % (H + 8) - 4;
      const sway = Math.sin(t * 1.2 + i) * 7;
      const x = ((((seed % (W + 16)) + sway) % (W + 16)) + (W + 16)) % (W + 16) - 8;
      const big = seed % 3 === 0;
      ctx.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1);
    }
  } else if (weather === "fog") {
    ctx.fillStyle = "rgba(230,235,240,0.32)";
    ctx.fillRect(0, 0, W, H);
    // うっすら流れる霧の帯
    for (let i = 0; i < 4; i++) {
      const y = 40 + i * 34;
      const x = W - (((t * (6 + i * 2) + i * 130) % (W + 120)) - 60);
      ctx.fillStyle = "rgba(240,244,248,0.28)";
      ctx.fillRect(Math.round(x) - 60, y, 120, 10);
    }
  }
}
