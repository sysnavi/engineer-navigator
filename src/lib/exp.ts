import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";

// プレイヤーEXP（Phase 7: ゲーム性の土台）。
// 新しいテーブルは作らず、既存データの集計から毎回導出する（migration不要）。
// 過去の頑張りもさかのぼって全部EXPになる。将来のローグライク（潜れる深さ=レベル）や
// 作業環境コレクションはこのレベルの上に乗せる。設計メモ: docs/handoff.md

export const EXP_WEIGHTS = {
  report: 50, // 週報を提出
  suggestionApproved: 30, // スキル提案を承認
  roleplayCompleted: 40, // 役割演習を完了
  quizAttempt: 5, // 腕試しを解く
  quizCorrectBonus: 5, // 正解ボーナス（解答5+正解5=10）
  quizAuthored: 20, // 問題をつくる
  goodQuestionBonus: 30, // 自作問題が良問（平均7+・2人以上評価）
  yomoyamaPost: 10, // よもやまに投稿
  planItemDone: 5, // 学習プラン項目を完了
  publicProfile: 30, // プロフィール公開（1回）
} as const;

// レベルカーブ: 序盤サクサク・後半じっくりの平方根。Lv n に必要な累計EXP = 50 * (n-1)^2
export function levelFromExp(exp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, exp) / 50)) + 1;
}
export function expForLevel(level: number): number {
  return 50 * (level - 1) * (level - 1);
}

// 進化段階（レベルから決定的に決まる。保存不要）
export type AvatarStage = {
  minLevel: number;
  name: string;
  sprite: "egg" | "chick" | "minarai" | "ichininmae" | "meister";
};
export const STAGES: AvatarStage[] = [
  { minLevel: 1, name: "たまご", sprite: "egg" },
  { minLevel: 3, name: "ひよこ", sprite: "chick" },
  { minLevel: 5, name: "みならい", sprite: "minarai" },
  { minLevel: 7, name: "いちにんまえ", sprite: "ichininmae" },
  { minLevel: 12, name: "マイスター", sprite: "meister" },
];
export function stageForLevel(level: number): AvatarStage {
  let cur = STAGES[0];
  for (const s of STAGES) if (level >= s.minLevel) cur = s;
  return cur;
}

export type WeekActivity = { label: string; exp: number };

export type PlayerStats = {
  exp: number;
  level: number;
  stage: AvatarStage;
  nextStage: AvatarStage | null;
  // 現レベル帯の進捗（EXPバー用・0..1）
  levelProgress: number;
  expToNextLevel: number;
  weekExp: number;
  weekActivities: WeekActivity[];
};

/** プレイヤーのEXP/レベル/今週の獲得内訳を既存データから導出する */
export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  const weekStart = mondayOf(new Date());

  const [
    reports,
    suggestionsApproved,
    roleplays,
    attempts,
    corrects,
    authored,
    goodQuestions,
    posts,
    planDone,
    user,
    wReports,
    wSuggestions,
    wRoleplays,
    wAttempts,
    wCorrects,
    wAuthored,
    wPosts,
    wPlanDone,
  ] = await Promise.all([
    prisma.weeklyReport.count({ where: { userId, status: "SUBMITTED" } }),
    prisma.skillSuggestion.count({ where: { userId, status: "APPROVED" } }),
    prisma.roleplaySession.count({ where: { userId, status: "COMPLETED" } }),
    prisma.quizAttempt.count({ where: { userId } }),
    prisma.quizAttempt.count({ where: { userId, correct: true } }),
    prisma.quizQuestion.count({ where: { authorId: userId } }),
    // 良問ボーナス: 2人以上に評価され平均7+（DBでは近似 sum >= 7*count を後段で判定）
    prisma.quizQuestion.findMany({
      where: { authorId: userId, ratingCount: { gte: 2 } },
      select: { ratingSum: true, ratingCount: true },
    }),
    prisma.yomoyamaPost.count({ where: { authorId: userId } }),
    prisma.studyPlanItem.count({
      where: { done: true, plan: { userId } },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { isPublic: true },
    }),
    // ---- 今週分 ----
    prisma.weeklyReport.count({
      where: { userId, status: "SUBMITTED", submittedAt: { gte: weekStart } },
    }),
    prisma.skillSuggestion.count({
      where: { userId, status: "APPROVED", decidedAt: { gte: weekStart } },
    }),
    prisma.roleplaySession.count({
      where: { userId, status: "COMPLETED", createdAt: { gte: weekStart } },
    }),
    prisma.quizAttempt.count({
      where: { userId, createdAt: { gte: weekStart } },
    }),
    prisma.quizAttempt.count({
      where: { userId, correct: true, createdAt: { gte: weekStart } },
    }),
    prisma.quizQuestion.count({
      where: { authorId: userId, createdAt: { gte: weekStart } },
    }),
    prisma.yomoyamaPost.count({
      where: { authorId: userId, createdAt: { gte: weekStart } },
    }),
    prisma.studyPlanItem.count({
      where: { done: true, doneAt: { gte: weekStart }, plan: { userId } },
    }),
  ]);

  const goodCount = goodQuestions.filter(
    (q) => q.ratingSum >= 7 * q.ratingCount
  ).length;

  const W = EXP_WEIGHTS;
  const exp =
    reports * W.report +
    suggestionsApproved * W.suggestionApproved +
    roleplays * W.roleplayCompleted +
    attempts * W.quizAttempt +
    corrects * W.quizCorrectBonus +
    authored * W.quizAuthored +
    goodCount * W.goodQuestionBonus +
    posts * W.yomoyamaPost +
    planDone * W.planItemDone +
    (user.isPublic ? W.publicProfile : 0);

  const level = levelFromExp(exp);
  const stage = stageForLevel(level);
  const nextStage = STAGES.find((s) => s.minLevel > level) ?? null;

  const cur = expForLevel(level);
  const next = expForLevel(level + 1);
  const levelProgress = Math.min(1, Math.max(0, (exp - cur) / (next - cur)));

  const weekActivities: WeekActivity[] = [];
  if (wReports) weekActivities.push({ label: "週報", exp: wReports * W.report });
  if (wSuggestions)
    weekActivities.push({
      label: `スキル承認×${wSuggestions}`,
      exp: wSuggestions * W.suggestionApproved,
    });
  if (wRoleplays)
    weekActivities.push({
      label: `演習×${wRoleplays}`,
      exp: wRoleplays * W.roleplayCompleted,
    });
  if (wAttempts)
    weekActivities.push({
      label: `腕試し×${wAttempts}`,
      exp: wAttempts * W.quizAttempt + wCorrects * W.quizCorrectBonus,
    });
  if (wAuthored)
    weekActivities.push({
      label: `作問×${wAuthored}`,
      exp: wAuthored * W.quizAuthored,
    });
  if (wPosts)
    weekActivities.push({
      label: `よもやま×${wPosts}`,
      exp: wPosts * W.yomoyamaPost,
    });
  if (wPlanDone)
    weekActivities.push({
      label: `プラン進行×${wPlanDone}`,
      exp: wPlanDone * W.planItemDone,
    });

  return {
    exp,
    level,
    stage,
    nextStage,
    levelProgress,
    expToNextLevel: next - exp,
    weekExp: weekActivities.reduce((s, a) => s + a.exp, 0),
    weekActivities,
  };
}
