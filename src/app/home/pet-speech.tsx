"use client";

// ペットのセリフ窓（Issue #23）。
//
// ペットの頭上に nowrap の吹き出しを出す作りだと、
// ①長いセリフが横にはみ出す ②上端のペットだと上に飛び出す
// のどちらでもシーンの overflow:hidden に切り落とされる。
// そこでシーン幅に収まるメッセージ窓（8bitのRPG風）にして、
// 折り返し前提で上端に固定する。これなら絶対に切れない。

export function PetSpeech(props: { name: string; text: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-2 top-2 z-[1200] rounded-lg border-2 border-line8 bg-win/95 px-2.5 py-1.5 shadow-hard-sm"
      role="status"
      aria-live="polite"
    >
      <p className="font-pixel text-[9px] tracking-wide text-royal2">
        {props.name}
      </p>
      <p className="text-[11px] font-bold leading-snug">{props.text}</p>
    </div>
  );
}
