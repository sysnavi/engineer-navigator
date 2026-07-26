"use client";

// おさんぽから離れようとしたとき、うちの子が引き止める（Issue: 感情の仕込み）。
//
// 【これは「確認ダイアログ」ではない】
// おさんぽは離れても何も失わない。だからデータ保護のための確認は要らない。
// ここでやりたいのは **ひと呼吸おいて、関係を感じさせる** こと。
// なので反応は歩いた時間で変わる:
//   短い  → さみしがる（もう帰っちゃうの？）
//   ふつう → 名残おしむ
//   長い  → 笑顔で送り出す（たくさん歩いたね）
// 短時間ほど引き止め、長く歩いたら送り出すので、「引き止め」が罰ではなく
// 関係の表現になる。1セッションに1回だけ（何度も出したら嫌がらせ）。
//
// 【技術的な制約】App Router に遷移をブロックする公式APIは無いので、
// アプリ内リンクのクリックを捕捉して差し込む。タブを閉じる/リロードは追わない
// （beforeunload は文言をブラウザが固定するので、この演出には使えない）。

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Farewell = { title: string; line: string; happy: boolean };

function farewellFor(seconds: number): Farewell {
  if (seconds < 60) {
    return {
      title: "え、もう かえっちゃうの…？",
      line: "まだ すこししか あるいてないよ。……でも、きみが きめていいよ。",
      happy: false,
    };
  }
  if (seconds < 300) {
    return {
      title: "そろそろ かえろっか",
      line: "きょうも いっしょに あるけて たのしかった。",
      happy: false,
    };
  }
  return {
    title: "きょうは たくさん あるいたね！",
    line: "まんぞく まんぞく。またいこうね。",
    happy: true,
  };
}

export function LeaveGuard(props: {
  petName: string;
  spriteNormal: string;
  spriteHappy: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const startedAt = useRef(0);
  const askedRef = useRef(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    // 歩き始めた時刻はマウント時に確定させる（レンダー中に時刻を読まない）
    startedAt.current = Date.now();
    const onClick = (e: MouseEvent) => {
      if (askedRef.current) return; // 1セッション1回だけ
      // ⚠ここで e.defaultPrevented を見てはいけない。Link 側が先に preventDefault する
      // ケースがあり、その場合この引き止めが黙って無効になる（実測で踏んだ）。
      // 新しいタブで開く操作（修飾キー・中クリック）だけは邪魔しない。
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      // アプリ内の別ページへの遷移だけを対象にする
      if (!href || !href.startsWith("/") || href.startsWith("/walk")) return;
      if (a.getAttribute("target") === "_blank") return;

      // preventDefault だけでは足りない: Link は React の onClick で router.push するので、
      // ルートコンテナへ届く前に伝播ごと止める（capture で拾っているのはこのため）
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      askedRef.current = true;
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      setPending(href);
    };
    // ⚠window の capture で拾う。document だと React のイベント委譲より後に走ることがあり、
    // その場合 Link の router.push が先に予約されてしまって止められない（実測で確認）。
    // capture の順序は window → document → … なので、ここが最速で確実。
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  if (!pending) return null;
  const f = farewellFor(seconds);

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`${props.petName}のおみおくり`}
    >
      <div className="absolute inset-0 bg-ink/45" onClick={() => setPending(null)} />
      <div className="relative mb-[calc(54px+env(safe-area-inset-bottom))] w-full max-w-[420px] overflow-hidden rounded-t-xl border-[3px] border-b-0 border-line8 bg-win shadow-hard sm:mb-0 sm:max-w-[330px] sm:rounded-xl sm:border-b-[3px]">
        <div className="flex items-center gap-3 px-4 pb-1 pt-4">
          <Image
            src={f.happy ? props.spriteHappy : props.spriteNormal}
            alt=""
            width={56}
            height={56}
            style={{ imageRendering: "pixelated" }}
            unoptimized
          />
          <div className="min-w-0">
            <p className="font-pixel text-[11px] tracking-wide text-royal2">{props.petName}</p>
            <p className="mt-0.5 text-[13.5px] font-extrabold leading-snug">{f.title}</p>
          </div>
        </div>
        <p className="px-4 pb-3 pt-1 text-[12.5px] leading-relaxed text-inksoft">{f.line}</p>
        <div className="flex gap-2 border-t-2 border-line8 p-2.5">
          <button
            onClick={() => setPending(null)}
            className="btn8 flex-1 py-2 text-[12.5px]"
          >
            もどる
          </button>
          <button
            onClick={() => router.push(pending)}
            className="btn8 btn8-start flex-1 py-2 text-[12.5px]"
          >
            かえる
          </button>
        </div>
      </div>
    </div>
  );
}
