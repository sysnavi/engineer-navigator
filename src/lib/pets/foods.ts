// ごはんマスタ（Issue #23 竹案）。ダンジョン content.ts と同方式のTSマスタ
// （追加＝1件足すだけ）。DBには FoodItem の所持数しか持たない。
//
// 【呼び方】UI表記は「エサ／エサやり」ではなく「ごはん」で統一する。
// "エサ" は家畜の語感が出て、可愛いペットを世話するニュアンスと合わないため
// （Issue #23 でユーザーが明示）。コード上の識別子は food/Food のままでよい。
//
// 【ドット絵】画像ファイルは持たず、PixelAvatar と同じ CSS グリッド方式で描く
// （src/components/pets/food-sprite.tsx）。将来PNG支給に差し替えても
// 呼び出し側は id を渡すだけなので影響しない。

export type FoodId = "onigiri" | "melonpan" | "coffee-milk" | "gold-omurice";

export type FoodDef = {
  id: FoodId;
  name: string;
  rarity: 1 | 2 | 3 | 4; // ★の数（表示用）
  /** ダンジョンで拾える最浅の階。null = ダンジョンには落ちていない */
  minDepth: number | null;
  /** ダンジョン抽選の重み（minDepth を満たす候補内で使う） */
  weight: number;
  /** true = 全種族の準好物（好物と同じ +2） */
  semiFavorite?: boolean;
  /** ボス撃破時のみ落ちる */
  bossOnly?: boolean;
  desc: string;
};

export const FOODS: FoodDef[] = [
  {
    id: "onigiri",
    name: "ドットむすび",
    rarity: 1,
    minDepth: null,
    weight: 0,
    desc: "きほんのごはん。毎日1個もらえるので、ごはん切れでお世話が止まらない。",
  },
  {
    id: "melonpan",
    name: "メロンパン",
    rarity: 2,
    minDepth: 1,
    weight: 6,
    desc: "浅い階でよく落ちている。さくさく。だれかの好物かもしれない。",
  },
  {
    id: "coffee-milk",
    name: "コーヒーぎゅうにゅう",
    rarity: 3,
    minDepth: 3,
    weight: 3,
    desc: "ふろあがりの味。ちょっと深い階のドロップ。",
  },
  {
    id: "gold-omurice",
    name: "きんのオムライス",
    rarity: 4,
    minDepth: null,
    weight: 0,
    semiFavorite: true,
    bossOnly: true,
    desc: "かがやいている。どの種族にあげても大喜び。じまん用。",
  },
];

export function foodById(id: string): FoodDef | undefined {
  return FOODS.find((f) => f.id === id);
}

/** デイリー配布で配るごはん（ログイン1日1個） */
export const DAILY_FOOD_ID: FoodId = "onigiri";

/** なつき度の増分。好物・準好物は2倍 */
export function affectionGain(food: FoodDef, isFavorite: boolean): number {
  return isFavorite || food.semiFavorite ? 2 : 1;
}

/** てのひらから差し出すモードが解放されるなつき度（Issue #23 で確定） */
export const HAND_SERVE_MIN_AFFECTION = 8;

/** もりつけ演出の種類。
 *  dish=基本 / hand=なつき度8以上で解放 / together=好物ヒットの日に自動 */
export type ServeMode = "dish" | "hand" | "together";

export function serveModeFor(
  affection: number,
  isFavoriteHit: boolean
): ServeMode {
  if (isFavoriteHit) return "together";
  return affection >= HAND_SERVE_MIN_AFFECTION ? "hand" : "dish";
}

/** ダンジョンで落ちるごはんを抽選する（該当なしなら null）。
 *  ボス撃破時は bossOnly のごはんが確定で落ちる。 */
export function rollFood(depth: number, isBoss: boolean): FoodDef | null {
  if (isBoss) {
    return FOODS.find((f) => f.bossOnly) ?? null;
  }
  const pool = FOODS.filter(
    (f) => !f.bossOnly && f.minDepth !== null && depth >= f.minDepth
  );
  if (pool.length === 0) return null;
  const total = pool.reduce((a, f) => a + f.weight, 0);
  let r = Math.random() * total;
  for (const f of pool) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return pool[pool.length - 1];
}
