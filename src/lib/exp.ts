import { cache } from "react";
import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";
import {
  geneById,
  genesFromExpBySource,
  lineageTitle,
  pureRunOf,
  type GeneDef,
} from "@/lib/genes";

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

// 進化段階（レベルと世代から決定的に決まる。保存不要）。
// minGeneration 付きは継承（転生）でしか辿り着けない形態（Issue #1: 周回が最強への道）
export type AvatarStage = {
  minLevel: number;
  minGeneration?: number; // 省略時は 1（初代から到達可能）
  name: string;
  sprite:
    | "egg"
    | "chick"
    | "minarai"
    | "ichininmae"
    | "meister"
    | "goldegg"
    | "sage"
    | "legend";
};
export const STAGES: AvatarStage[] = [
  { minLevel: 1, name: "たまご", sprite: "egg" },
  { minLevel: 1, minGeneration: 2, name: "きんのたまご", sprite: "goldegg" },
  { minLevel: 3, name: "ひよこ", sprite: "chick" },
  { minLevel: 5, name: "みならい", sprite: "minarai" },
  { minLevel: 7, name: "いちにんまえ", sprite: "ichininmae" },
  { minLevel: 12, name: "マイスター", sprite: "meister" },
  { minLevel: 14, minGeneration: 2, name: "けんじゃ", sprite: "sage" },
  { minLevel: 16, minGeneration: 3, name: "でんせつ", sprite: "legend" },
];

// 転生（継承）の解放条件: 現世代でマイスター（Lv12）に到達していること
export const REBIRTH_MIN_LEVEL = 12;
// 遺産: 現世代EXPの5%が次世代の初期EXPになる
export const BEQUEST_RATE = 0.05;

export function stageFor(level: number, generation: number): AvatarStage {
  let cur = STAGES[0];
  for (const s of STAGES)
    if (level >= s.minLevel && generation >= (s.minGeneration ?? 1)) cur = s;
  return cur;
}
/** 後方互換: 世代1として解決（公開ビュー等、世代を持たない文脈用） */
export function stageForLevel(level: number): AvatarStage {
  return stageFor(level, 1);
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

// 世代集計（AvatarGeneration.summary の中身）。
// cumulative は転生時点の生涯集計（次世代の遺伝子判定の基準点）、inGen はその世代分の差分
export type GenerationSummary = {
  cumulative: { expBySource: Record<string, number>; counts: Record<string, number> };
  inGen: { expBySource: Record<string, number>; counts: Record<string, number> };
};

export type PlayerGenes = {
  dominant: GeneDef;
  recessive: GeneDef | null;
  title: string; // 血統の称号（組み合わせ限定・純血統）
  pureRun: number; // 同じ優性遺伝子が連続した世代数
};

export type PlayerStats = {
  exp: number; // 現世代EXP（レベル・進化はこれで決まる）
  lifetimeExp: number; // 生涯EXP（積み上げは消えない）
  level: number;
  generation: number; // 第何世代か（1始まり）
  genes: PlayerGenes | null; // 初代は null（遺伝子は継承で得る）
  canRebirth: boolean; // 転生（継承）可能か = 現世代Lvが REBIRTH_MIN_LEVEL 以上
  stage: AvatarStage;
  nextStage: AvatarStage | null;
  levelProgress: number; // 現レベル帯の進捗（EXPバー用・0..1）
  expToNextLevel: number;
  currentStreak: number; // 連続訪問日数
  weekExp: number;
  weekActivities: WeekActivity[];
  // 転生処理・家系図用の生涯集計（表示には使わない）
  expBySource: Record<string, number>;
  activityCounts: Record<string, number>;
};

/** プレイヤーのEXP/レベル/今週の獲得内訳を既存データから導出する。
 *  React cache でリクエスト内メモ化（layoutとページの二重呼び出しをDB1回に） */
export const getPlayerStats = cache(async (userId: string): Promise<PlayerStats> => {
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
    pastGenerations,
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
    prisma.avatarGeneration.findMany({
      where: { userId },
      orderBy: { gen: "asc" },
      select: { gen: true, expSnapshot: true, bequest: true, dominantGene: true, recessiveGene: true },
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
  // 生涯のソース別EXP（遺伝子判定・転生時のサマリ確定に使う）
  const activityCounts: Record<string, number> = {
    report: reports,
    publicReport: publicReports,
    suggestionApproved: suggestionsApproved,
    roleplayCompleted: roleplays,
    quizAttempt: attempts,
    quizCorrectBonus: corrects,
    quizAuthored: authored,
    goodQuestionBonus: goodCount,
    quizRated: ratings,
    mentorSession: mentorSessions,
    planCreated: plans,
    yomoyamaPost: posts,
    planItemDone: planDone,
    publicProfile: user.isPublic ? 1 : 0,
    visit: visitStats.days,
    streakWeekBonus: visitStats.weekBonusCount,
  };
  const expBySource = Object.fromEntries(
    Object.entries(activityCounts).map(([k, n]) => [
      k,
      n * (W[k as keyof typeof W] ?? 0),
    ])
  );
  const lifetimeExp = Object.values(expBySource).reduce((s, v) => s + v, 0);

  // 継承（転生）: 現世代EXP = 生涯EXP − 転生時点のスナップショット + 遺産。
  // EXP重み変更や投稿削除で生涯EXPが目減りしても負にならないよう0クランプ
  const lastGen = pastGenerations.at(-1);
  const generation = pastGenerations.length + 1;
  const exp =
    Math.max(0, lifetimeExp - (lastGen?.expSnapshot ?? 0)) +
    (lastGen?.bequest ?? 0);

  // 現世代の遺伝子 = 直前の世代（親）から継承したもの
  let genes: PlayerGenes | null = null;
  if (lastGen) {
    const dominant = geneById(lastGen.dominantGene);
    if (dominant) {
      const pureRun = pureRunOf(pastGenerations.map((g) => g.dominantGene));
      genes = {
        dominant,
        recessive: geneById(lastGen.recessiveGene),
        title: lineageTitle(dominant.id, geneById(lastGen.recessiveGene)?.id ?? null, pureRun),
        pureRun,
      };
    }
  }

  const level = levelFromExp(exp);
  const stage = stageFor(level, generation);
  // 次の進化: 現世代のままで到達できる形態のみ案内する
  const nextStage =
    STAGES.find(
      (s) => s.minLevel > level && generation >= (s.minGeneration ?? 1)
    ) ?? null;

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
    lifetimeExp,
    level,
    generation,
    genes,
    canRebirth: level >= REBIRTH_MIN_LEVEL,
    stage,
    nextStage,
    levelProgress,
    expToNextLevel: next - exp,
    currentStreak: visitStats.currentStreak,
    weekExp: weekActivities.reduce((s, a) => s + a.exp, 0),
    weekActivities,
    expBySource,
    activityCounts,
  };
});

export type RebirthResult = {
  endedGen: number; // 卵を産んで終えた世代
  newGen: number; // 生まれた世代
  levelAtEnd: number;
  stageAtEnd: string;
  dominant: GeneDef;
  recessive: GeneDef | null;
  title: string;
  bequest: number;
  // 新世代の開始状態（遺産EXPで即レベルアップしている場合があるので実値を返す）
  newLevel: number;
  newStageName: string;
  newSprite: string;
};

/** 転生（継承）を実行する。本人の明示操作からのみ呼ぶこと（Issue #1: 勝手に起きない）。
 *  完了世代の実績から遺伝子を確定し、AvatarGeneration に墓標を1行残す。
 *  週報・投稿・スキル等のデータは一切消さない（生涯EXPは導出のまま永続）。 */
export async function performRebirth(userId: string): Promise<RebirthResult> {
  const stats = await getPlayerStats(userId);
  if (!stats.canRebirth) {
    throw new Error(
      `転生にはマイスター（Lv${REBIRTH_MIN_LEVEL}）到達が必要です`
    );
  }

  // 直前の転生時点の生涯集計（この世代分の差分を出す基準点）
  const prev = await prisma.avatarGeneration.findFirst({
    where: { userId },
    orderBy: { gen: "desc" },
    select: { summary: true, dominantGene: true },
  });
  const prevCum = (prev?.summary as GenerationSummary | null)?.cumulative;

  const delta = (cur: Record<string, number>, base?: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(cur).map(([k, v]) => [k, Math.max(0, v - (base?.[k] ?? 0))])
    );
  const inGenExp = delta(stats.expBySource, prevCum?.expBySource);
  const inGenCounts = delta(stats.activityCounts, prevCum?.counts);

  const { dominant, recessive } = genesFromExpBySource(inGenExp);
  const summary: GenerationSummary = {
    cumulative: { expBySource: stats.expBySource, counts: stats.activityCounts },
    inGen: { expBySource: inGenExp, counts: inGenCounts },
  };
  const bequest = Math.round(stats.exp * BEQUEST_RATE);

  // gen の @@unique([userId, gen]) が二重転生（連打・並行リクエスト）を弾く
  await prisma.avatarGeneration.create({
    data: {
      userId,
      gen: stats.generation,
      expSnapshot: stats.lifetimeExp,
      expInGen: stats.exp,
      levelAtEnd: stats.level,
      stageAtEnd: stats.stage.name,
      spriteAtEnd: stats.stage.sprite,
      dominantGene: dominant,
      recessiveGene: recessive,
      bequest,
      summary,
    },
  });

  const domDef = geneById(dominant)!;
  const recDef = geneById(recessive);
  // 称号は「新世代が受け継いだ血統」として計算（純血統は今回の優性も数える）
  const pureRun = pureRunOf([
    ...(await prisma.avatarGeneration.findMany({
      where: { userId },
      orderBy: { gen: "asc" },
      select: { dominantGene: true },
    })).map((g) => g.dominantGene),
  ]);
  const newGen = stats.generation + 1;
  const newLevel = levelFromExp(bequest);
  const newStage = stageFor(newLevel, newGen);
  return {
    endedGen: stats.generation,
    newGen,
    levelAtEnd: stats.level,
    stageAtEnd: stats.stage.name,
    dominant: domDef,
    recessive: recDef,
    title: lineageTitle(dominant, recessive, pureRun),
    bequest,
    newLevel,
    newStageName: newStage.name,
    newSprite: newStage.sprite,
  };
}

/** 家系図（マイページ用）: 歴代世代を新しい順に */
export async function getLineage(userId: string) {
  const rows = await prisma.avatarGeneration.findMany({
    where: { userId },
    orderBy: { gen: "desc" },
  });
  return rows.map((r) => ({
    gen: r.gen,
    endedAt: r.endedAt,
    expInGen: r.expInGen,
    levelAtEnd: r.levelAtEnd,
    stageAtEnd: r.stageAtEnd,
    spriteAtEnd: r.spriteAtEnd,
    dominant: geneById(r.dominantGene),
    recessive: geneById(r.recessiveGene),
    bequest: r.bequest,
    counts: ((r.summary as GenerationSummary | null)?.inGen?.counts ?? {}) as Record<string, number>,
  }));
}
