"use client";

// 送信中（AI応答待ち）を画面中央に大きく出すオーバーレイ。
// 左下の小さな表示だと気づきにくい、というフィードバックへの対応。
// pointer-events-none で操作は妨げず、視認性だけを上げる。

export function SendingOverlay(props: { show: boolean; label?: string }) {
  if (!props.show) return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-ink/25" />
      <div className="relative flex flex-col items-center gap-3 rounded-xl border-[3px] border-line8 bg-win px-8 py-6 shadow-hard">
        <div className="flex gap-1.5" aria-hidden="true">
          <i className="h-3.5 w-3.5 animate-bounce rounded-full border-2 border-line8 bg-pinkhot [animation-delay:-0.2s]" />
          <i className="h-3.5 w-3.5 animate-bounce rounded-full border-2 border-line8 bg-lemon [animation-delay:-0.1s]" />
          <i className="h-3.5 w-3.5 animate-bounce rounded-full border-2 border-line8 bg-royal2" />
        </div>
        <p className="font-pixel text-2xl tracking-wider text-royal">
          {props.label ?? "送信中"}
          <span className="blink">_</span>
        </p>
      </div>
    </div>
  );
}
