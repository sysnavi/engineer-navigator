import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";

// プレイヤーEXP（Phase 7: ゲーム性の土台）。
// 方針: サイトでの「全活動」をEXP化する。学び・貢献に厚く、消費に薄く。
// 繰り返しで稼げる行動（腕試しの解き直し等）は1問につき初回のみカウント（ファーミング対策）。
// 訪問(UserVisit)以外は既存データの集計から毎回導出（過去の頑張りも遡ってEXP化）。
// 将来のローグライク（潜れる深さ=レベル）はこのレベルの上に乗せる。設計: docs/handoff.md

export const EXP_WEIGHTS = {
  report: 50, // 週報を提出
  suggestionApproved: 30, // スキル提案を承認
  roleplayCompleted: 40, // 役割演習を完了
  quizAttempt: 5, // 腕試しを解く（1問につき初回のみ）
  quizCorrectBonus: 5, // 正解ボーナス（同じく1問1回）
  quizAuthored: 20, // 問題をつくる
  goodQuestionBonus: 30, // 自作問題が良問（平均7+・2人以上評価）
  quizRated: 3, // 他の人の問題を評価する（良問バンクへの貢献）
  mentorSession: 10, // メンターに相談する（セッション作成）
  planCreated: 15, // 学習プランを作る
  planItemDone: 5, // 学習プラン項目を完了
  yomoyamaPost: 10, // よもやまに投稿
  publicProfile: 30, // プロフィール公開（1回）
  publicReport: 5, // 週報を公開する（学び合いへの貢献）
  visit: 5, // サイトに来る（1日1回）
  streakWeekBonus: 20, // 7日連続訪問ごとのボーナス
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

// 「今日」の日付（week.ts の mondayOf と同じ流儀: サーバーローカルの年月日をUTC日付として保存）
function dayOf(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
}

/** サイト訪問を記録する（1日1回・重複は無視）。レイアウトから呼ぶ。 */
export async function recordVisit(userId: string): Promise<void> {
  try {
    await prisma.userVisit.createMany({
      data: [{ userId, date: dayOf(new Date()) }],
      skipDuplicates: true,
    });
  } catch (e) {
    // 訪問記録の失敗で画面を壊さない
    console.error("recordVisit failed:", e);
  }
}

/** 訪問日の配列から 連続日数(今日/昨日まで) と 7日連続ボーナス回数 を計算 */
function analyzeVisits(dates: Date[]): {
  days: number;
  currentStreak: number;
  weekBonusCount: number;
} {
  const DAY = 86400_000;
  const set = new Set(dates.map((d) => dayOf(d).getTime()));
  const days = set.size;

  // 現在のストリーク: 今日(または昨日)から過去へ連続している日数
  const today = dayOf(new Date()).getTime();
  let cursor = set.has(today) ? today : set.has(today - DAY) ? today - DAY : 0;
  let currentStreak = 0;
  while (cursor && set.has(cursor)) {
    currentStreak++;
    cursor -= DAY;
  }

  // 7日連続ごとのボーナス: 全履歴の連続区間(run)ごとに floor(len/7) 回
  const sorted = [...set].sort((a, b) => a - b);
  let weekBonusCount = 0;
  let run = 0;
  let prev = 0;
  for (const t of sorted) {
    run = prev && t - prev === DAY ? run + 1 : 1;
    prev = t;
    if (run % 7 === 0) weekBonusCount++;
  }
  return { days, currentStreak, weekBonusCount };
}

export type WeekActivity = { label: string; exp: number };

export type PlayerStats = {
  exp: number;
  level: number;
  stage: AvatarStage;
  nextStage: AvatarStage | null;
  levelProgress: number; // 現レベル帯の進捗（EXPバー用・0..1）
  expToNextLevel: number;
  currentStreak: number; // 連続訪問日数
  weekExp: number;
  weekActivities: WeekActivity[];
};

/** プレイヤーのEXP/レベル/今週の獲得内訳を既存データから導出する */
export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  const weekStart = mondayOf(new Date());

  const [
    reports,
    publicReports,
    suggestionsApproved,
    roleplays,
    attemptGroups,
    correctGroups,
    authored,
    goodQuestions,
    ratings,
    mentorSessions,
    plans,
    posts,
    planDone,
    user,
    visits,
    // ---- 今週分 ----
    wReports,
    wSuggestions,
    wRoleplays,
    wAuthored,
    wRatings,
    wMentorSessions,
    wPlans,
    wPosts,
    wPlanDone,
  ] = await Promise.all([
    prisma.weeklyReport.count({ where: { userId, status: "SUBMITTED" } }),
    prisma.weeklyReport.count({ where: { userId, isPublic: true } }),
    prisma.skillSuggestion.count({ where: { userId, status: "APPROVED" } }),
    prisma.roleplaySession.count({ where: { userId, status: "COMPLETED" } }),
    // 腕試し: 1問につき初回のみ（解き直しファーミング対策）。初回日時も週次判定に使う
    prisma.quizAttempt.groupBy({
      by: ["questionId"],
      where: { userId },
      _min: { createdAt: true },
    }),
    prisma.quizAttempt.groupBy({
      by: ["questionId"],
      where: { userId, correct: true },
      _min: { createdAt: true },
    }),
    prisma.quizQuestion.count({ where: { authorId: userId } }),
    prisma.quizQuestion.findMany({
      where: { authorId: userId, ratingCount: { gte: 2 } },
      select: { ratingSum: true, ratingCount: true },
    }),
    prisma.quizRating.count({ where: { userId } }),
    prisma.mentorSession.count({ where: { userId } }),
    prisma.studyPlan.count({ where: { userId } }),
    prisma.yomoyamaPost.count({ where: { authorId: userId } }),
    prisma.studyPlanItem.count({ where: { done: true, plan: { userId } } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { isPublic: true },
    }),
    prisma.userVisit.findMany({
      where: { userId },
      select: { date: true },
    }),
    prisma.weeklyReport.count({
      where: { userId, status: "SUBMITTED", submittedAt: { gte: weekStart } },
    }),
    prisma.skillSuggestion.count({
      where: { userId, status: "APPROVED", decidedAt: { gte: weekStart } },
    }),
    prisma.roleplaySession.count({
      where: { userId, status: "COMPLETED", createdAt: { gte: weekStart } },
    }),
    prisma.quizQuestion.count({
      where: { authorId: userId, createdAt: { gte: weekStart } },
    }),
    prisma.quizRating.count({
      where: { userId, createdAt: { gte: weekStart } },
    }),
    prisma.mentorSession.count({
      where: { userId, createdAt: { gte: weekStart } },
    }),
    prisma.studyPlan.count({
      where: { userId, createdAt: { gte: weekStart } },
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
  const attempts = attemptGroups.length;
  const corrects = correctGroups.length;
  const firstThisWeek = (g: { _min: { createdAt: Date | null } }) =>
    !!g._min.createdAt && g._min.createdAt >= weekStart;
  const wAttempts = attemptGroups.filter(firstThisWeek).length;
  const wCorrects = correctGroups.filter(firstThisWeek).length;
  const visitStats = analyzeVisits(visits.map((v) => v.date));
  const wVisits = visits.filter((v) => v.date >= weekStart).length;

  const W = EXP_WEIGHTS;
  const exp =
    reports * W.report +
    publicReports * W.publicReport +
    suggestionsApproved * W.suggestionApproved +
    roleplays * W.roleplayCompleted +
    attempts * W.quizAttempt +
    corrects * W.quizCorrectBonus +
    authored * W.quizAuthored +
    goodCount * W.goodQuestionBonus +
    ratings * W.quizRated +
    mentorSessions * W.mentorSession +
    plans * W.planCreated +
    posts * W.yomoyamaPost +
    planDone * W.planItemDone +
    (user.isPublic ? W.publicProfile : 0) +
    visitStats.days * W.visit +
    visitStats.weekBonusCount * W.streakWeekBonus;

  const level = levelFromExp(exp);
  const stage = stageForLevel(level);
  const nextStage = STAGES.find((s) => s.minLevel > level) ?? null;

  const cur = expForLevel(level);
  const next = expForLevel(level + 1);
  const levelProgress = Math.min(1, Math.max(0, (exp - cur) / (next - cur)));

  const weekActivities: WeekActivity[] = [];
  const add = (cond: number, label: string, exp: number) => {
    if (cond > 0 && exp > 0) weekActivities.push({ label, exp });
  };
  add(wVisits, wVisits > 1 ? `訪問×${wVisits}` : "訪問", wVisits * W.visit);
  add(wReports, "週報", wReports * W.report);
  add(
    wSuggestions,
    `スキル承認×${wSuggestions}`,
    wSuggestions * W.suggestionApproved
  );
  add(wRoleplays, `演習×${wRoleplays}`, wRoleplays * W.roleplayCompleted);
  add(
    wAttempts,
    `腕試し×${wAttempts}`,
    wAttempts * W.quizAttempt + wCorrects * W.quizCorrectBonus
  );
  add(wAuthored, `作問×${wAuthored}`, wAuthored * W.quizAuthored);
  add(wRatings, `問題を評価×${wRatings}`, wRatings * W.quizRated);
  add(wMentorSessions, `相談×${wMentorSessions}`, wMentorSessions * W.mentorSession);
  add(wPlans, `プラン作成×${wPlans}`, wPlans * W.planCreated);
  add(wPlanDone, `プラン進行×${wPlanDone}`, wPlanDone * W.planItemDone);
  add(wPosts, `よもやま×${wPosts}`, wPosts * W.yomoyamaPost);

  return {
    exp,
    level,
    stage,
    nextStage,
    levelProgress,
    expToNextLevel: next - exp,
    currentStreak: visitStats.currentStreak,
    weekExp: weekActivities.reduce((s, a) => s + a.exp, 0),
    weekActivities,
  };
}
