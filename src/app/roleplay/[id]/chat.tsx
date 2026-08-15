"use client";

import { memo } from "react";
import { useFormStatus } from "react-dom";
import { SendingOverlay } from "@/components/sending-overlay";
import { type ChatMsg, useStreamChat } from "@/components/chat/use-stream-chat";
import { useFollowBottom } from "@/components/chat/use-follow-bottom";
import { ChatComposer } from "@/components/chat/composer";

// ロールプレイのチャット。相手役の第一声は事前生成済み(ASSISTANT)なので自動発火はしない。
// ユーザー(エンジニア)が話す→相手役の返信をストリーミング。
// 受信/表示の分離とペーシングは useStreamChat、スクロール追従は useFollowBottom 側。
// 吹き出しはmemo化して、描画更新をストリーミング中の末尾1件に閉じ込める。

// 終了ボタン。1回もやり取りしていない（未入力）うちは押せないようにする。
function EndButton(props: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn8 btn8-start text-[12px]"
      disabled={props.disabled || pending}
    >
      {pending ? "集計中…" : "▶ 演習を終了してフィードバックを見る"}
    </button>
  );
}

const Bubble = memo(function Bubble(props: { msg: ChatMsg; thinking: boolean }) {
  const { msg, thinking } = props;
  return (
    <div className={msg.role === "USER" ? "flex justify-end" : "flex justify-start"}>
      <div className="max-w-[85%]">
        <p
          className={`mb-1 font-pixel text-[10px] tracking-wide ${
            msg.role === "USER" ? "text-right text-royal2" : "text-inksoft"
          }`}
        >
          {msg.role === "USER" ? "あなた" : "相手役"}
        </p>
        <div
          className={`whitespace-pre-wrap rounded-lg border-2 border-line8 px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-hard-sm ${
            msg.role === "USER" ? "bg-royal text-white" : "bg-surface text-ink"
          }`}
        >
          {msg.content ||
            (thinking ? (
              <span className="font-pixel text-[12px] text-royal2">
                …<span className="blink">_</span>
              </span>
            ) : (
              ""
            ))}
        </div>
      </div>
    </div>
  );
});

export function RoleplayChat(props: {
  sessionId: string;
  initial: ChatMsg[];
  endAction: () => Promise<void>;
  objectives: string[];
}) {
  const { messages, streaming, waiting, skipped, send, skip } = useStreamChat({
    endpoint: "/api/roleplay",
    sessionId: props.sessionId,
    initial: props.initial,
    errorText: "[通信エラー]",
  });
  const { bottomRef, away, jumpToBottom } = useFollowBottom(messages);
  // 1回でもユーザーが発言していれば終了可能（未入力での終了＝無駄なAI呼び出し/エラーを防ぐ）
  const hasUserMsg = messages.some((m) => m.role === "USER");

  // 読み戻し中は「↓ 最新へ」、追従中は「▶▶ ぜんぶ表示」（ペーシングの逃げ道）。
  // skip後は即ピルを消す（押した手応え）。1文字も届いていない間もskipは無意味なので出さない
  const notice = streaming
    ? away
      ? { label: "↓ 最新へ", onClick: jumpToBottom }
      : !skipped && !waiting
        ? { label: "▶▶ ぜんぶ表示", onClick: skip }
        : null
    : null;

  return (
    <div className="flex flex-col gap-4">
      <SendingOverlay show={waiting} label="送信中" />
      <div className="space-y-3">
        {messages.map((m, i) => (
          <Bubble
            key={i}
            msg={m}
            thinking={streaming && i === messages.length - 1}
          />
        ))}
        {/* scroll-mb: 追従スクロール時に最終行がドック（+desktopシェルのタスクバー）に隠れないための下マージン */}
        <div ref={bottomRef} className="scroll-mb-36" />
      </div>

      <ChatComposer
        placeholder="この場面での対応を入力…"
        sendLabel="返す"
        disabled={streaming}
        onSend={(content) => void send(content)}
        notice={notice}
      />

      <div className="rounded-lg border-2 border-line8 bg-surface p-4 shadow-hard-sm">
        <p className="mb-2 font-pixel text-[11px] tracking-wide text-inksoft">
          評価観点（この観点でフィードバックされます）
        </p>
        <ul className="mb-3 list-inside list-disc space-y-1 text-[12px] text-inksoft">
          {props.objectives.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
        <form action={props.endAction}>
          <EndButton disabled={!hasUserMsg || streaming} />
        </form>
        {!hasUserMsg && (
          <p className="mt-2 text-[11.5px] text-inksoft">
            まず相手役と1回はやり取りしてから終了できます（未入力では評価できません）。
          </p>
        )}
      </div>
    </div>
  );
}
