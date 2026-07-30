import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateDaily } from "@/lib/quiz/daily";
import { PixelTitle, PixelLabel } from "@/components/retro";
import { QuizPlay } from "../play/play-client";
import { StreakBar } from "@/components/streak-bar";

// 今日の一問。1日1問だけ、その人に固定の問題を出す。
// 「今日やることが1つに決まっている」状態を作るのが目的なので、
// 出題は必ず1問で、解いたら明日まで何も出さない（おかわりは通常の腕試しへ）。

export default async function QuizDailyPage() {
  const user = await getCurrentUser();
  const daily = await getOrCreateDaily(user.id);

  return (
    <div className="space-y-5">
      <div>
        <PixelLabel>DAILY — 1日1問</PixelLabel>
        <PixelTitle as="h1" className="text-2xl text-royal">
          今日の一問
        </PixelTitle>
      </div>

      <StreakBar streak={daily.streak} best={daily.bestStreak} />

      {!daily.question ? (
        <div className="rounded-lg border-[2.5px] border-dashed border-royal2 bg-quotebg p-6 text-center">
          <p className="text-[13px]">出題できる問題がまだありません。</p>
          <Link href="/quiz/new" className="btn8 btn8-start mt-3 inline-block text-[12px]">
            ＋ 最初の問題を作る
          </Link>
        </div>
      ) : daily.answered ? (
        <div className="rounded-lg border-[2.5px] border-line8 bg-surface p-6 text-center shadow-hard-sm">
          <p className="font-pixel text-[11px] tracking-wide text-inksoft">DONE</p>
          <p className="mt-2 font-pixel text-3xl text-royal">
            {daily.correct ? "◎ 正解" : "✕ 不正解"}
          </p>
          <p className="mt-2 text-[13px]">
            今日のぶんは達成ずみ。次の一問はあしたの朝に。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/quiz/play" className="btn8 btn8-start text-[12px]">
              ▶ もっと解く（腕試し）
            </Link>
            <Link href="/quiz" className="btn8 text-[12px]">
              ← 良問バンク
            </Link>
          </div>
        </div>
      ) : (
        <QuizPlay questions={[daily.question]} />
      )}
    </div>
  );
}
