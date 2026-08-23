"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 生成中の演出とポーリング。GENERATINGのプラン詳細でだけマウントされ、
// 数秒おきに router.refresh() でサーバー状態を取り直す。READY/FAILEDに変わると
// サーバー側の出し分けでこの画面ごと差し替わる。
// 実際の進捗は取れない（LLM1回呼びの中身は見えない）ので、工程名の巡回表示と
// 満了しない往復バーで「動いている」ことだけを正直に伝える。

const STEPS = [
  "スキルマップを読んでいます…",
  "登録済みの教材をさがしています…",
  "試験日から逆算しています…",
  "週次カリキュラムを執筆しています…",
  "しあげをしています…",
];

const REFRESH_MS = 2500;
const STEP_MS = 3200;

export function PlanGenerating() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), REFRESH_MS);
    // 最後の工程名で止める（ループすると「終わったのに戻った」ように見える）
    const ticker = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      STEP_MS
    );
    return () => {
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, [router]);

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="h-4 overflow-hidden rounded border-2 border-line8 bg-surface2">
        <div className="genbar8-block" />
      </div>
      <p className="font-pixel text-[12px] tracking-[0.08em] text-royal2">
        {STEPS[step]}
      </p>
    </div>
  );
}
