"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TUTORIAL_STEPS } from "@/lib/tutorial";
import { PixelAvatar } from "@/components/pixel-avatar";
import { completeTutorial } from "@/app/actions";

// 初回チュートリアル（モーダル歩き）。初回ログイン時に自動表示。
// マイページの「もう一度」から window イベント "en:tutorial" で再表示できる。
export function Tutorial(props: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(props.defaultOpen);
  const [i, setI] = useState(0);

  // マイページ等からの再表示要求を受ける
  useEffect(() => {
    const onReplay = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("en:tutorial", onReplay);
    return () => window.removeEventListener("en:tutorial", onReplay);
  }, []);

  if (!open) return null;

  const step = TUTORIAL_STEPS[i];
  const last = i === TUTORIAL_STEPS.length - 1;

  // 完了/スキップ: サーバーに記録して二度と自動表示しない（失敗しても閉じる）
  function finish() {
    setOpen(false);
    completeTutorial().catch(() => {});
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="はじめかたガイド"
    >
      <div className="absolute inset-0 bg-ink/45" onClick={finish} />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border-[3px] border-line8 bg-win shadow-hard">
        <div className="flex items-center gap-2 bg-royal px-3 py-2 font-pixel text-[12px] tracking-wide text-white">
          <span className="inline-flex gap-1.5" aria-hidden="true">
            <i className="h-2.5 w-2.5 rounded-full border-2 border-white bg-pinkhot" />
            <i className="h-2.5 w-2.5 rounded-full border-2 border-white bg-lemon" />
          </span>
          はじめかた<span className="text-peri">.exe</span>
          <button
            onClick={finish}
            className="ml-auto rounded border-2 border-white px-1.5 text-[10px] leading-tight"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
          <div className="grid h-24 w-24 place-items-center rounded-lg border-[2.5px] border-line8 bg-surface">
            <PixelAvatar sprite={step.sprite} px={8} />
          </div>
          <p className="font-pixel text-[11px] tracking-[0.14em] text-royal2">
            {i + 1} / {TUTORIAL_STEPS.length}
          </p>
          <h2 className="font-pixel text-xl tracking-wide text-royal">
            {step.title}
          </h2>
          <p className="max-w-[42ch] text-[13px] leading-relaxed text-ink">
            {step.body}
          </p>

          {last && step.cta && (
            <Link
              href={step.cta.href}
              onClick={finish}
              className="btn8 btn8-start mt-1 text-[13px]"
            >
              {step.cta.label}
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between border-t-2 border-dashed border-peri px-4 py-2.5">
          <button
            onClick={finish}
            className="font-pixel text-[11px] tracking-wide text-inksoft hover:text-pinkhot"
          >
            スキップ
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                onClick={() => setI((n) => n - 1)}
                className="btn8 px-3 py-1 text-[11px]"
              >
                ← 戻る
              </button>
            )}
            {last ? (
              <button
                onClick={finish}
                className="btn8 btn8-start px-3 py-1 text-[11px]"
              >
                はじめる！
              </button>
            ) : (
              <button
                onClick={() => setI((n) => n + 1)}
                className="btn8 btn8-start px-3 py-1 text-[11px]"
              >
                次へ →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
