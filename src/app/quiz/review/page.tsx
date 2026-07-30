import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { dueReviews, reviewSummary, REVIEW_INTERVALS } from "@/lib/quiz/review";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { QuizPlay } from "../play/play-client";

// 復習ボックス。間違えた問題だけを、間隔を空けて出し直す。
// 新しい問題を作らずに学習量を増やす仕組みなので、ここが増えるほど良い。

export default async function QuizReviewPage() {
  const user = await getCurrentUser();
  const [questions, summary] = await Promise.all([
    dueReviews(user.id, 10),
    reviewSummary(user.id),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <PixelLabel>REVIEW — 間違えた問題の出し直し</PixelLabel>
        <PixelTitle as="h1" className="text-2xl text-royal">
          復習ボックス
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          {REVIEW_INTERVALS.join("日後 → ")}日後、と間隔を空けて再出題。3回連続で正解すると卒業です。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Window title="いま復習" titleEm=".now">
          <p className="font-pixel text-2xl text-pinkhot">{summary.due}</p>
          <p className="text-[11.5px] text-inksoft">問</p>
        </Window>
        <Window title="寝かせ中" titleEm=".wait">
          <p className="font-pixel text-2xl text-royal">{summary.waiting}</p>
          <p className="text-[11.5px] text-inksoft">
            {summary.nextDueAt
              ? `次は ${summary.nextDueAt.toISOString().slice(5, 10).replace("-", "/")}`
              : "—"}
          </p>
        </Window>
        <Window title="卒業" titleEm=".ok">
          <p className="font-pixel text-2xl text-[var(--good)]">{summary.graduated}</p>
          <p className="text-[11.5px] text-inksoft">問を克服</p>
        </Window>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border-[2.5px] border-dashed border-royal2 bg-quotebg p-6 text-center">
          <p className="text-[13px]">
            {summary.waiting > 0
              ? "いま出す問題はありません。寝かせ中のぶんは期限が来たらここに並びます。"
              : "復習する問題はありません。腕試しで間違えた問題が、ここに自動で入ります。"}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href="/quiz/play" className="btn8 btn8-start text-[12px]">
              ▶ 腕試しへ
            </Link>
            <Link href="/quiz" className="btn8 text-[12px]">
              ← 良問バンク
            </Link>
          </div>
        </div>
      ) : (
        <QuizPlay questions={questions} />
      )}
    </div>
  );
}
