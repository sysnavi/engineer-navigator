// SNS 投稿Bot の「きょうの1枚」の撮影条件（docs/sns-bot.md）。
//
// 毎日ちがう画像にするため、シーンだけでなく中身（仲間・部屋・天気・時間帯・パレット…）も
// 日替わりにする。条件はすべて seed から決定的に導出する純関数で、
//  - scripts/sns/prepare-showcase.ts（DBに置くもの: 仲間・家具・来訪…）
//  - tests/sns/scenes.spec.ts（画面で決めるもの: 天気・時間帯・行き先・選ぶ選択肢…）
// の両方が同じ planDay() を呼ぶので、両者の食い違いが構造的に起きない。
//
// seed は既定で JST の日付（"2026-09-12"）。同じ日に何度撮っても同じ絵になり、
// 日が変われば必ず別のシーンになる。手動実行では SNS_SEED で任意の値にできる（毎回ちがう絵）。
//
// ここはマスタ（TS）だけを参照し、DB には触らない（ユニットテスト対象）。

import { PALETTES } from "@/lib/palettes";
import { PET_SPECIES } from "@/lib/pets/species";
import { FOODS } from "@/lib/pets/foods";
import { GADGETS } from "@/lib/dungeon/content";
import { SHOP_ITEMS } from "@/lib/shop/content";
import { FLOORS, WALLPAPERS } from "@/lib/home/scene";
import { clampFurniture } from "@/lib/home/living";
import { WALK_ITEMS } from "@/lib/walk/items";
import { BIOME_JA, RARE_BIOMES, SPECIAL_BIOMES, type BiomeId } from "@/lib/walk/world";

// ---------------------------------------------------------------------------
// シーン
// ---------------------------------------------------------------------------

// 並び順 = 巡回順。クイズ系と遊び系が交互になるように並べてある
export const SNS_SCENE_IDS = [
  "quiz-play",
  "walk",
  "genba",
  "dungeon",
  "quiz-daily",
  "visitor",
  "shop",
  "myhome",
  "home",
] as const;
export type SnsSceneId = (typeof SNS_SCENE_IDS)[number];

export function isSnsSceneId(v: string): v is SnsSceneId {
  return (SNS_SCENE_IDS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// 乱数（決定的）
// ---------------------------------------------------------------------------

/** FNV-1a 32bit */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = {
  /** [0, 1) */
  next(): number;
  /** [min, max] の整数 */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  /** 重複なしで n 個（arr より多ければ全部） */
  sample<T>(arr: readonly T[], n: number): T[];
  chance(p: number): boolean;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
};

/**
 * seed と用途名（stream）ごとに独立した乱数列を作る（mulberry32）。
 * 用途ごとに分けておくと、ある用途の引く回数を変えても他の結果がずれない。
 */
export function rngFor(seed: string, stream: string): Rng {
  let a = hash32(`${seed}:${stream}`);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sample: (arr, n) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
    },
    chance: (p) => next() < p,
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of entries) {
        r -= w;
        if (r < 0) return v;
      }
      return entries[entries.length - 1][0];
    },
  };
}

// ---------------------------------------------------------------------------
// 日付と seed
// ---------------------------------------------------------------------------

/** JST の日付キー（"YYYY-MM-DD"） */
export function jstDateKey(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 日付キー → 通し日数。日付キーでなければ null（任意の seed） */
export function dayIndexOf(key: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const t = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.floor(t / 86400_000);
}

/**
 * 通し日数 → シーン。SNS_SCENE_IDS を順番に巡回する（9日に1回ずつ、均等に間が空く）。
 * ランダムにしないのは、同じシーンが数日おきに固まって出るのを避けるため。
 */
export function sceneForDay(dayIndex: number): SnsSceneId {
  return cyclic(SNS_SCENE_IDS, dayIndex);
}

/** 通し日数 → パレット（5日周期。シーンの9日周期と互いに素なので 45 日で全組み合わせが出る） */
export function paletteForDay(dayIndex: number): string {
  return cyclic(PALETTES, dayIndex).id;
}

function cyclic<T>(list: readonly T[], i: number): T {
  return list[((i % list.length) + list.length) % list.length];
}

// ---------------------------------------------------------------------------
// きょうの撮影条件
// ---------------------------------------------------------------------------

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow" | "storm" | "fog";

/** Open-Meteo の WMO weather_code（src/lib/walk/mutter.ts の weatherCodeToBucket が解釈する） */
export const WEATHER_CODE: Record<WeatherKind, number> = {
  clear: 0,
  cloudy: 3,
  fog: 45,
  rain: 63,
  snow: 73,
  storm: 95,
};
export const WEATHER_JA: Record<WeatherKind, string> = {
  clear: "はれ",
  cloudy: "くもり",
  fog: "きり",
  rain: "あめ",
  snow: "ゆき",
  storm: "かみなり",
};
/** おさんぽの時間帯（mutter.ts の timeToBucket の区切りの内側の時刻） */
export const WALK_HOURS = { morning: 8, noon: 13, evening: 17, night: 21 } as const;
export type WalkTime = keyof typeof WALK_HOURS;
export const WALK_TIME_JA: Record<WalkTime, string> = {
  morning: "あさ",
  noon: "ひる",
  evening: "ゆうがた",
  night: "よる",
};

export type SnsPlan = {
  seed: string;
  scene: SnsSceneId;
  palette: string;
  /** 仲間（先頭ほど仲良し。おさんぽは affection 降順で先頭の子が歩く） */
  pets: { speciesId: string; name: string; affection: number }[];
  /** visitor シーンの日だけ、まだ仲間でない子が遊びに来る。それ以外は null（来訪なし） */
  visitorSpeciesId: string | null;
  wallet: number;
  foods: { foodId: string; count: number }[];
  gadgets: string[];
  /** 買った家具とリビングでの位置（%座標。src/lib/home/living.ts のゾーン内） */
  furniture: { itemId: string; x: number; y: number }[];
  wallpaper: string;
  floor: string;
  /** きのうまでの連続来訪日数（レベル・連続記録が日によって変わる） */
  visitDays: number;
  /** きのうまでの「今日の一問」連続日数 */
  dailyStreak: number;
  walk: {
    items: string[];
    biome: BiomeId;
    weather: WeatherKind;
    time: WalkTime;
  };
};

/** 通常の巡回ビオーム（レアは確率でしか出ず、?biome= で狙えないので除く） */
export const BASE_BIOMES: BiomeId[] = (Object.keys(BIOME_JA) as BiomeId[]).filter(
  (b) => !RARE_BIOMES.includes(b) && !SPECIAL_BIOMES.includes(b)
);

export function planDay(seed: string, forcedScene?: string | null): SnsPlan {
  const dayIndex = dayIndexOf(seed);
  const scene: SnsSceneId =
    forcedScene && isSnsSceneId(forcedScene)
      ? forcedScene
      : dayIndex != null
        ? sceneForDay(dayIndex)
        : rngFor(seed, "scene").pick(SNS_SCENE_IDS);

  const r = (stream: string) => rngFor(seed, stream);

  // 仲間: 1〜4匹。仲良し度は重ならないように並べる
  const petSpecies = r("pets").sample(PET_SPECIES, r("pets:n").int(1, 4));
  const aff = r("pets:aff");
  let top = aff.int(20, 90);
  const pets = petSpecies.map((s) => {
    const affection = top;
    top = Math.max(1, top - aff.int(3, 18));
    return { speciesId: s.id, name: s.name, affection };
  });

  const notOwned = PET_SPECIES.filter((s) => !petSpecies.includes(s));
  const visitorSpeciesId = scene === "visitor" && notOwned.length > 0 ? r("visitor").pick(notOwned).id : null;

  // 家具・きせかえ（シリーズ解放が要る壁紙/床は選ばない＝本来見えない状態を作らない）
  const furnitureItems = SHOP_ITEMS.filter((i) => !i.expand);
  const freeWalls = WALLPAPERS.filter((w) => !w.unlockSeries);
  const freeFloors = FLOORS.filter((f) => !f.unlockSeries);

  // おさんぽ: カギアイテムを0〜2個持たせ、半分くらいの日は解放された特別な行き先へ
  const walkItems = r("walk:items").sample(WALK_ITEMS, r("walk:items:n").weighted([[0, 3], [1, 4], [2, 3]]));
  const special = walkItems.map((i) => i.unlocksBiome);
  const biome =
    special.length > 0 && r("walk:special").chance(0.5)
      ? r("walk:biome").pick(special)
      : r("walk:biome").pick(BASE_BIOMES);
  const weather = r("walk:weather").weighted<WeatherKind>([
    ["clear", 5],
    ["cloudy", 3],
    ["rain", 3],
    ["storm", 1],
    ["fog", 1],
    ["snow", 1],
  ]);
  const time = r("walk:time").weighted<WalkTime>([
    ["morning", 2],
    ["noon", 3],
    ["evening", 3],
    ["night", 3],
  ]);

  return {
    seed,
    scene,
    palette: dayIndex != null ? paletteForDay(dayIndex) : r("palette").pick(PALETTES).id,
    pets,
    visitorSpeciesId,
    // おかいもので「かう」が押せる状態で写るよう、定番の家具が買えるくらいは持たせる
    wallet: r("wallet").int(60, 320) * 10,
    foods: r("foods")
      .sample(FOODS, r("foods:n").int(1, 3))
      .map((f) => ({ foodId: f.id, count: r(`food:${f.id}`).int(1, 5) })),
    gadgets: r("gadgets").sample(GADGETS, r("gadgets:n").int(3, 9)).map((g) => g.id),
    furniture: placeFurniture(r("furniture").sample(furnitureItems, r("furniture:n").int(3, 8)), r("furniture:pos")),
    wallpaper: r("wallpaper").pick(freeWalls).id,
    floor: r("floor").pick(freeFloors).id,
    visitDays: r("visits").int(12, 320),
    dailyStreak: r("dailyStreak").weighted([[0, 1], [r("dailyStreak:n").int(2, 40), 4]]),
    walk: { items: walkItems.map((i) => i.id), biome, weather, time },
  };
}

/**
 * 家具をリビングに散らす。アプリの初期配置（defaultLivingPosition）は「かう」直後の
 * 置き場所なので同じ角に重なる。写真用には、窓（中央上）と右下の「しまう」箱を避けて
 * ゾーンごとに等間隔 + 少しのゆらぎで並べる。
 */
export const LIVING_STOW_AREA = { xMin: 70, yMin: 62 } as const;
const WINDOW_X: [number, number] = [34, 66];

function placeFurniture(
  items: readonly (typeof SHOP_ITEMS)[number][],
  r: Rng
): SnsPlan["furniture"] {
  const byZone = { wall: [] as typeof items[number][], shelf: [] as typeof items[number][], floor: [] as typeof items[number][] };
  for (const i of items) byZone[i.zone].push(i);
  const out: SnsPlan["furniture"] = [];
  const spread = (n: number, k: number, lo: number, hi: number) =>
    lo + ((hi - lo) * (k + 0.5)) / Math.max(1, n) + r.int(-3, 3);
  byZone.floor.forEach((it, k, arr) => {
    // 床は左〜中央（右下は「しまう」箱）。奥と手前を交互に
    const x = spread(arr.length, k, 8, LIVING_STOW_AREA.xMin - 6);
    const y = k % 2 === 0 ? r.int(52, 60) : r.int(64, 78);
    out.push({ itemId: it.id, ...clampFurniture(it, x, y) });
  });
  byZone.wall.forEach((it, k) => {
    // 壁は窓の左右に交互に
    const [lo, hi] = k % 2 === 0 ? [8, WINDOW_X[0] - 4] : [WINDOW_X[1] + 4, 92];
    out.push({ itemId: it.id, ...clampFurniture(it, r.int(lo, hi), r.int(9, 16)) });
  });
  byZone.shelf.forEach((it, k) => {
    // 棚は左右の板に交互に（clampFurniture が板の上に吸着させる）
    out.push({ itemId: it.id, ...clampFurniture(it, k % 2 === 0 ? r.int(12, 32) : r.int(68, 88), 24) });
  });
  return out;
}

/** Slack の控えに添える「きょうの条件」の要約（人が見て日替わりを確かめられるように） */
export function describePlan(p: SnsPlan): string {
  const parts: string[] = [`パレット ${p.palette}`];
  if (p.scene === "walk") {
    parts.push(BIOME_JA[p.walk.biome], WEATHER_JA[p.walk.weather], WALK_TIME_JA[p.walk.time]);
  }
  if (p.scene === "visitor" && p.visitorSpeciesId) {
    parts.push(`来訪 ${PET_SPECIES.find((s) => s.id === p.visitorSpeciesId)?.name ?? p.visitorSpeciesId}`);
  }
  parts.push(`仲間 ${p.pets.length}匹`, `連続来訪 ${p.visitDays + 1}日`);
  return parts.join(" / ");
}
