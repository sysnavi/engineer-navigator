// おさんぽの世界（ファミコン風タイルワールド）の定義と描画。
//
// 内部解像度 320x180 の canvas に、5つのビオーム（草原→堤防→河原→街中→山道）を
// 巡回で描く。遠景/中景/地面の3層視差。地面はワールド座標に固定（列ごとにビオーム判定）
// なので境界がそのままスクロールで流れ、遠景・中景は境界の道標が画面を横切る間に
// クロスフェードで入れ替わる（エリア境界のパースずれを演出で隠す・ファミコンの常套手段）。
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

export type BiomeId = "kusahara" | "teibo" | "kawara" | "machi" | "yama";
export const BIOME_SEQ: BiomeId[] = ["kusahara", "teibo", "kawara", "machi", "yama"];
export const BIOME_LEN = 1280; // 1ビオームのワールド長(px)
export const BIOME_JA: Record<BiomeId, string> = {
  kusahara: "草原",
  teibo: "堤防",
  kawara: "河原",
  machi: "街中",
  yama: "山道",
};

export function biomeAt(worldX: number): BiomeId {
  const i = Math.floor(worldX / BIOME_LEN);
  return BIOME_SEQ[((i % BIOME_SEQ.length) + BIOME_SEQ.length) % BIOME_SEQ.length];
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

const GRASS = { light: "#8ac559", dark: "#7ebd4e", deep: "#5f9e4a" };
const DIRT = { light: "#d9b784", dark: "#cfa974", edge: "#a97f4f" };
const PAVE = { light: "#c9ced8", dark: "#bcc2cf", edge: "#8f96a6" };
const WATER = { base: "#4f8fd0", deep: "#3f7cba", glint: "#bfe2ff" };

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
  sx: number
) {
  const bands = SKY[time];
  const bh = Math.ceil(HORIZON / bands.length);
  bands.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * bh, W, bh);
  });

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

export function drawFar(
  ctx: CanvasRenderingContext2D,
  biome: BiomeId,
  phase: number,
  time: TimeBucket
) {
  const night = time === "night";
  if (biome === "kusahara" || biome === "teibo") {
    // 遠い丘（堤防は対岸の丘）
    ctx.fillStyle = night ? "#3d5a52" : "#a7cba0";
    for (let x = 0; x < W; x += 8) {
      const h = 18 + hillY(x + phase, 11, 10, 60);
      ctx.fillRect(x, HORIZON - h, 8, h);
    }
    if (biome === "teibo") {
      // 対岸の小さな家々
      for (let x = 0; x < W; x += 8) {
        const wx = Math.floor((x + phase) / 44);
        if (hash(wx * 5) % 3 === 0) {
          const hx = x - ((phase + x) % 44) + 20;
          if (hx > -12 && hx < W) {
            ctx.fillStyle = night ? "#2c3f63" : "#c7d4e8";
            ctx.fillRect(hx, HORIZON - 10, 10, 10);
            ctx.fillStyle = night ? "#ffd84d" : "#8fa3c4";
            ctx.fillRect(hx + 3, HORIZON - 7, 3, 3);
          }
        }
      }
    }
  } else if (biome === "kawara" || biome === "yama") {
    // 山なみ（河原=低め・山道=高め2重）
    const big = biome === "yama";
    ctx.fillStyle = night ? "#26355e" : big ? "#7d9bb5" : "#9db8cc";
    for (let x = 0; x < W; x += 8) {
      const h = (big ? 40 : 24) + hillY(x + phase, 31, big ? 18 : 10, 52);
      ctx.fillRect(x, HORIZON - h, 8, h);
    }
    if (big) {
      ctx.fillStyle = night ? "#1d2a4e" : "#5f7f9e";
      for (let x = 0; x < W; x += 8) {
        const h = 26 + hillY(x + phase * 1.3, 77, 14, 40);
        ctx.fillRect(x, HORIZON - h, 8, h);
      }
    }
  } else {
    // 街のスカイライン（窓は夜に灯る）
    for (let x = -16; x < W; x += 8) {
      const bi = Math.floor((x + phase) / 26);
      const h = 16 + (hash(bi * 3) % 26);
      const bx = x - ((phase + x) % 26);
      ctx.fillStyle = night ? "#222c52" : "#aab6cf";
      ctx.fillRect(bx, HORIZON - h, 22, h);
      const win = night ? "#ffd84d" : "#8fa0c0";
      for (let wy = HORIZON - h + 4; wy < HORIZON - 4; wy += 6) {
        for (let wx = bx + 3; wx < bx + 19; wx += 6) {
          if (hash(bi * 91 + wy * 7 + wx) % (night ? 3 : 4) === 0) {
            ctx.fillStyle = win;
            ctx.fillRect(wx, wy, 3, 3);
          }
        }
      }
    }
  }
}

export function drawMid(
  ctx: CanvasRenderingContext2D,
  biome: BiomeId,
  phase: number,
  time: TimeBucket,
  frame: number
) {
  const night = time === "night";
  if (biome === "kusahara") {
    // 茂み
    ctx.fillStyle = night ? "#2f4a33" : GRASS.deep;
    for (let x = 0; x < W; x += 8) {
      const h = 10 + hillY(x + phase, 7, 8, 26);
      ctx.fillRect(x, HORIZON - h + 8, 8, h);
    }
  } else if (biome === "teibo" || biome === "kawara") {
    // 川面（きらめきは2フレームアニメ）。堤防=遠い帯 / 河原=近い広い帯
    const top = biome === "teibo" ? HORIZON - 2 : HORIZON + 2;
    const deep = biome === "teibo" ? 16 : 26;
    ctx.fillStyle = night ? "#27427a" : WATER.base;
    ctx.fillRect(0, top, W, deep);
    ctx.fillStyle = night ? "#1e3766" : WATER.deep;
    ctx.fillRect(0, top + deep - 6, W, 6);
    for (let i = 0; i < 26; i++) {
      const gx = (hash(i * 17) % (W + 40)) - ((phase * 1.4 + frame * 2) % (W + 40));
      const x = ((gx % (W + 40)) + (W + 40)) % (W + 40) - 20;
      const y = top + 3 + (hash(i * 23) % (deep - 8));
      ctx.fillStyle = night ? "rgba(200,220,255,0.5)" : WATER.glint;
      ctx.fillRect(x, y, 4, 2);
    }
  } else if (biome === "machi") {
    // 家並み（屋根＋窓）
    for (let x = -20; x < W; x += 8) {
      const bi = Math.floor((x + phase) / 38);
      const bx = x - ((phase + x) % 38);
      const h = 18 + (hash(bi * 13) % 10);
      ctx.fillStyle = night ? "#31406b" : "#dfe6f2";
      ctx.fillRect(bx, HORIZON - h + 14, 30, h);
      ctx.fillStyle = night ? "#1d2a4e" : "#6f81a8";
      ctx.fillRect(bx - 2, HORIZON - h + 8, 34, 8); // 屋根
      ctx.fillStyle = night ? "#ffd84d" : "#9fb0d0";
      ctx.fillRect(bx + 5, HORIZON - h + 20, 5, 5);
      ctx.fillRect(bx + 19, HORIZON - h + 20, 5, 5);
    }
  } else {
    // 針葉樹の列
    for (let x = -12; x < W; x += 8) {
      const ti = Math.floor((x + phase) / 22);
      const tx = x - ((phase + x) % 22);
      const h = 22 + (hash(ti * 7) % 12);
      const c = night ? "#1e3a2c" : hash(ti) % 2 ? "#3f7043" : "#487d3a";
      ctx.fillStyle = c;
      // 三角形を段々で
      for (let s = 0; s < 4; s++) {
        const w2 = 4 + s * 4;
        ctx.fillRect(tx + 10 - w2 / 2, HORIZON - h + s * (h / 5), w2, h / 5 + 1);
      }
      ctx.fillStyle = night ? "#2a2317" : "#8a6039";
      ctx.fillRect(tx + 8, HORIZON - 6, 4, 6);
    }
  }
}

// ---------------------------------------------------------------------------
// 地面（ワールド座標固定・8px列ごとにビオーム判定＝境界が自然に流れてくる）
// ---------------------------------------------------------------------------

export function drawGround(
  ctx: CanvasRenderingContext2D,
  sx: number,
  time: TimeBucket
) {
  const night = time === "night";
  for (let x = 0; x < W; x += 8) {
    const wx = sx + x;
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

    // 道（共通の帯。街中だけ舗装色）
    const pave = b === "machi";
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

    // 道の下の前景フチ
    ctx.fillStyle =
      b === "machi" ? (night ? "#454c5e" : PAVE.edge) : night ? "#24382a" : GRASS.deep;
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
  }
}

// ---------------------------------------------------------------------------
// プロップ配置（ビオーム区間ごとに決定的生成）とイベント
// ---------------------------------------------------------------------------

export type WalkEvent = { id: string; lines: string[] };

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
    ],
  },
  vending: {
    id: "vending",
    lines: ["じはんき みっけ。なに のむ？", "つめたいの と あったかいの、どっちに する？"],
  },
  bench: {
    id: "bench",
    lines: ["ベンチだ。ちょっとだけ すわってこ。", "ここ、いい ばしょだね。おぼえておこ。"],
  },
  rock: {
    id: "rock",
    lines: ["おおきな いし。……のぼりたい。", "いしに さわると ひんやり するね。"],
  },
  signpost: {
    id: "signpost",
    lines: ["みちしるべ だ。まだまだ いけるね。", "つぎは どんな けしき かな。"],
  },
};

/** ビオーム区間 seg（worldX/BIOME_LEN の整数）ごとのプロップ一覧を決定的に生成 */
export function propsForSegment(seg: number): PropInstance[] {
  const b = BIOME_SEQ[((seg % BIOME_SEQ.length) + BIOME_SEQ.length) % BIOME_SEQ.length];
  const base = seg * BIOME_LEN;
  const out: PropInstance[] = [];
  const put = (sprite: string, worldX: number, footY: number, event?: WalkEvent) =>
    out.push({ worldX, sprite, footY, event });

  // 境界の道標（区間の頭）。たまにイベント化して ひとこと
  put("signpost", base + 24, PATH_TOP - 2, hash(seg * 71) % 3 === 0 ? EVENTS.signpost : undefined);

  // 飾りプロップ（花・葦・岩・電柱）を散らす
  for (let k = 0; k < 10; k++) {
    const x = base + 120 + ((hash(seg * 100 + k) % (BIOME_LEN - 240)) | 0);
    const r = hash(seg * 200 + k) % 100;
    if (b === "kusahara" && r < 55) put(r % 2 ? "flowerP" : "flowerW", x, PATH_TOP - 1);
    else if (b === "kawara" && r < 50) put("reed", x, PATH_TOP - 1);
    else if (b === "yama" && r < 40) put("rock", x, PATH_TOP - 1);
    else if (b === "machi" && r < 30) put("pole", x, PATH_TOP - 2);
  }

  // イベントプロップ（1区間に最大1つ・60%）
  const er = hash(seg * 31) % 100;
  if (er < 60) {
    const x = base + 400 + (hash(seg * 57) % (BIOME_LEN - 700));
    if (b === "machi") put(er % 2 ? "vending" : "cat", x, PATH_TOP - 1, er % 2 ? EVENTS.vending : EVENTS.cat);
    else if (b === "kawara" || b === "teibo")
      put(er % 2 ? "cat" : "rock", x, PATH_TOP - 1, er % 2 ? EVENTS.cat : EVENTS.rock);
    else if (b === "yama") put("rock", x, PATH_TOP - 1, EVENTS.rock);
    else put("bench", x, PATH_TOP - 1, EVENTS.bench);
  }

  return out;
}

export function drawProp(ctx: CanvasRenderingContext2D, p: PropInstance, sx: number) {
  const spr = propSprite(p.sprite);
  const x = Math.round(p.worldX - sx);
  if (x < -spr.width || x > W + spr.width) return;
  ctx.drawImage(spr, x - Math.floor(spr.width / 2), p.footY - spr.height);
}
