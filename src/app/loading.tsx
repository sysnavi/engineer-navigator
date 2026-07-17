// 画面遷移中のローディング（Next.js のルートレベル loading UI）。
// サーバー描画やDBアクセスの待ちの間、即座にこれが表示される（体感の待ちを減らす）。

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="flex gap-1.5" aria-hidden="true">
        <i className="h-4 w-4 animate-bounce rounded-full border-2 border-line8 bg-pinkhot [animation-delay:-0.2s]" />
        <i className="h-4 w-4 animate-bounce rounded-full border-2 border-line8 bg-lemon [animation-delay:-0.1s]" />
        <i className="h-4 w-4 animate-bounce rounded-full border-2 border-line8 bg-royal2" />
      </div>
      <p className="font-pixel text-xl tracking-wide text-royal">
        NOW LOADING<span className="blink">_</span>
      </p>
      <p className="font-pixel text-[11px] tracking-widest text-inksoft">
        よみこみちゅう…
      </p>
    </div>
  );
}
