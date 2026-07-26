// 「したく」— その日の活動が潜行に乗る（Issue: ダンジョンへの動機づけ）。
//
// 【方針】潜れる回数は厳しく上限を切り（1日3回・持ち越しなし）、そのかわり
// **積み上げが潜行の質に乗る**。回数を配って通わせるのではなく、
// 「今日やったことが、今日の潜行を強くする」形にして依存を煽らずに動機を作る。
//
// 【ファーミング対策】腕試しは「**今日はじめて正解した問題**」だけを数える。
// QuizAttempt には (userId, questionId) の一意制約が無く同じ問題を何度も解けるので、
// 単純に「今日の正解数」で数えると解き直しで無限に稼げてしまう。

import { prisma } from "@/lib/db";

/** 1日に潜れる上限（日次＋週報ボーナス＋獲得ぶんを合わせた総数） */
export const MAX_DIVES_PER_DAY = 3;

/** 腕試しで枠を1つ得るのに必要な「今日はじめて正解した問題」の数 */
const QUIZ_FOR_SLOT = 3;
/** 開始深度が1階深くなるのに必要な正解数 */
const QUIZ_PER_DEPTH = 2;
const MAX_DEPTH_BONUS = 3;
const MAX_STAT_BONUS = 3;
const MAX_EXTRA_ITEM_SLOTS = 2;

export type PrepSource = {
  id: string;
  label: string;
  /** 達成済みか */
  done: boolean;
  /** いまの効果（達成済みのとき） */
  effect: string;
  /** あと何をすればよいか（未達のとき） */
  hint: string;
  href: string;
};

export type DivePrep = {
  /** 活動で得た追加の潜行枠（0-2） */
  earnedSlots: number;
  /** 出発が何階深くなるか */
  startDepthBonus: number;
  atkBonus: number;
  defBonus: number;
  /** 知恵の護符（戦闘中1回だけHP全快） */
  charms: number;
  /** どうぐの持ち込み枠（既定1） */
  itemSlots: number;
  /** 画面表示用の内訳 */
  sources: PrepSource[];
  /** 実績の生値 */
  quizNewCorrect: number;
  mentorToday: boolean;
  approvedToday: number;
  planDoneToday: number;
};

function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * きょうの活動を集計して、潜行への効果に変換する。
 * 「今日」はローカル日付の0時から（潜行枠の d:YYYY-MM-DD と同じ区切り）。
 */
export async function getDivePrep(userId: string): Promise<DivePrep> {
  const since = startOfToday();

  const [todayCorrect, mentorCount, approvedCount, planDoneCount] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId, correct: true, createdAt: { gte: since } },
      select: { questionId: true },
      distinct: ["questionId"],
    }),
    prisma.mentorSession.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.skillSuggestion.count({
      where: { userId, status: "APPROVED", decidedAt: { gte: since } },
    }),
    prisma.studyPlanItem.count({
      where: { plan: { userId }, done: true, doneAt: { gte: since } },
    }),
  ]);

  // 「今日はじめて正解した問題」だけを数える（解き直しでは増えない）
  const ids = todayCorrect.map((a) => a.questionId);
  let quizNewCorrect = 0;
  if (ids.length > 0) {
    const earlier = await prisma.quizAttempt.findMany({
      where: {
        userId,
        correct: true,
        questionId: { in: ids },
        createdAt: { lt: since },
      },
      select: { questionId: true },
      distinct: ["questionId"],
    });
    const seen = new Set(earlier.map((a) => a.questionId));
    quizNewCorrect = ids.filter((id) => !seen.has(id)).length;
  }

  const mentorToday = mentorCount > 0;
  const startDepthBonus = Math.min(MAX_DEPTH_BONUS, Math.floor(quizNewCorrect / QUIZ_PER_DEPTH));
  const statBonus = Math.min(MAX_STAT_BONUS, approvedCount);
  const itemSlots = 1 + Math.min(MAX_EXTRA_ITEM_SLOTS, planDoneCount);

  // 追加枠: 腕試しで1つ、メンター相談 or プラン完了で1つ（合計最大2）
  const earnedSlots =
    (quizNewCorrect >= QUIZ_FOR_SLOT ? 1 : 0) + (mentorToday || planDoneCount > 0 ? 1 : 0);

  const sources: PrepSource[] = [
    {
      id: "quiz",
      label: "腕試し",
      done: quizNewCorrect > 0,
      effect:
        startDepthBonus > 0
          ? `${quizNewCorrect}問正解 → 地下+${startDepthBonus}階から出発`
          : `${quizNewCorrect}問正解`,
      hint:
        quizNewCorrect < QUIZ_FOR_SLOT
          ? `あと${QUIZ_FOR_SLOT - quizNewCorrect}問 正解すると もう一回潜れる`
          : `あと${QUIZ_PER_DEPTH - (quizNewCorrect % QUIZ_PER_DEPTH)}問で さらに深くから出発`,
      href: "/quiz/play",
    },
    {
      id: "mentor",
      label: "AIメンター",
      done: mentorToday,
      effect: mentorToday ? "知恵の護符 ×1（戦闘中にHP全快）" : "",
      hint: "相談すると 護符をひとつ持って行ける",
      href: "/mentor",
    },
    {
      id: "skills",
      label: "スキル承認",
      done: approvedCount > 0,
      effect: statBonus > 0 ? `${approvedCount}件承認 → ATK+${statBonus} DEF+${statBonus}` : "",
      hint: "スキル提案を承認すると 攻撃と防御が上がる",
      href: "/skills",
    },
    {
      id: "plan",
      label: "学習プラン",
      done: planDoneCount > 0,
      effect:
        planDoneCount > 0 ? `${planDoneCount}項目 完了 → どうぐ枠 ${itemSlots}個` : "",
      hint: "項目をひとつ終えると どうぐを多く持ち込める",
      href: "/plan",
    },
  ];

  return {
    earnedSlots,
    startDepthBonus,
    atkBonus: statBonus,
    defBonus: statBonus,
    charms: mentorToday ? 1 : 0,
    itemSlots,
    sources,
    quizNewCorrect,
    mentorToday,
    approvedToday: approvedCount,
    planDoneToday: planDoneCount,
  };
}
