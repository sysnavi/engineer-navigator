"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveEngine,
  startDictation,
  type RecognitionHandle,
  type SpeechEngine,
} from "@/lib/speech/recognition";

// 音声入力ボタン。エンジン切替（native/web/recorder）は src/lib/speech/ に委譲する。
// - アプリ版（Capacitor）ではネイティブ音声認識を使う。以前はWKWebView上で
//   Web Speech APIを掴んで「ボタンはあるのに押しても無反応」になっていた
// - エラーは握りつぶさず、ボタン上に理由を表示する
// - どのエンジンも使えない環境では何も描画しない（従来どおり）

export function MicButton(props: {
  onText: (text: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  const [engine, setEngine] = useState<SpeechEngine>("none");
  const [phase, setPhase] = useState<"idle" | "listening" | "processing">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<RecognitionHandle | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  // onText を ref で持つ。認識開始時にハンドラが束縛する props が古くならないように。
  const onTextRef = useRef(props.onText);
  useEffect(() => {
    onTextRef.current = props.onText;
  }, [props.onText]);

  useEffect(() => {
    let alive = true;
    resolveEngine().then((e) => {
      // SSRでは判定できないため、対応判定はマウント後に行う（正当なeffect内setState）
      if (alive) setEngine(e);
    });
    return () => {
      alive = false;
      clearTimeout(errorTimer.current);
      handleRef.current?.cancel();
    };
  }, []);

  function showError(message: string) {
    setError(message);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 5000);
  }

  async function toggle() {
    if (phase === "listening") {
      handleRef.current?.stop();
      // recorderは停止後にアップロード・文字起こしの待ちがある
      if (engine === "recorder") setPhase("processing");
      return;
    }
    if (phase !== "idle") return;
    setError(null);
    setPhase("listening");
    handleRef.current = await startDictation(engine, {
      onFinal: (text) => {
        if (text) onTextRef.current(text);
        setPhase("idle");
      },
      onError: (message) => {
        showError(message);
        setPhase("idle");
      },
    });
  }

  if (engine === "none") return null;

  const listening = phase === "listening";
  const defaultTitle =
    phase === "processing"
      ? "文字起こし中…"
      : listening
        ? "停止"
        : engine === "recorder"
          ? "音声で入力（録音して文字にします）"
          : "音声で入力（話すと文字になります）";

  return (
    <div className="relative shrink-0">
      {error && (
        <span
          role="status"
          className="absolute bottom-full right-0 z-10 mb-1.5 w-48 rounded-lg border-2 border-line8 bg-win px-2.5 py-1.5 text-[11.5px] leading-snug text-crit shadow-hard-sm"
        >
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={props.disabled || phase === "processing"}
        aria-label={props.title ?? "音声入力"}
        aria-pressed={listening}
        title={props.title ?? defaultTitle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[2.5px] border-line8 text-[15px] shadow-hard-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 ${
          listening ? "bg-pinkhot text-white" : "bg-win text-ink"
        }`}
      >
        <span
          className={listening ? "blink" : ""}
          aria-hidden="true"
        >
          {phase === "processing" ? "⏳" : "🎤"}
        </span>
      </button>
    </div>
  );
}
