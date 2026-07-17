import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";

// 良問バンクのハブ。腕試し開始 / 問題作成 / お題別 / 自分の統計・良問ランキング。

export default async function QuizHubPage() {
  const user = await getCurrentUser();

  const [totalQuestions, myAttempts, myQuestions, topics, topRated] =
    await Promise.all([
      prisma.quizQuestion.count(),
      prisma.quizAttempt.findMany({
        where: { userId: user.id },
        select: { correct: true },
      }),
      prisma.quizQuestion.count({ where: { authorId: user.id } }),
      prisma.quizQuestion.groupBy({
        by: ["topic"],
        _count: { _all: true },
        orderBy: { _count: { topic: "desc" } },
        take: 12,
      }),
      prisma.quizQuestion.findMany({
        where: { ratingCount: { gt: 0 } },
        orderBy: [{ ratingSum: "desc" }],
        take: 5,
        select: {
          id: true,
          topic: true,
          prompt: true,
          ratingSum: true,
          ratingCount: true,
          author: { select: { handle: true, name: true } },
        },
      }),
    ]);

  const attemptCount = myAttempts.length;
  const correctCount = myAttempts.filter((a) => a.correct).length;
  const accuracy =
    attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <PixelLabel>QUIZ BANK — みんなで育てる問題集</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          良問バンク
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          四択を解いて力試し。良いと思った問題を評価すると、みんなの平均で良問が上位に育ちます。
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Link href="/quiz/play" className="btn8 btn8-start text-[13px]">
          ▶ 腕試しを始める
        </Link>
        <Link href="/quiz/new" className="btn8 text-[13px]">
          ＋ 問題を作る
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Window title="YOUR STATS" titleEm=".sav">
          <p className="text-[12px] text-inksoft">解答数</p>
          <p className="font-pixel text-2xl text-royal">{attemptCount}</p>
          <p className="mt-2 text-[12px] text-inksoft">正答率</p>
          <p className="font-pixel text-2xl text-royal">
            {accuracy === null ? "—" : `${accuracy}%`}
          </p>
          <p className="mt-2 text-[11px] text-inksoft">
            作った問題: {myQuestions}問 ／ 全問題: {totalQuestions}問
          </p>
        </Window>

        <Window title="お題で選ぶ" titleEm=".idx">
          {topics.length === 0 ? (
            <p className="py-2 text-[12.5px] text-inksoft">
              まだ問題がありません。作ってみましょう。
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <Link
                  key={t.topic}
                  href={`/quiz/play?topic=${encodeURIComponent(t.topic)}`}
                  className="rounded border-2 border-line8 bg-surface px-2 py-1 text-[11.5px] shadow-hard-sm hover:bg-royal hover:text-white"
                >
                  {t.topic}
                  <span className="ml-1 font-pixel text-[9px] text-inksoft">
                    {t._count._all}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Window>

        <Window title="良問ランキング" titleEm=".top">
          {topRated.length === 0 ? (
            <p className="py-2 text-[12.5px] text-inksoft">
              評価が集まると良問が並びます。
            </p>
          ) : (
            <ol className="space-y-2">
              {topRated.map((q, idx) => {
                const avg = (q.ratingSum / q.ratingCount).toFixed(1);
                return (
                  <li key={q.id} className="text-[12px]">
                    <span className="font-pixel text-[11px] text-pinkhot">
                      {idx + 1}.
                    </span>{" "}
                    <span className="font-bold">★{avg}</span>{" "}
                    <span className="text-inksoft">({q.topic})</span>
                    <span className="block truncate text-inksoft">
                      {q.prompt}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Window>
      </div>
    </div>
  );
}
