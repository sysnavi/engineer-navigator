"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "USER" | "ASSISTANT"; content: string };

// ロールプレイのチャット。相手役の第一声は事前生成済み(ASSISTANT)なので自動発火はしない。
// ユーザー(エンジニア)が話す→相手役の返信をストリーミング。

export function RoleplayChat(props: { sessionId: string; initial: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(props.initial);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(content: string) {
    setStreaming(true);
    setMessages((m) => [...m, { role: "ASSISTANT", content: "" }]);
    try {
      const res = await fetch("/api/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: props.sessionId, content }),
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
          content: copy[copy.length - 1].content || "[通信エラー]",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "USER", content }]);
    await send(content);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "USER" ? "flex justify-end" : "flex justify-start"}
          >
            <div className="max-w-[85%]">
              <p
                className={`mb-1 font-pixel text-[10px] tracking-wide ${
                  m.role === "USER" ? "text-right text-royal2" : "text-inksoft"
                }`}
              >
                {m.role === "USER" ? "あなた" : "相手役"}
              </p>
              <div
                className={`whitespace-pre-wrap rounded-lg border-2 border-line8 px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-hard-sm ${
                  m.role === "USER" ? "bg-royal text-white" : "bg-surface text-ink"
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
          placeholder="この場面での対応を入力（⌘/Ctrl+Enterで送信）"
          className="field8"
          disabled={streaming}
        />
        <button
          type="submit"
          className="btn8 btn8-start shrink-0 text-[12px]"
          disabled={streaming || !input.trim()}
        >
          ▶ 返す
        </button>
      </form>
    </div>
  );
}
