"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { summarizeInterview } from "@/app/actions";
import { MicButton } from "@/components/mic-button";

type Msg = { role: "user" | "assistant"; content: string };

const READY_MARKER = "[READY]";

// 最初の質問は固定（ラウンドトリップ節約 + 安定した導入）。
// 2問目以降はAIが会話とプロフィール（前週のnextText等）を踏まえて聞く。
const OPENING =
  "おつかれさま！今週の週報、話すだけでまとめるよ。\nまず、今週の調子はどうだった？ ☀️好調 / 🌤普通 / ☁️モヤモヤ / 🌧しんどい でいうと？";

function stripMarker(text: string): string {
  return text.replace(READY_MARKER, "").trimEnd();
}

export function InterviewChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: OPENING },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [ready, setReady] = useState(false);
  const [summarizing, startSummarize] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const answeredCount = messages.filter((m) => m.role === "user").length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ready]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || streaming || summarizing) return;
    setInput("");
    const nextTranscript: Msg[] = [...messages, { role: "user", content }];
    setMessages([...nextTranscript, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextTranscript }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const display = stripMarker(full);
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: display };
          return copy;
        });
      }
      if (full.includes(READY_MARKER)) setReady(true);
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: copy[copy.length - 1].content || "[通信エラー。もう一度どうぞ]",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function summarize() {
    setError(null);
    startSummarize(async () => {
      try {
        // 空のassistantバブルは除いて送る
        const transcript = messages.filter((m) => m.content.trim() !== "");
        await summarizeInterview(transcript);
        // ドラフトが保存されたのでフォームモードへ（プレフィルを確認して提出）
        router.push("/report");
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "まとめに失敗しました。もう一度どうぞ"
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        {messages.map((m, i) => (
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
                (streaming && i === messages.length - 1 ? (
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

      {ready && (
        <p className="font-pixel text-[12px] tracking-[0.1em] text-pinkhot">
          ★ 材料がそろいました — まとめて週報のドラフトにできます
        </p>
      )}
      {error && <p className="text-[12.5px] text-crit">{error}</p>}

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
          disabled={streaming || summarizing}
        />
        <MicButton
          disabled={streaming || summarizing}
          onText={(t) => setInput((v) => (v ? `${v} ${t}` : t))}
        />
        <button
          type="submit"
          className="btn8 btn8-ok shrink-0 text-[12px]"
          disabled={streaming || summarizing || !input.trim()}
        >
          ▶ 答える
        </button>
      </form>

      <div className="flex items-center gap-3">
        <button
          onClick={summarize}
          disabled={answeredCount < 2 || streaming || summarizing}
          className={`btn8 text-[12px] ${ready ? "btn8-start" : ""}`}
        >
          {summarizing ? "MAKING…" : "▶ ここまでで週報にまとめる"}
        </button>
        <span className="text-[11.5px] text-inksoft">
          まとめたあとフォームで確認・編集してから提出できます
        </span>
      </div>
    </div>
  );
}
