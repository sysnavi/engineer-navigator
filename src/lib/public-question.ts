import { prisma } from "@/lib/db";

// 良問の公開ページ（/q/[id]・Issue #14 Phase 2）のデータ層。
//
// 公開方針:
//  - ページ(/q/[id])自体は存在する問題なら誰でも開ける（共有リンクが機能するように）。
//  - ただし検索インデックス対象（sitemap掲載＋indexable）は「良問」だけ＝
//    評価が付いていて平均が一定以上。薄い/未評価のUGCを検索に載せないため。
//  - 正解と解説は返さない。答えの段差（登録/ログインで見せる）はページ側で作る。
//    ここで answerIndex/explanation を返さないことで、未ログインのHTMLに答えが
//    混ざらないことを構造的に保証する。

// 良問の下限（評価は0〜10スケール）。ここを満たすと sitemap 掲載＋indexable。
export const PUBLIC_QUESTION_MIN_AVG = 6;
export const PUBLIC_QUESTION_MIN_RATINGS = 1;

function isGoodQuestion(q: { ratingSum: number; ratingCount: number }): boolean {
  return (
    q.ratingCount >= PUBLIC_QUESTION_MIN_RATINGS &&
    q.ratingSum / q.ratingCount >= PUBLIC_QUESTION_MIN_AVG
  );
}

/** 公開問題ページ用（正解・解説は含めない）。indexable=良問なら検索対象 */
export async function loadPublicQuestion(id: string) {
  const q = await prisma.quizQuestion.findUnique({
    where: { id },
    select: {
      id: true,
      topic: true,
      prompt: true,
      choices: true,
      ratingSum: true,
      ratingCount: true,
      createdAt: true,
      // 出題者は公開設定に従ってのみ出す
      author: { select: { name: true, handle: true, isPublic: true } },
    },
  });
  if (!q) return null;

  const avg = q.ratingCount > 0 ? q.ratingSum / q.ratingCount : null;
  const author =
    q.author.isPublic && q.author.handle
      ? { name: q.author.name, handle: q.author.handle }
      : null;

  return {
    id: q.id,
    topic: q.topic,
    prompt: q.prompt,
    choices: q.choices,
    ratingCount: q.ratingCount,
    avg,
    createdAt: q.createdAt,
    author,
    indexable: isGoodQuestion(q),
  };
}

/** ログイン済みユーザー向けに、正解と解説だけを別取得する（段差の“奥”） */
export async function loadQuestionAnswer(id: string) {
  return prisma.quizQuestion.findUnique({
    where: { id },
    select: { answerIndex: true, explanation: true },
  });
}

/** sitemap用: 良問だけを列挙（検索に載せるのは質の高いものに絞る） */
export async function listPublicQuestions() {
  const rows = await prisma.quizQuestion.findMany({
    where: { ratingCount: { gte: PUBLIC_QUESTION_MIN_RATINGS } },
    select: { id: true, ratingSum: true, ratingCount: true, createdAt: true },
    orderBy: { ratingSum: "desc" },
    take: 5000,
  });
  return rows.filter(isGoodQuestion).map((q) => ({ id: q.id, createdAt: q.createdAt }));
}
