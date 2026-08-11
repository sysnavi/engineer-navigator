"use client";

import { useEffect, useRef, useState } from "react";
import { MicButton } from "@/components/mic-button";
import {
  resolveEngineInfo,
  unavailableMessage,
  type EngineInfo,
} from "@/lib/speech/recognition";
import { unlockSpeech } from "@/lib/speech/tts";
import { useInterview } from "./use-interview";
import { VoiceInterview } from "./voice-interview";

// インタビューのチャットモード。会話状態は useInterview に委譲し、
// ハンズフリーモード（voice-interview.tsx）と共有する。

export function InterviewChat() {
  const itv = useInterview();
  const [input, setInput] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    resolveEngineInfo().then((i) => {
      if (alive) setEngineInfo(i);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [itv.messages, itv.ready]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || itv.streaming || itv.summarizing) return;
    setInput("");
    await itv.send(content);
  }

  function openVoice() {
    // iOS系のTTS自動再生制限は「ユーザー操作の同期処理内」でしか解除できない
    unlockSpeech();
    setVoiceOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ハンズフリー: 話すだけで進むモード。
          使えない環境ではボタンごと消さず、理由を出す（黙って消えると
          「音声入力が無くなった」と受け取られる） */}
      {engineInfo &&
        (engineInfo.engine !== "none" ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openVoice}
              className="btn8 btn8-ok text-[12px]"
              disabled={itv.summarizing}
            >
              🎙 ハンズフリーで話す
            </button>
            <span className="text-[11.5px] text-inksoft">
              読み上げ→話すだけで進みます。歩きながらでもOK
            </span>
          </div>
        ) : (
          <p className="rounded-lg border-2 border-line8 bg-surface px-3 py-2 text-[11.5px] leading-snug text-inksoft shadow-hard-sm">
            🎙 いまこの環境では音声入力を使えません —{" "}
            {unavailableMessage(engineInfo.reason)}
          </p>
        ))}

      <div className="space-y-3">
        {itv.messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg border-2 border-line8 px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-hard-sm ${
                m.role === "user" ? "bg-royal text-white" : "bg-surface text-ink"
              }`}
            >
              {m.content ||
                (itv.streaming && i === itv.messages.length - 1 ? (
                  <span className="font-pixel text-[12px] text-royal2">
                    …<span className="blink">_</span>
                  </span>
                ) : (
                  ""
                ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {itv.ready && (
        <p className="font-pixel text-[12px] tracking-[0.1em] text-pinkhot">
          ★ 材料がそろいました — まとめて週報のドラフトにできます
        </p>
      )}
      {itv.error && <p className="text-[12.5px] text-crit">{itv.error}</p>}

      <form onSubmit={send} className="flex items-end gap-2.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e);
          }}
          rows={2}
          placeholder="話し言葉でOK。答えを入力…"
          className="field8"
          disabled={itv.streaming || itv.summarizing}
        />
        <MicButton
          disabled={itv.streaming || itv.summarizing}
          onText={(t) => setInput((v) => (v ? `${v} ${t}` : t))}
        />
        <button
          type="submit"
          className="btn8 btn8-ok shrink-0 text-[12px]"
          disabled={itv.streaming || itv.summarizing || !input.trim()}
        >
          ▶ 答える
        </button>
      </form>

      <div className="flex items-center gap-3">
        <button
          onClick={itv.summarize}
          disabled={itv.answeredCount < 2 || itv.streaming || itv.summarizing}
          className={`btn8 text-[12px] ${itv.ready ? "btn8-start" : ""}`}
        >
          {itv.summarizing ? "MAKING…" : "▶ ここまでで週報にまとめる"}
        </button>
        <span className="text-[11.5px] text-inksoft">
          まとめたあとフォームで確認・編集してから提出できます
        </span>
      </div>

      {voiceOpen && engineInfo && (
        <VoiceInterview
          interview={itv}
          engine={engineInfo.engine}
          onClose={() => setVoiceOpen(false)}
        />
      )}
    </div>
  );
}
