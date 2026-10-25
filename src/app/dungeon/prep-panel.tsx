// 「したく」パネル。きょうの活動が潜行に乗っている分だけを、獲得済みのステータスとして見せる。
//
// 未達の活動を「○○すると△△」と常時並べるとルール説明になってしまうので出さない。
// ヒントを出すのは **潜れる回数を使い切ったときだけ**。そこで「きょうはもう潜れません」で
// 終わらせず、**「あと1問正解すると もう一回潜れる」** と次の一手をひとつだけ出す
// （行き止まりを入口に変える）。
// まだ何も積んでおらず潜れる状態なら、パネルごと出さない。

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
  const cap = Math.min(MAX_DIVES_PER_DAY, 1 + prep.earnedSlots);
  const left = Math.max(0, cap - props.divesToday);
  const done = prep.sources.filter((s) => s.done);

  // 次の一手: 潜り切ったときだけ、まだ枠を増やせる活動のうちいちばん近いものを1つ出す
  const nextStep = !props.canDive
    ? prep.quizNewCorrect < 3
      ? { text: `腕試しで あと${3 - prep.quizNewCorrect}問 正解すると、もう一回潜れる`, href: "/quiz/play" }
      : !prep.mentorToday && prep.planDoneToday === 0
        ? { text: "AIメンターに相談すると、もう一回潜れる", href: "/mentor" }
        : null
    : null;

  if (props.canDive && done.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border-2 border-dashed border-peri bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <PixelLabel>したく</PixelLabel>
        {!props.canDive && (
          <span className="font-pixel text-[10.5px] tracking-wide text-royal2">
            潜れる回数 {props.divesToday}/{cap}
          </span>
        )}
      </div>

      {done.length > 0 && (
        <ul className="mt-2 space-y-1">
          {done.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
              <span className="text-royal2">✓</span>
              <span className="font-bold">{s.label}</span>
              <span className="text-inksoft">{s.effect}</span>
            </li>
          ))}
        </ul>
      )}

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
