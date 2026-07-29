"use client";

import { memo, useEffect, useRef, useState } from "react";
import { SendingOverlay } from "@/components/sending-overlay";
import { type ChatMsg, useStreamChat } from "@/components/chat/use-stream-chat";
import { useFollowBottom } from "@/components/chat/use-follow-bottom";
import { ChatComposer } from "@/components/chat/composer";

// メンターのチャット（ストリーミング）。
// 初期メッセージ列を受け取り、末尾がUSERで返信待ちなら自動で1回ストリームを開始する。
// 受信/表示の分離とペーシングは useStreamChat、スクロール追従は useFollowBottom 側。
// ここでは吹き出しをmemo化して、描画更新をストリーミング中の末尾1件に閉じ込める。
//
// じっくりモード: 回答を##セクション単位で区切って表示し、「▶ つづき」で読み進める。
// 「🔁 もう一回」は通常のチャットメッセージとして送るので、どこでつまずいたかが
// セッション履歴（DB）にそのまま残る。

const PACE_KEY = "mentor-pace";

const Bubble = memo(function Bubble(props: { msg: ChatMsg; thinking: boolean }) {
  const { msg, thinking } = props;
  return (
    <div className={msg.role === "USER" ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg border-2 border-line8 px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-hard-sm ${
          msg.role === "USER" ? "bg-royal text-white" : "bg-surface text-ink"
        }`}
      >
        {msg.content ||
          (thinking ? (
            <span className="font-pixel text-[12px] text-royal2">
              THINKING<span className="blink">_</span>
            </span>
          ) : (
            ""
          ))}
      </div>
    </div>
  );
});

export function MentorChat(props: { sessionId: string; initial: ChatMsg[] }) {
  // じっくりモードはローカル設定（端末ごと）。SSRとの不一致を避けるためマウント後に読む
  const [pace, setPace] = useState<"flow" | "section">("flow");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(PACE_KEY) === "section") setPace("section");
  }, []);

  const {
    messages,
    streaming,
    waiting,
    gated,
    received,
    send,
    resume,
    skip,
    continueGate,
  } = useStreamChat({
    endpoint: "/api/mentor",
    sessionId: props.sessionId,
    initial: props.initial,
    errorText: "[通信エラー。もう一度お試しください]",
    paceMode: pace,
  });
  const { bottomRef, away, jumpToBottom } = useFollowBottom(messages);
  const started = useRef(false);

  // 初期状態: 末尾がUSER（firstMessageのシード等）なら自動でメンターの返信を取りに行く。
  // stream() の同期setStateがeffect内で走らないよう次のtickに逃がす。
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const last = props.initial[props.initial.length - 1];
    if (last && last.role === "USER") {
      // setTimeout でeffectの同期実行から外す。started ガードで一度だけ発火するので
      // Strict Mode のクリーンアップでキャンセルはしない（キャンセルすると発火しなくなる）。
      setTimeout(() => void resume(last.content), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePace() {
    const next = pace === "flow" ? "section" : "flow";
    setPace(next);
    localStorage.setItem(PACE_KEY, next);
  }

  // いま読んでいたセクションの見出しを添えて、かみくだき直しを頼む。
  // skip()で現在の回答を確定させてから送る（受信完了時のみチップを出すので安全）
  function askAgain() {
    const last = messages[messages.length - 1];
    const heads = [...last.content.matchAll(/^##\s*(.+)$/gm)];
    const title = heads.length ? heads[heads.length - 1][1].trim() : "";
    skip();
    void send(
      title
        ? `「${title}」のところが難しかったです。もっとかみくだいて説明してください`
        : "いまの説明が難しかったです。もっとかみくだいて説明してください"
    );
  }

  // 読み戻し中は「↓ 最新へ」、追従中は「▶▶ ぜんぶ表示」（ペーシングの逃げ道）。
  // ゲート待ちの間はチップ（つづき/もう一回）が主役なのでピルは出さない
  const notice =
    streaming && !gated
      ? away
        ? { label: "↓ 最新へ", onClick: jumpToBottom }
        : { label: "▶▶ ぜんぶ表示", onClick: skip }
      : null;

  return (
    <div className="flex flex-col gap-4">
      <SendingOverlay show={waiting} label="送信中" />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={togglePace}
          aria-pressed={pace === "section"}
          title="回答をセクションごとに区切って、自分のペースで読み進める"
          className={`rounded-md border-2 border-line8 px-2.5 py-1 font-pixel text-[10px] tracking-wide shadow-hard-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
            pace === "section" ? "bg-royal text-white" : "bg-win text-inksoft"
          }`}
        >
          ⏱ じっくりモード{pace === "section" ? " ON" : ""}
        </button>
      </div>
      <div className="space-y-3">
        {messages.map((m, i) => (
          <Bubble
            key={i}
            msg={m}
            thinking={streaming && i === messages.length - 1}
          />
        ))}
        {gated && (
          <div className="flex gap-2 pl-1">
            <button
              type="button"
              onClick={continueGate}
              className="btn8 btn8-ok px-3 py-1.5 text-[11px]"
            >
              ▶ つづき
            </button>
            {received && (
              <button
                type="button"
                onClick={askAgain}
                className="btn8 px-3 py-1.5 text-[11px]"
              >
                🔁 もう一回
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatComposer
        placeholder="メンターに質問する…"
        sendLabel="送信"
        disabled={streaming}
        onSend={(content) => void send(content)}
        notice={notice}
      />
    </div>
  );
}
