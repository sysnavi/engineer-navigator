"use client";

import { useEffect, useRef, useState } from "react";
import { MicButton } from "@/components/mic-button";

type Msg = { role: "USER" | "ASSISTANT"; content: string };

// メンターのチャット（ストリーミング）。
// 初期メッセージ列を受け取り、末尾がUSERで返信待ちなら自動で1回ストリームを開始する。

export function MentorChat(props: { sessionId: string; initial: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(props.initial);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  async function stream(sessionId: string) {
    setStreaming(true);
    setMessages((m) => [...m, { role: "ASSISTANT", content: "" }]);
    try {
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, content: pendingContentRef.current }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "ASSISTANT",
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "ASSISTANT",
          content:
            copy[copy.length - 1].content ||
            "[通信エラー。もう一度お試しください]",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  const pendingContentRef = useRef("");

  // 初期状態: 末尾がUSER（firstMessageのシード等）なら自動でメンターの返信を取りに行く。
  // stream() の同期setStateがeffect内で走らないよう次のtickに逃がす。
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const last = props.initial[props.initial.length - 1];
    if (last && last.role === "USER") {
      pendingContentRef.current = last.content;
      // setTimeout でeffectの同期実行から外す。started ガードで一度だけ発火するので
      // Strict Mode のクリーンアップでキャンセルはしない（キャンセルすると発火しなくなる）。
      setTimeout(() => void stream(props.sessionId), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "USER", content }]);
    pendingContentRef.current = content;
    await stream(props.sessionId);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "USER" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg border-2 border-line8 px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-hard-sm ${
                m.role === "USER"
                  ? "bg-royal text-white"
                  : "bg-surface text-ink"
              }`}
            >
              {m.content ||
                (streaming && i === messages.length - 1 ? (
                  <span className="font-pixel text-[12px] text-royal2">
                    THINKING<span className="blink">_</span>
                  </span>
                ) : (
                  ""
                ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSend} className="flex items-end gap-2.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend(e);
          }}
          rows={2}
          placeholder="メンターに質問する。🎤で音声入力も（⌘/Ctrl+Enterで送信）"
          className="field8"
          disabled={streaming}
        />
        <MicButton
          disabled={streaming}
          onText={(t) => setInput((v) => (v ? `${v} ${t}` : t))}
        />
        <button
          type="submit"
          className="btn8 btn8-start shrink-0 text-[12px]"
          disabled={streaming || !input.trim()}
        >
          ▶ 送信
        </button>
      </form>
    </div>
  );
}
