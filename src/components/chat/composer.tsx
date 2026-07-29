"use client";

import { useState } from "react";
import { MicButton } from "@/components/mic-button";

// チャットの入力ドック（mentor / roleplay 共通）。
// 画面下に貼り付き（.chat-dock）、⤢で全画面エディタに切り替えて長文も見渡せる。
// notice はドックの上に浮かぶ1アクション（「↓ 最新へ」「▶▶ ぜんぶ表示」など）。

export function ChatComposer(props: {
  placeholder: string;
  sendLabel: string;
  disabled: boolean;
  onSend: (content: string) => void;
  notice?: { label: string; onClick: () => void } | null;
}) {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const content = input.trim();
    if (!content || props.disabled) return;
    setInput("");
    setExpanded(false);
    props.onSend(content);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
    if (e.key === "Escape") setExpanded(false);
  }

  return (
    <>
      <div className="chat-dock">
        {props.notice && (
          <div className="pointer-events-none absolute -top-11 inset-x-0 flex justify-center">
            <button
              type="button"
              onClick={props.notice.onClick}
              className="pointer-events-auto rounded-full border-2 border-line8 bg-royal px-3.5 py-1.5 font-pixel text-[11px] tracking-wide text-white shadow-hard-sm"
            >
              {props.notice.label}
            </button>
          </div>
        )}
        <form
          onSubmit={submit}
          className="flex items-end gap-2 rounded-lg border-2 border-line8 bg-win p-2 shadow-hard-sm sm:gap-2.5 sm:p-2.5"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={props.placeholder}
            className="field8"
            disabled={props.disabled}
          />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            disabled={props.disabled}
            aria-label="拡大して書く"
            title="拡大して書く"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[2.5px] border-line8 bg-win text-[15px] text-ink shadow-hard-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
          >
            <span aria-hidden="true">⤢</span>
          </button>
          <MicButton
            disabled={props.disabled}
            onText={(t) => setInput((v) => (v ? `${v} ${t}` : t))}
          />
          <button
            type="submit"
            className="btn8 btn8-start shrink-0 text-[12px]"
            disabled={props.disabled || !input.trim()}
          >
            ▶ {props.sendLabel}
          </button>
        </form>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-40 flex flex-col bg-ink/50 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:p-6">
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 rounded-lg border-2 border-line8 bg-win p-3 shadow-hard-sm sm:p-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={props.placeholder}
              autoFocus
              // field8を付けるとグローバルの自動伸縮に高さを奪われるため、ここは手書きで同じ見た目にする
              className="w-full flex-1 resize-none rounded-md border-2 border-line8 bg-surface p-3 text-[16px] leading-relaxed text-ink caret-pinkhot focus:outline-3 focus:outline-sky8"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="btn8 text-[12px]"
              >
                とじる
              </button>
              <div className="flex items-center gap-2">
                <MicButton
                  disabled={props.disabled}
                  onText={(t) => setInput((v) => (v ? `${v} ${t}` : t))}
                />
                <button
                  type="button"
                  onClick={() => submit()}
                  className="btn8 btn8-start text-[12px]"
                  disabled={props.disabled || !input.trim()}
                >
                  ▶ {props.sendLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
