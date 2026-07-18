// 画面遷移中のローディング（Next.js のルートレベル loading UI）。
// サーバー描画やDBアクセスの待ちの間、即座にこれが表示される（体感の待ちを減らす）。
// 待ち時間には宇宙人がランダムで1体あそびに来る（Issue #7・どの子が出るかはお楽しみ）。

import { LoadingAlien } from "@/components/loading-alien";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <LoadingAlien size={96} />
      <p className="font-pixel text-xl tracking-wide text-royal">
        NOW LOADING<span className="blink">_</span>
      </p>
      <p className="font-pixel text-[11px] tracking-widest text-inksoft">
        よみこみちゅう…
      </p>
    </div>
  );
}
