import { prisma } from "@/lib/db";

// 復習ボックス（間隔反復）。
//
// 間違えた問題を、3日後 → 7日後 → 30日後 と間隔を空けて再出題する。
// 新しい問題を作らずに学習量を増やせるのがこの仕組みの狙いで、
// 必要なデータ（誰がどの問題を間違えたか）は QuizAttempt で既に取れている。
//
// 正解したら次の段階へ、間違えたら最初の段階へ戻る（Leitnerシステムの簡略版）。
// 最終段階を正解したら卒業＝復習対象から外れる。

/** box → 次に出すまでの日数。長さ＝卒業までの段数 */
export const REVIEW_INTERVALS = [3, 7, 30] as const;

const DAY_MS = 86400_000;

function dueAfter(box: number): Date {
  const days = REVIEW_INTERVALS[Math.min(box, REVIEW_INTERVALS.length - 1)];
  return new Date(Date.now() + days * DAY_MS);
}

/**
 * 解答結果を復習ボックスに反映する。
 * - 誤答: 箱に入れる（既にあれば box0 に戻す・卒業も取り消す）
 * - 正答: 箱にある問題だけ1段進める。無い問題は何もしない（そもそも復習対象でない）
 */
export async function recordReviewOutcome(
  userId: string,
  questionId: string,
  correct: boolean
): Promise<void> {
  const existing = await prisma.quizReview.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });

  if (!correct) {
    const data = { box: 0, dueAt: dueAfter(0), graduatedAt: null, lastResult: false };
    if (existing) {
      await prisma.quizReview.update({ where: { id: existing.id }, data });
    } else {
      await prisma.quizReview.create({ data: { userId, questionId, ...data } });
    }
    return;
  }

  if (!existing || existing.graduatedAt) return;

  const nextBox = existing.box + 1;
  if (nextBox >= REVIEW_INTERVALS.length) {
    await prisma.quizReview.update({
      where: { id: existing.id },
      data: { box: nextBox, graduatedAt: new Date(), lastResult: true },
    });
    return;
  }
  await prisma.quizReview.update({
    where: { id: existing.id },
    data: { box: nextBox, dueAt: dueAfter(nextBox), lastResult: true },
  });
}

export type DueReview = {
  id: string;
  topic: string;
  prompt: string;
  choices: string[];
  ratingCount: number;
  box: number;
};

/** いま復習すべき問題（期限が来たもの）を古い順に */
export async function dueReviews(userId: string, limit = 10): Promise<DueReview[]> {
  const rows = await prisma.quizReview.findMany({
    where: { userId, graduatedAt: null, dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: limit,
    include: {
      question: { select: { id: true, topic: true, prompt: true, choices: true, ratingCount: true } },
    },
  });
  return rows.map((r) => ({
    id: r.question.id,
    topic: r.question.topic,
    prompt: r.question.prompt,
    choices: r.question.choices,
    ratingCount: r.question.ratingCount,
    box: r.box,
  }));
}

export type ReviewSummary = {
  /** いま期限が来ている数 */
  due: number;
  /** 箱に入っているが、まだ寝かせ中の数 */
  waiting: number;
  /** 卒業した数 */
  graduated: number;
  /** 次に期限が来る日時（寝かせ中がある場合） */
  nextDueAt: Date | null;
};

export async function reviewSummary(userId: string): Promise<ReviewSummary> {
  const now = new Date();
  const [due, waiting, graduated, next] = await Promise.all([
    prisma.quizReview.count({ where: { userId, graduatedAt: null, dueAt: { lte: now } } }),
    prisma.quizReview.count({ where: { userId, graduatedAt: null, dueAt: { gt: now } } }),
    prisma.quizReview.count({ where: { userId, graduatedAt: { not: null } } }),
    prisma.quizReview.findFirst({
      where: { userId, graduatedAt: null, dueAt: { gt: now } },
      orderBy: { dueAt: "asc" },
      select: { dueAt: true },
    }),
  ]);
  return { due, waiting, graduated, nextDueAt: next?.dueAt ?? null };
}
