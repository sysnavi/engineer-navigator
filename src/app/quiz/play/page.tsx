import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PixelTitle, PixelLabel } from "@/components/retro";
import { QuizPlay } from "./play-client";

// 出題: 自作以外の問題を、未解答→良問(評価高)の順で最大10問。正解は渡さない。

export default async function QuizPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const user = await getCurrentUser();

  const [candidates, attempts] = await Promise.all([
    prisma.quizQuestion.findMany({
      where: {
        authorId: { not: user.id },
        // 「もう表示しない」に指定した問題は除外
        hiddenBy: { none: { userId: user.id } },
        ...(topic ? { topic } : {}),
      },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        topic: true,
        prompt: true,
        choices: true,
        ratingSum: true,
        ratingCount: true,
      },
    }),
    prisma.quizAttempt.findMany({
      where: { userId: user.id },
      distinct: ["questionId"],
      select: { questionId: true },
    }),
  ]);

  const attempted = new Set(attempts.map((a) => a.questionId));
  const avg = (q: { ratingSum: number; ratingCount: number }) =>
    q.ratingCount > 0 ? q.ratingSum / q.ratingCount : -1;
  const sorted = [...candidates]
    .sort((a, b) => {
      const au = attempted.has(a.id) ? 1 : 0;
      const bu = attempted.has(b.id) ? 1 : 0;
      if (au !== bu) return au - bu; // 未解答を先に
      return avg(b) - avg(a); // 良問（高評価）を先に
    })
    .slice(0, 10)
    .map((q) => ({
      id: q.id,
      topic: q.topic,
      prompt: q.prompt,
      choices: q.choices,
      ratingCount: q.ratingCount,
    }));

  return (
    <div className="space-y-5">
      <div>
        <PixelLabel>QUIZ{topic ? ` — ${topic}` : ""}</PixelLabel>
        <PixelTitle as="h1" className="text-2xl text-royal">
          腕試し
        </PixelTitle>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border-[2.5px] border-dashed border-royal2 bg-quotebg p-6 text-center">
          <p className="text-[13px]">
            {topic
              ? `「${topic}」の問題がまだありません。`
              : "解ける問題がまだありません（自作の問題は出題されません）。"}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Link href="/quiz/new" className="btn8 btn8-start text-[12px]">
              ＋ 最初の問題を作る
            </Link>
            <Link href="/quiz" className="btn8 text-[12px]">
              ← 良問バンク
            </Link>
          </div>
        </div>
      ) : (
        <QuizPlay questions={sorted} />
      )}
    </div>
  );
}
