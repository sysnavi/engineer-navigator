// 「したく」パネル。きょうの活動が潜行にどう乗っているかを見せる。
//
// この機能の効果の大半はここにある。効果そのものより **見えていること** が動機を作る。
// とくに「きょうはもう潜れません」で終わらせず、
// **「あと1問正解すると もう一回潜れる」** と次の一手を出すのが狙い
// （行き止まりを入口に変える）。

import Link from "next/link";
import { PixelLabel } from "@/components/retro";
import type { DivePrep } from "@/lib/dungeon/prep";
import { MAX_DIVES_PER_DAY } from "@/lib/dungeon/prep";

export function PrepPanel(props: {
  prep: DivePrep;
  /** きょう既に潜った回数 */
  divesToday: number;
  /** いま潜れるか */
  canDive: boolean;
}) {
  const { prep } = props;
  const left = Math.max(0, Math.min(MAX_DIVES_PER_DAY, 1 + prep.earnedSlots) - props.divesToday);

  // 次の一手: まだ枠を増やせる活動のうち、いちばん近いものを1つ出す
  const nextStep = !props.canDive
    ? prep.quizNewCorrect < 3
      ? { text: `腕試しで あと${3 - prep.quizNewCorrect}問 正解すると、もう一回潜れる`, href: "/quiz/play" }
      : !prep.mentorToday && prep.planDoneToday === 0
        ? { text: "AIメンターに相談すると、もう一回潜れる", href: "/mentor" }
        : null
    : null;

  return (
    <div className="mt-4 rounded-lg border-2 border-dashed border-peri bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <PixelLabel>したく — きょうの活動が 潜行に乗る</PixelLabel>
        <span className="font-pixel text-[10.5px] tracking-wide text-royal2">
          潜れる回数 {props.divesToday}/{Math.min(MAX_DIVES_PER_DAY, 1 + prep.earnedSlots)}
          <span className="ml-1 text-inksoft">（1日{MAX_DIVES_PER_DAY}回まで）</span>
        </span>
      </div>

      <ul className="mt-2 space-y-1">
        {prep.sources.map((s) => (
          <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
            <span className={s.done ? "text-royal2" : "text-inksoft"}>
              {s.done ? "✓" : "○"}
            </span>
            <span className={`font-bold ${s.done ? "" : "text-inksoft"}`}>{s.label}</span>
            {s.done ? (
              <span className="text-inksoft">{s.effect}</span>
            ) : (
              <Link href={s.href} className="text-royal2 underline-offset-2 hover:underline">
                {s.hint}
              </Link>
            )}
          </li>
        ))}
      </ul>

      {nextStep && (
        <Link
          href={nextStep.href}
          className="mt-2.5 flex items-center gap-2 rounded-lg border-2 border-line8 bg-win px-2.5 py-2 text-[12.5px] font-bold shadow-hard-sm hover:bg-quotebg"
        >
          <span aria-hidden="true">▶</span>
          {nextStep.text}
        </Link>
      )}
      {left > 0 && props.canDive && prep.earnedSlots > 0 && (
        <p className="mt-2 font-pixel text-[10px] tracking-wide text-inksoft">
          きょうの活動で {prep.earnedSlots} 回ぶん 増えました
        </p>
      )}
    </div>
  );
}
