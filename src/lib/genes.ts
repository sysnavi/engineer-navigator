// 遺伝子（アバター継承 Issue #1）: 世代内の「どの活動でEXPを稼いだか」から
// 決定的に決まる血統。乱数は使わない（導出ベースの設計を崩さないため）。
//
// - 優性遺伝子 = その世代で最もEXPを稼いだ活動カテゴリ
// - 劣性遺伝子 = 2番目のカテゴリ（1カテゴリしか活動がなければ null）
// - 組み合わせ（優性×劣性）や純血統（同じ優性が代々続く）で称号が変わる
//
// exp.ts への依存は持たない（循環import回避）。EXPソース名は EXP_WEIGHTS の
// キーと一致させること（新しいEXPソースを足したら SOURCES の割当も更新する）。

export type GeneId =
  | "tsuzuki" // 継続
  | "chie" // 知恵
  | "souzou" // 創造
  | "chousen" // 挑戦
  | "kyudo" // 求道
  | "kouryu"; // 交流

export type GeneDef = {
  id: GeneId;
  name: string; // 「◯◯の遺伝子」
  short: string; // チップ表示用の一文字〜二文字
  color: string; // パレットCSS変数（きせかえでも世界観維持）
  desc: string;
  sources: string[]; // EXP_WEIGHTS のキー
};

export const GENES: GeneDef[] = [
  {
    id: "tsuzuki",
    name: "継続の遺伝子",
    short: "続",
    color: "var(--royal)",
    desc: "週報を書き続けた血統",
    sources: ["report", "publicReport"],
  },
  {
    id: "chie",
    name: "知恵の遺伝子",
    short: "知",
    color: "var(--lemon)",
    desc: "腕試しで知識を磨いた血統",
    sources: ["quizAttempt", "quizCorrectBonus"],
  },
  {
    id: "souzou",
    name: "創造の遺伝子",
    short: "創",
    color: "var(--pink-hot)",
    desc: "良問を生み出した血統",
    sources: ["quizAuthored", "goodQuestionBonus"],
  },
  {
    id: "chousen",
    name: "挑戦の遺伝子",
    short: "挑",
    color: "var(--good)",
    desc: "役割演習に挑み続けた血統",
    sources: ["roleplayCompleted", "suggestionApproved"],
  },
  {
    id: "kyudo",
    name: "求道の遺伝子",
    short: "求",
    color: "var(--warn)",
    desc: "メンターと学びを深めた血統",
    sources: ["mentorSession", "planCreated", "planItemDone"],
  },
  {
    id: "kouryu",
    name: "交流の遺伝子",
    short: "交",
    color: "var(--sky8)",
    desc: "学び合いの場を盛り上げた血統",
    sources: ["yomoyamaPost", "quizRated", "publicProfile", "visit", "streakWeekBonus"],
  },
];

export function geneById(id: string | null | undefined): GeneDef | null {
  return GENES.find((g) => g.id === id) ?? null;
}

/** ソース別EXP（この世代で稼いだ分）から優性・劣性遺伝子を決める。
 *  同点はカタログ順で決着（決定的）。全ソース0でも優性は先頭にフォールバック。 */
export function genesFromExpBySource(expBySource: Record<string, number>): {
  dominant: GeneId;
  recessive: GeneId | null;
} {
  const totals = GENES.map((g) => ({
    id: g.id,
    total: g.sources.reduce((s, k) => s + Math.max(0, expBySource[k] ?? 0), 0),
  })).sort((a, b) => b.total - a.total); // Array.prototype.sort は安定 → 同点はカタログ順
  const dominant = totals[0].id;
  const recessive = totals[1] && totals[1].total > 0 ? totals[1].id : null;
  return { dominant, recessive };
}

// 組み合わせ限定の称号（優性×劣性）。順序は「優性→劣性」で固定。
// 全組み合わせを埋める必要はない（該当なしは汎用称号にフォールバック）。
const COMBO_TITLES: Partial<Record<`${GeneId}:${GeneId}`, string>> = {
  "tsuzuki:chie": "努力の血統",
  "tsuzuki:kouryu": "灯台の血統",
  "chie:souzou": "賢者の血統",
  "souzou:kouryu": "名工の血統",
  "chousen:tsuzuki": "不屈の血統",
  "chousen:chie": "軍師の血統",
  "kyudo:chie": "探究の血統",
  "kouryu:souzou": "語り部の血統",
};

/** 血統の称号。純血統（同じ優性が3世代以上連続）> 組み合わせ限定 > 汎用。 */
export function lineageTitle(
  dominant: GeneId,
  recessive: GeneId | null,
  pureRun: number
): string {
  const dom = geneById(dominant)!;
  if (pureRun >= 3) return `純血の${dom.name.replace("の遺伝子", "")}血統`;
  if (recessive) {
    const combo = COMBO_TITLES[`${dominant}:${recessive}`];
    if (combo) return combo;
  }
  return `${dom.name.replace("の遺伝子", "")}の血統`;
}

/** 家系の「純血統」連続数: 最新世代から遡って同じ優性遺伝子が続いた数。
 *  rows は gen 昇順の dominantGene 配列。 */
export function pureRunOf(dominants: string[]): number {
  if (dominants.length === 0) return 0;
  const last = dominants[dominants.length - 1];
  let run = 0;
  for (let i = dominants.length - 1; i >= 0 && dominants[i] === last; i--) run++;
  return run;
}
