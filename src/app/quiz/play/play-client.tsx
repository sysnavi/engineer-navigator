"use client";

import { useState } from "react";
import Link from "next/link";
import {
  submitQuizAnswer,
  rateQuiz,
  setQuizHidden,
  type AnswerResult,
} from "../actions";

type Q = {
  id: string;
  topic: string;
  prompt: string;
  choices: string[];
  ratingCount: number;
};

// 四択の腕試し。採点はサーバー(submitQuizAnswer)で行い正解を後出しする。
// 解答後に0-10で任意評価 → 全員の集計が良問スコアになる。AIは使わない=トークンゼロ。

export function QuizPlay(props: { questions: Q[] }) {
  // 出題バッチはマウント時に固定する。サーバーアクション後の自動再描画で props が
  // 差し替わっても、セッション中の問題が入れ替わらないようにする（表示中の問題が
  // 数秒後に別問題へ変わるバグの対策）。
  const [questions] = useState(props.questions);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [rated, setRated] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const q = questions[i];
  const done = i >= questions.length;

  async function choose(idx: number) {
    if (result || busy) return;
    setBusy(true);
    setChosen(idx);
    try {
      const r = await submitQuizAnswer(q.id, idx);
      setResult(r);
      if (r.correct) setCorrectCount((c) => c + 1);
    } catch {
      setChosen(null);
    } finally {
      setBusy(false);
    }
  }

  async function rate(score: number) {
    if (rated) return;
    setRated(true);
    try {
      await rateQuiz(q.id, score);
    } catch {
      setRated(false);
    }
  }

  async function toggleHidden(v: boolean) {
    setHidden(v);
    try {
      await setQuizHidden(q.id, v);
    } catch {
      setHidden(!v);
    }
  }

  function next() {
    setChosen(null);
    setResult(null);
    setRated(false);
    setHidden(false);
    setI((n) => n + 1);
  }

  if (done) {
    return (
      <div className="rounded-lg border-[2.5px] border-line8 bg-surface p-6 text-center shadow-hard-sm">
        <p className="font-pixel text-[11px] tracking-wide text-inksoft">
          RESULT
        </p>
        <p className="mt-2 font-pixel text-4xl text-royal">
          {correctCount}
          <span className="text-2xl text-inksoft">/{questions.length}</span>
        </p>
        <p className="mt-2 text-[13px]">おつかれさま！腕試し完了です。</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/quiz" className="btn8 text-[12px]">
            ← 良問バンクへ
          </Link>
          <Link href="/quiz/new" className="btn8 btn8-start text-[12px]">
            ＋ 問題を作る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between font-pixel text-[11px] tracking-wide text-inksoft">
        <span>
          Q{i + 1} / {questions.length}
        </span>
        <span className="chip8 chip8-info">{q.topic}</span>
      </div>

      <div className="rounded-lg border-[2.5px] border-line8 bg-surface p-4 shadow-hard-sm">
        <p className="whitespace-pre-wrap text-[14px] font-bold leading-relaxed">
          {q.prompt}
        </p>
        <div className="mt-3 space-y-2">
          {q.choices.map((c, idx) => {
            const isAnswer = result && idx === result.answerIndex;
            const isChosenWrong =
              result && idx === chosen && !result.correct;
            return (
              <button
                key={idx}
                onClick={() => choose(idx)}
                disabled={!!result || busy}
                className={`flex w-full items-center gap-2.5 rounded-lg border-2 border-line8 px-3 py-2.5 text-left text-[13px] shadow-hard-sm transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:cursor-default ${
                  isAnswer
                    ? "bg-[var(--good)] text-white"
                    : isChosenWrong
                      ? "bg-[var(--crit)] text-white"
                      : "bg-win hover:bg-surface2"
                }`}
              >
                <span className="font-pixel text-[11px] text-inksoft">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1">{c}</span>
                {isAnswer && <span aria-hidden="true">✓</span>}
                {isChosenWrong && <span aria-hidden="true">✕</span>}
              </button>
            );
          })}
        </div>
      </div>

      {result && (
        <div className="rounded-lg border-2 border-line8 bg-surface2 p-4 shadow-hard-sm">
          <p
            className={`font-pixel text-[13px] tracking-wide ${result.correct ? "text-[var(--good)]" : "text-pinkhot"}`}
          >
            {result.correct ? "◎ 正解！" : "✕ 不正解"}
          </p>
          {result.explanation && (
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed">
              {result.explanation}
            </p>
          )}

          <div className="mt-3 border-t-2 border-dashed border-grid8 pt-3">
            <p className="text-[12px] font-bold">
              この問題は良問だと思う？（任意・0〜10点）
            </p>
            <p className="mb-2 text-[11px] text-inksoft">
              みんなの評価の平均が良問スコアになります（現在
              {q.ratingCount}人が評価）。
            </p>
            {rated ? (
              <p className="font-pixel text-[11px] text-royal2">
                評価ありがとう！★
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 11 }, (_, s) => (
                  <button
                    key={s}
                    onClick={() => rate(s)}
                    className="h-8 w-8 rounded border-2 border-line8 bg-win font-pixel text-[11px] shadow-hard-sm hover:bg-royal hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => toggleHidden(e.target.checked)}
              className="h-4 w-4 accent-[var(--pink-hot)]"
            />
            この問題はもう表示しない
            {hidden && (
              <span className="font-pixel text-[10px] text-royal2">
                （非表示にしました）
              </span>
            )}
          </label>

          <button
            onClick={next}
            className="btn8 btn8-start mt-3 w-full text-[12px]"
          >
            {i + 1 < questions.length ? "▶ 次の問題" : "▶ 結果を見る"}
          </button>
        </div>
      )}
    </div>
  );
}
