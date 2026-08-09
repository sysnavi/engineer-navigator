"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { summarizeInterview } from "@/app/actions";

// インタビューの会話状態と送受信ロジック。
// チャットモード（interview.tsx）とハンズフリーモード（voice-interview.tsx）で共有する。
// 会話はDBに保存しないステートレス設計: クライアントが transcript を毎回送る。

export type InterviewMsg = { role: "user" | "assistant"; content: string };

const READY_MARKER = "[READY]";

// 最初の質問は固定（ラウンドトリップ節約 + 安定した導入）。
// 2問目以降はAIが会話とプロフィール（前週のnextText等）を踏まえて聞く。
export const OPENING =
  "おつかれさま！今週の週報、話すだけでまとめるよ。\nまず、今週の調子はどうだった？ ☀️好調 / 🌤普通 / ☁️モヤモヤ / 🌧しんどい でいうと？";

function stripMarker(text: string): string {
  return text.replace(READY_MARKER, "").trimEnd();
}

export type Interview = ReturnType<typeof useInterview>;

export function useInterview() {
  const router = useRouter();
  const [messages, setMessages] = useState<InterviewMsg[]>([
    { role: "assistant", content: OPENING },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [ready, setReady] = useState(false);
  const [summarizing, startSummarize] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const answeredCount = messages.filter((m) => m.role === "user").length;

  /**
   * 回答を送り、AIの次の質問をストリーミングで受け取る。
   * 戻り値はハンズフリーモードの読み上げ用（表示テキストと完了フラグ）。
   * 通信エラー時は null（メッセージ欄には復帰用の文言が入る）。
   */
  async function send(
    content: string
  ): Promise<{ text: string; ready: boolean } | null> {
    const trimmed = content.trim();
    if (!trimmed || streaming || summarizing) return null;
    const nextTranscript: InterviewMsg[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
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
      const isReady = full.includes(READY_MARKER);
      if (isReady) setReady(true);
      return { text: stripMarker(full), ready: isReady };
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content:
            copy[copy.length - 1].content || "[通信エラー。もう一度どうぞ]",
        };
        return copy;
      });
      return null;
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

  return {
    messages,
    streaming,
    ready,
    error,
    summarizing,
    answeredCount,
    send,
    summarize,
  };
}
