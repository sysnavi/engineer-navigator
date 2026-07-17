"use client";

import Link from "next/link";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";

// ルート内で発生したサーバー/描画エラーの受け皿。8bitのやさしいエラー画面。
// （root layout 自体のエラーは global-error.tsx が担当）

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Window title="ERROR" titleEm=".sys">
        <div className="text-center">
          <PixelLabel className="!text-pinkhot">SYSTEM ERROR</PixelLabel>
          <PixelTitle as="h1" className="mt-1 text-2xl text-royal">
            うまく読み込めませんでした
          </PixelTitle>
          <p className="mt-3 text-[13px] text-inksoft">
            一時的な問題かもしれません。もう一度お試しください。
            <br />
            繰り返す場合は、少し時間をおくか運営にご連絡ください。
          </p>
          {error.digest && (
            <p className="mt-2 font-pixel text-[10px] tracking-wide text-inksoft">
              CODE: {error.digest}
            </p>
          )}
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={reset} className="btn8 btn8-start text-[12px]">
              ▶ もう一度
            </button>
            <Link href="/" className="btn8 text-[12px]">
              ← ホームへ
            </Link>
          </div>
        </div>
      </Window>
    </div>
  );
}
