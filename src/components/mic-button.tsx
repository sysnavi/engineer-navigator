"use client";

import { useEffect, useRef, useState } from "react";

// 音声入力ボタン（Web Speech API）。認識した確定テキストを onText に渡す。
// 未対応ブラウザ（Firefox等）では何も描画しない（フィーチャーディテクション）。
// APIキー・サーバー不要。ブラウザがマイク許可を初回に尋ねる。

function getSR(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function MicButton(props: {
  onText: (text: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // SSRでは window が無いため、対応判定はマウント後に行う必要がある（正当なeffect内setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!getSR());
    return () => recRef.current?.abort();
  }, []);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const SR = getSR();
    if (!SR) return;
    const rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text) props.onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={props.disabled}
      aria-label={props.title ?? "音声入力"}
      aria-pressed={listening}
      title={
        props.title ?? (listening ? "停止" : "音声で入力（話すと文字になります）")
      }
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[2.5px] border-line8 text-[15px] shadow-hard-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 ${
        listening ? "bg-pinkhot text-white" : "bg-win text-ink"
      }`}
    >
      <span className={listening ? "blink" : ""} aria-hidden="true">
        🎤
      </span>
    </button>
  );
}
