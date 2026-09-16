"use client";

import { PixelIcon } from "@/components/pixel-icon";

// ゲストのホームに置く「げんばの味見」タイル。げんば本体はゲストに開放していないので、
// ページには飛ばず、はじめかたガイド（layout にマウントされた Tutorial）の体験ステップを
// 直接開く。/welcome で「げんばの味見」を約束している以上、チュートリアルを閉じた後も
// 入口が残っている必要がある。
export function OpenGenbaTrialTile() {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("en:tutorial", { detail: { trial: "genba" } }))
      }
      title="案件→面接→現場→精算を、はじめかたガイドの中で味見（本番は登録後）"
      className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-line8 bg-surface px-1.5 py-3 text-center shadow-hard-sm transition-transform hover:-translate-y-0.5"
    >
      <PixelIcon id="genba" px={3} />
      <span className="text-[11.5px] font-bold leading-tight">げんばの味見</span>
    </button>
  );
}
