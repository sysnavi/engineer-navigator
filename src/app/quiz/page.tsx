import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { getOrCreateDaily } from "@/lib/quiz/daily";
import { reviewSummary } from "@/lib/quiz/review";
import { CERTIFICATIONS } from "@/lib/certifications";
import { StreakBar } from "@/components/streak-bar";

// 良問バンクのハブ。今日の一問 / 復習 / 腕試し / 資格の範囲 / 統計・良問ランキング。
//
// 導線の優先順は「今日やること（デイリー・復習）」→「自由に解く」の順。
// 10問セットの腕試しだけだと、疲れている日に開く動機がないため。

export default async function QuizHubPage() {
  const user = await getCurrentUser();

  const [daily, review, certCounts] = await Promise.all([
    getOrCreateDaily(user.id),
    reviewSummary(user.id),
    prisma.quizQuestion.groupBy({ by: ["topic"], _count: { _all: true } }),
  ]);
  const countByTopic = new Map(certCounts.map((c) => [c.topic, c._count._all]));

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
          四択で力試し。
        </p>
      </div>

      <StreakBar streak={daily.streak} best={daily.bestStreak} />

      {/* 今日やること（1問だけ／復習）。ここが空でない限りトップに出す */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/quiz/daily"
          className={`flex items-center justify-between gap-3 rounded-lg border-[2.5px] p-4 shadow-hard-sm transition-transform hover:-translate-y-0.5 ${
            daily.answered
              ? "border-line8 bg-surface2"
              : "border-royal2 bg-quotebg"
          }`}
        >
          <span className="min-w-0">
            <span className="block font-pixel text-[11px] tracking-wide text-inksoft">
              DAILY
            </span>
            <span className="block text-[15px] font-extrabold">
              今日の一問
            </span>
            <span className="block truncate text-[12px] text-inksoft">
              {!daily.question
                ? "出題できる問題がまだありません"
                : daily.answered
                  ? "達成ずみ。またあした！"
                  : `1問だけ・${daily.question.topic}`}
            </span>
          </span>
          <span aria-hidden className="shrink-0 font-pixel text-2xl">
            {daily.answered ? "✓" : "▶"}
          </span>
        </Link>

        <Link
          href="/quiz/review"
          className={`flex items-center justify-between gap-3 rounded-lg border-[2.5px] p-4 shadow-hard-sm transition-transform hover:-translate-y-0.5 ${
            review.due > 0 ? "border-pinkhot bg-quotebg" : "border-line8 bg-surface2"
          }`}
        >
          <span className="min-w-0">
            <span className="block font-pixel text-[11px] tracking-wide text-inksoft">
              REVIEW
            </span>
            <span className="block text-[15px] font-extrabold">復習ボックス</span>
            <span className="block truncate text-[12px] text-inksoft">
              {review.due > 0
                ? `間違えた${review.due}問が復習どき`
                : review.waiting > 0
                  ? `寝かせ中 ${review.waiting}問`
                  : "間違えた問題がここに貯まります"}
            </span>
          </span>
          <span
            className={`shrink-0 font-pixel text-2xl ${review.due > 0 ? "text-pinkhot" : "text-inksoft"}`}
          >
            {review.due > 0 ? review.due : "—"}
          </span>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Link href="/quiz/play" className="btn8 btn8-start text-[13px]">
          ▶ 腕試しを始める
        </Link>
        {/* 出題はゲスト不可（Issue #18）。押しても弾かれるボタンは見せない */}
        {user.role !== "GUEST" && (
          <Link href="/quiz/new" className="btn8 text-[13px]">
            ＋ 問題を作る
          </Link>
        )}
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

      {/* 資格の範囲から選ぶ（src/lib/certifications.ts のカタログ）。
          学習プランと同じ章立てなので、プラン→腕試しの往復ができる */}
      <Window title="資格の範囲から選ぶ" titleEm=".cert">
        <div className="space-y-3">
          {CERTIFICATIONS.map((c) => (
            <div key={c.id}>
              <p className="mb-1 text-[12.5px] font-extrabold">
                <span aria-hidden>{c.emoji}</span> {c.label}
                <span className="ml-1.5 text-[11px] font-normal text-inksoft">
                  {c.hint}
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {c.chapters.map((ch) => {
                  const n = countByTopic.get(ch.topic) ?? 0;
                  return n > 0 ? (
                    <Link
                      key={ch.id}
                      href={`/quiz/play?topic=${encodeURIComponent(ch.topic)}`}
                      className="rounded border-2 border-line8 bg-surface px-2 py-1 text-[11.5px] shadow-hard-sm hover:bg-royal hover:text-white"
                    >
                      {ch.topic}
                      <span className="ml-1 font-pixel text-[9px] text-inksoft">
                        {n}
                      </span>
                    </Link>
                  ) : (
                    <span
                      key={ch.id}
                      className="rounded border-2 border-dashed border-grid8 px-2 py-1 text-[11.5px] text-inksoft"
                      title="この範囲の問題はまだありません"
                    >
                      {ch.topic}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-inksoft">
          学習プランを作ると、週ごとにこの範囲へ直接飛べます。
        </p>
        <Link href="/plan" className="btn8 mt-2 inline-block text-[12px]">
          ▶ 学習プランを作る
        </Link>
      </Window>
    </div>
  );
}
