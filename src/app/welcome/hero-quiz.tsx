import { PixelAvatar } from "@/components/pixel-avatar";
import { PixelLabel, Window } from "@/components/retro";
import { EXP_WEIGHTS } from "@/lib/exp";
import type { WelcomeQuestion } from "@/lib/public-question";

// /welcome のヒーローに置く「いきなり1問」。
//
// クライアントJSを使わず、選択肢は GET フォーム（/welcome?q=&a=）、結果はサーバー描画。
// Next 16 は画面内でもハイドレート前のタップを取りこぼすことがあるので、初見の
// 最初のタップが確実に効くよう React のハンドラに頼らない（memory: next16-lazy-hydration）。
// 演出は CSS（globals.css の welcome-*）だけで完結させる。

const LETTERS = ["A", "B", "C", "D", "E", "F"];
export const EXP_CORRECT = EXP_WEIGHTS.quizAttempt + EXP_WEIGHTS.quizCorrectBonus;
export const EXP_WRONG = EXP_WEIGHTS.quizAttempt;

/** ゲスト発行フォーム。答えた問いがあれば hidden で運び、発行時に解答として記録する */
export function GuestStartForm(props: {
  q?: string;
  a?: number | null;
  label: string;
  className?: string;
}) {
  return (
    <form action="/api/guest/start" method="post" className={props.className}>
      {props.q && props.a != null && (
        <>
          <input type="hidden" name="q" value={props.q} />
          <input type="hidden" name="a" value={props.a} />
        </>
      )}
      <button className="btn8 btn8-start w-full text-center text-[13px]">{props.label}</button>
    </form>
  );
}

export function HeroQuiz({ q, chosen }: { q: WelcomeQuestion; chosen: number | null }) {
  if (chosen === null) {
    return (
      <Window title="QUESTION" titleEm=".dat" bodyClass="p-4 sm:p-5">
        <PixelLabel className="!text-pinkhot">いきなり1問 — {q.topic}</PixelLabel>
        <p className="mt-2 text-[14.5px] font-bold leading-snug text-ink">{q.prompt}</p>
        <form action="/welcome" method="get" className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="q" value={q.id} />
          {q.choices.map((c, i) => (
            <button
              key={i}
              name="a"
              value={i}
              className="btn8 flex w-full items-start gap-2 text-left text-[13px] !py-2.5 !px-3"
            >
              <span className="font-pixel text-royal2">{LETTERS[i]}.</span>
              <span className="font-sans font-bold">{c}</span>
            </button>
          ))}
        </form>
        <p className="mt-2 text-[11px] text-inksoft">
          答えるだけでEXP。登録は要りません。
        </p>
      </Window>
    );
  }

  const correct = chosen === q.answerIndex;
  const exp = correct ? EXP_CORRECT : EXP_WRONG;
  return (
    <Window title="RESULT" titleEm=".dat" bodyClass="p-4 sm:p-5" barClass={correct ? "!bg-pinkhot" : ""}>
      <div className="flex items-center gap-4">
        <div className={correct ? "welcome-hatch" : "welcome-shake"}>
          <PixelAvatar sprite={correct ? "chick" : "egg"} px={4} />
        </div>
        <div className="welcome-pop">
          <p className="font-pixel text-[18px] leading-none text-pinkhot">
            {correct ? "せいかい！" : "おしい…"}
          </p>
          <p className="mt-1.5 font-pixel text-[13px] tracking-wide text-royal">
            +{exp} EXP
            <span className="ml-1 text-[10px] text-inksoft">{correct ? "" : "（挑戦したぶん）"}</span>
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-[12.5px]">
        {q.choices.map((c, i) => {
          const isAns = i === q.answerIndex;
          const isMine = i === chosen;
          return (
            <li
              key={i}
              className={`rounded-md border-2 px-2.5 py-1.5 ${
                isAns
                  ? "border-royal bg-peri/40 font-bold text-ink"
                  : isMine
                    ? "border-pinkhot text-inksoft line-through"
                    : "border-transparent text-inksoft"
              }`}
            >
              <span className="font-pixel text-royal2">{LETTERS[i]}.</span> {c}
              {isAns && <span className="ml-1 font-pixel text-[10px] text-royal">✓ 正解</span>}
            </li>
          );
        })}
      </ul>
      {q.explanation && (
        <p className="mt-2 text-[12px] leading-relaxed text-inksoft">{q.explanation}</p>
      )}

      <GuestStartForm q={q.id} a={chosen} label="▶ この続きをやる（登録なし）" className="mt-4" />
      <p className="mt-2 text-[11px] text-inksoft">
        いまの +{exp} EXP を持ったまま、アバターを育ててダンジョンへ。
      </p>
    </Window>
  );
}
