"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeForSpeech } from "@/lib/speech/sanitize";
import { canSpeak, speak, stopSpeaking } from "@/lib/speech/tts";
import {
  startDictation,
  type RecognitionHandle,
  type SpeechEngine,
} from "@/lib/speech/recognition";
import type { Interview } from "./use-interview";

// ハンズフリー音声インタビュー（全画面モード）。
// 質問を読み上げ → 聞き取り → 無音を検知したら自動送信 → 次の質問、を
// 画面を見ずに繰り返せる。歩きながら・移動中に週報の材料を話し切る想定。
//
// 会話状態は親（interview.tsx）の useInterview と共有しているので、
// 途中で「キーボードで答える」に切り替えても会話は続きから。

type Phase =
  | "speaking" // 質問を読み上げ中
  | "listening" // 聞き取り中
  | "processing" // 録音のアップロード・文字起こし待ち（recorderエンジンのみ）
  | "thinking" // AIが次の質問を生成中
  | "paused" // 一時停止（タップで再開）
  | "done"; // 材料がそろった（READY）

const GOAL_QUESTIONS = 7; // インタビューが集める材料の数（進捗表示の目安）

export function VoiceInterview(props: {
  interview: Interview;
  engine: SpeechEngine;
  onClose: () => void;
}) {
  const { engine } = props;
  const [phase, setPhase] = useState<Phase>("speaking");
  const [partial, setPartial] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const closedRef = useRef(false);
  const handleRef = useRef<RecognitionHandle | null>(null);
  const emptyRoundsRef = useRef(0);
  // 非同期ループから常に最新のインタビュー状態を触るための ref
  // （マウント時のクロージャに古い transcript が固定されるのを防ぐ）
  const itvRef = useRef(props.interview);
  itvRef.current = props.interview;

  // 背面のスクロールを止める
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    // StrictModeのマウント→クリーンアップ→再マウントで closedRef が
    // 立ちっぱなしになりループが始まらないため、開始時に必ず倒す
    closedRef.current = false;
    const itv = itvRef.current;
    const lastQuestion = [...itv.messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.trim() !== "");
    void runTurn(lastQuestion?.content ?? "", itv.ready);
    return () => {
      closedRef.current = true;
      stopSpeaking();
      handleRef.current?.cancel();
    };
    // マウント時に一度だけループを開始する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runTurn(questionText: string, isReady: boolean) {
    if (closedRef.current) return;
    if (questionText && canSpeak()) {
      setPhase("speaking");
      await speak(sanitizeForSpeech(questionText));
      if (closedRef.current) return;
    }
    if (isReady) {
      setPhase("done");
      return;
    }
    await listen();
  }

  async function listen() {
    if (closedRef.current) return;
    setPartial("");
    setPhase("listening");
    handleRef.current = await startDictation(engine, {
      silenceMs: 2200,
      noSpeechMs: 12_000,
      onPartial: (t) => setPartial(t),
      onFinal: (t) => void handleFinal(t),
      onError: (message) => {
        if (closedRef.current) return;
        setNote(message);
        setPhase("paused");
      },
    });
  }

  async function handleFinal(text: string) {
    if (closedRef.current) return;
    if (!text) {
      emptyRoundsRef.current += 1;
      if (emptyRoundsRef.current >= 2) {
        emptyRoundsRef.current = 0;
        setNote("聞き取れませんでした。マイクをタップで再開できます");
        setPhase("paused");
        return;
      }
      setNote("聞こえなかったみたい。もう一度どうぞ");
      await listen();
      return;
    }
    emptyRoundsRef.current = 0;
    setNote(null);
    setPartial(text);
    setPhase("thinking");
    const res = await itvRef.current.send(text);
    if (closedRef.current) return;
    if (!res) {
      setNote("通信エラー。マイクをタップでもう一度話せます");
      setPhase("paused");
      return;
    }
    await runTurn(res.text, res.ready);
  }

  function stopAudio() {
    stopSpeaking();
    handleRef.current?.cancel();
  }

  function close() {
    closedRef.current = true;
    stopAudio();
    props.onClose();
  }

  function orbTap() {
    if (phase === "speaking") {
      stopSpeaking(); // 読み上げをスキップ → そのまま聞き取りへ
    } else if (phase === "listening") {
      handleRef.current?.stop(); // ここまでの発話で確定
      if (engine === "recorder") setPhase("processing");
    } else if (phase === "paused" || phase === "done") {
      setNote(null);
      void listen(); // done後も追加で話せる（READYは維持される）
    }
  }

  function summarizeNow() {
    stopAudio();
    setPhase("done");
    itvRef.current.summarize();
  }

  const itv = props.interview;
  // 表示する質問文 = 最新のassistantメッセージ（thinking中はストリーミングで伸びる）
  const question =
    [...itv.messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.trim() !== "")
      ?.content ?? "";

  const orb: Record<Phase, { icon: string; label: string; cls: string }> = {
    speaking: {
      icon: "🔊",
      label: "質問を読んでいます — タップでスキップ",
      cls: "bg-lemon text-ink",
    },
    listening: {
      icon: "🎤",
      label:
        engine === "recorder"
          ? "録音中 — 話し終わったらタップ"
          : "聞いています — 話し終わると自動で送ります",
      cls: "bg-pinkhot text-white motion-safe:animate-pulse",
    },
    processing: { icon: "⏳", label: "文字起こし中…", cls: "bg-win text-ink" },
    thinking: { icon: "…", label: "次の質問を考えています", cls: "bg-win text-ink" },
    paused: { icon: "▶", label: "タップで再開", cls: "bg-win text-ink" },
    done: {
      icon: "★",
      label: "材料がそろいました！",
      cls: "bg-lemon text-ink",
    },
  };
  const o = orb[phase];

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-paper p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-label="ハンズフリーインタビュー"
    >
      <section className="win8 flex min-h-0 flex-1 flex-col">
        <div className="win8-bar">
          <span className="win8-dot" style={{ background: "var(--pink-hot)" }} />
          <span className="win8-dot" style={{ background: "var(--lemon)" }} />
          <span className="win8-dot" style={{ background: "#7ED957" }} />
          <span className="win8-title">
            ハンズフリー<em>.rec</em>
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="閉じる"
            className="win8-close"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-4 overflow-y-auto p-5">
          {/* 進捗: 集まった材料の目安 */}
          <div className="text-center">
            <p className="font-pixel text-[12px] tracking-[0.12em] text-royal2">
              VOICE INTERVIEW — 回答 {itv.answeredCount}
            </p>
            <div
              className="mt-1.5 flex justify-center gap-1.5"
              aria-hidden="true"
            >
              {Array.from({ length: GOAL_QUESTIONS }, (_, i) => (
                <i
                  key={i}
                  className={`h-2.5 w-2.5 border-2 border-line8 ${
                    i < Math.min(itv.answeredCount, GOAL_QUESTIONS)
                      ? "bg-royal"
                      : "bg-win"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* いまの質問 */}
          <div className="w-full max-w-md">
            <div className="whitespace-pre-wrap rounded-lg border-2 border-line8 bg-surface px-4 py-3 text-[14.5px] leading-relaxed shadow-hard-sm">
              {question ||
                (phase === "thinking" ? (
                  <span className="font-pixel text-[12px] text-royal2">
                    …<span className="blink">_</span>
                  </span>
                ) : (
                  ""
                ))}
            </div>
          </div>

          {/* マイクオーブ */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={orbTap}
              disabled={phase === "thinking" || phase === "processing"}
              aria-label={o.label}
              className={`flex h-28 w-28 items-center justify-center rounded-full border-[3px] border-line8 text-4xl shadow-hard transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 ${o.cls}`}
            >
              <span aria-hidden="true">{o.icon}</span>
            </button>
            <p
              className="min-h-[1.5em] text-center text-[12.5px] text-inksoft"
              role="status"
            >
              {note ?? o.label}
            </p>
            {/* 聞き取り中の途中経過（自分の声が文字になっていく） */}
            <p className="min-h-[3em] w-full max-w-md text-center text-[13.5px] font-bold leading-relaxed">
              {phase === "listening" || phase === "thinking" ? partial : ""}
            </p>
          </div>

          {/* 下部の操作 */}
          <div className="flex w-full max-w-md flex-col items-center gap-2.5">
            {itv.ready && (
              <p className="font-pixel text-[12px] tracking-[0.1em] text-pinkhot">
                ★ 材料がそろいました — まとめて週報のドラフトにできます
              </p>
            )}
            {itv.error && (
              <p className="text-[12.5px] text-crit">{itv.error}</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={summarizeNow}
                disabled={itv.answeredCount < 2 || itv.streaming || itv.summarizing}
                className={`btn8 text-[12px] ${itv.ready ? "btn8-start" : ""}`}
              >
                {itv.summarizing ? "MAKING…" : "▶ ここまでで週報にまとめる"}
              </button>
              <button
                type="button"
                onClick={close}
                className="btn8 text-[12px]"
              >
                ⌨ キーボードで答える
              </button>
            </div>
            <p className="text-center text-[11.5px] text-inksoft">
              まとめたあとフォームで確認・編集してから提出できます
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
