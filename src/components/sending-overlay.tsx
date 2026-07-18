"use client";

// 送信中（AI応答待ち）を画面中央に大きく出すオーバーレイ。
// 左下の小さな表示だと気づきにくい、というフィードバックへの対応。
// pointer-events-none で操作は妨げず、視認性だけを上げる。
// AI待ちは数秒かかるので宇宙人の見せ場（Issue #7）。

import { LoadingAlien } from "@/components/loading-alien";

export function SendingOverlay(props: {
  show: boolean;
  label?: string;
  sub?: string;
}) {
  if (!props.show) return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-ink/25" />
      <div className="relative flex flex-col items-center gap-2 rounded-xl border-[3px] border-line8 bg-win px-8 py-6 text-center shadow-hard">
        <LoadingAlien size={72} />
        <p className="font-pixel text-2xl tracking-wider text-royal">
          {props.label ?? "送信中"}
          <span className="blink">_</span>
        </p>
        {props.sub && (
          <p className="text-[12.5px] text-inksoft">{props.sub}</p>
        )}
      </div>
    </div>
  );
}
