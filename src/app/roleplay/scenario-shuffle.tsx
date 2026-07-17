"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { startRoleplay } from "@/app/actions";
import { Window } from "@/components/retro";
import { domainLabel } from "@/lib/domains";

// 役割演習のシナリオ選択。もっと数を用意して、ワンタップでシャッフルできるように。
// 本人の「目指す領域(targetDomains)」に合うシナリオを優先して提示する。

export type ShuffleScenario = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  domains: string[];
};

const SHOW = 3;

/** userDomains に合うものを優先しつつ SHOW 件を抽選。prev と同一セットは避ける。 */
function pickThree(
  all: ShuffleScenario[],
  userDomains: string[],
  prevIds: string[]
): ShuffleScenario[] {
  if (all.length <= SHOW) return all;
  const matches = (s: ShuffleScenario) =>
    s.domains.some((d) => userDomains.includes(d));

  for (let attempt = 0; attempt < 8; attempt++) {
    const shuffled = shuffle(all);
    let picks: ShuffleScenario[];
    if (userDomains.length === 0) {
      picks = shuffled.slice(0, SHOW);
    } else {
      const hit = shuffled.filter(matches);
      const miss = shuffled.filter((s) => !matches(s));
      // 目標領域に合うものを2件まで優先、残りは他から埋める
      picks = [...hit.slice(0, 2), ...miss, ...hit.slice(2)].slice(0, SHOW);
    }
    const ids = picks.map((p) => p.id);
    if (ids.length === SHOW && ids.join() !== prevIds.join()) return picks;
  }
  return shuffle(all).slice(0, SHOW);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** SSRとクライアントで一致させる決定的な初期表示（乱数を使わない） */
function initialPicks(
  all: ShuffleScenario[],
  userDomains: string[]
): ShuffleScenario[] {
  const scored = all
    .map((s) => ({
      s,
      hit: s.domains.some((d) => userDomains.includes(d)) ? 0 : 1,
    }))
    .sort((a, b) => a.hit - b.hit || a.s.title.localeCompare(b.s.title, "ja"));
  return scored.slice(0, SHOW).map((x) => x.s);
}

function StartButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn8 btn8-start w-full text-[12px]" disabled={pending}>
      {pending ? "起動中…" : "▶ START"}
    </button>
  );
}

export function ScenarioShuffle(props: {
  scenarios: ShuffleScenario[];
  userDomains: string[];
}) {
  const [picks, setPicks] = useState<ShuffleScenario[]>(() =>
    initialPicks(props.scenarios, props.userDomains)
  );

  function reshuffle() {
    setPicks((prev) =>
      pickThree(
        props.scenarios,
        props.userDomains,
        prev.map((p) => p.id)
      )
    );
  }

  const canShuffle = props.scenarios.length > SHOW;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-inksoft">
          全{props.scenarios.length}種から{SHOW}つ提示
          {props.userDomains.length > 0 && (
            <span className="text-royal2">
              （目標領域:{" "}
              {props.userDomains.map((d) => domainLabel(d)).join("・")} を優先）
            </span>
          )}
        </p>
        {canShuffle && (
          <button
            type="button"
            onClick={reshuffle}
            className="btn8 shrink-0 px-3 py-1.5 text-[12px]"
          >
            🎲 シャッフル
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {picks.map((s) => (
          <Window key={s.id} title="SCENARIO" titleEm=".sim">
            <p className="text-[14px] font-extrabold">
              <span className="mr-1" aria-hidden="true">
                {s.emoji}
              </span>
              {s.title}
            </p>
            <p className="mt-1.5 min-h-[64px] text-[12.5px] text-inksoft">
              {s.description}
            </p>
            {s.domains.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {s.domains.map((d) => {
                  const on = props.userDomains.includes(d);
                  return (
                    <span
                      key={d}
                      className={`rounded border-2 border-line8 px-1.5 py-0.5 font-pixel text-[9px] tracking-wide ${
                        on ? "bg-royal text-white" : "bg-surface text-inksoft"
                      }`}
                    >
                      {domainLabel(d)}
                    </span>
                  );
                })}
              </div>
            )}
            <form action={startRoleplay.bind(null, s.id)}>
              <StartButton />
            </form>
          </Window>
        ))}
      </div>
    </div>
  );
}
