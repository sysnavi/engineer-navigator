"use client";

import { useEffect, useRef, useState } from "react";

export type ChatMsg = { role: "USER" | "ASSISTANT"; content: string };

// ストリーミングチャットの共通ロジック（mentor / roleplay）。
//
// 受信と表示を完全に分離する:
// - 受信: fetchのチャンクを bufferRef に全速で溜める（描画には直接触らない）
// - 表示: TICK_MS間隔で1tickぶんの文字数だけstateへ反映する
//
// 受信チャンクをそのままstateへ流すと1チャンク=1再レンダー+1スクロールになり
// 出力が速いほど画面がカクつく、が元々の問題。表示レートは読解速度に寄せた基準値で、
// 受信が先行してバッファが膨らむほど自動加速する（読める速さ×待たせない）。
// skip()で残りを即時全表示。
//
// paceMode "section"（メンターのじっくりモード）: Markdown見出し(\n## )を境界に
// セクション単位で表示を止め、continueGate() が呼ばれるまで先を出さない。

const TICK_MS = 50;
// 基準レート: 2字/tick ≒ 40字/秒。日本語の読解速度(400〜600字/分)より少し速いくらい
const BASE_CHARS_PER_TICK = 2;
// 未表示がこの文字数を超えたぶんは 1/20 を1tickに上乗せして追いつく
const CATCHUP_THRESHOLD = 120;

// text中のセクション境界(\n## )を探し、allowed個目のセクションの終端位置を返す
function sectionLimit(text: string, allowed: number): number {
  const re = /\n(?=## )/g;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(text))) {
    if (m.index === 0) continue;
    count++;
    if (count >= allowed) return m.index;
  }
  return text.length;
}

export function useStreamChat(props: {
  endpoint: string;
  sessionId: string;
  initial: ChatMsg[];
  errorText: string;
  paceMode?: "flow" | "section";
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(props.initial);
  const [streaming, setStreaming] = useState(false);
  // 応答待ち（最初の1文字が届くまで）。オーバーレイはこの間だけ出す。
  const [waiting, setWaiting] = useState(false);
  // セクション境界で表示を止めて「つづき」を待っている
  const [gated, setGated] = useState(false);
  // 受信は完了した（表示が追いついていなくても良い）。「もう一回」チップの安全条件
  const [received, setReceived] = useState(false);
  // skip()済み（このレスポンスのペーシングを放棄した）。「ぜんぶ表示」ピルを即座に消すためのstate
  const [skipped, setSkipped] = useState(false);
  const bufferRef = useRef(""); // 受信済み全文
  const shownRef = useRef(0); // 表示済み文字数
  const doneRef = useRef(false); // 受信完了フラグ（表示が追いつくまでstreamingは続く）
  const skipRef = useRef(false); // ペーシング解除（残りを即時全表示）
  const allowedRef = useRef(1); // sectionモードで表示してよいセクション数
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // tickはタイマー起動時のクロージャから呼ばれるため、モードの最新値はrefで参照する
  const modeRef = useRef(props.paceMode ?? "flow");
  modeRef.current = props.paceMode ?? "flow";

  // アンマウント時は表示タイマーだけ止める（fetchは完走させてサーバー側の保存を妨げない）
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function tick() {
    const total = bufferRef.current.length;
    const limit =
      modeRef.current === "section" && !skipRef.current
        ? sectionLimit(bufferRef.current, allowedRef.current)
        : total;
    let shown = shownRef.current;
    if (skipRef.current) {
      shown = total;
    } else if (shown < limit) {
      // 追いつき加速はゲートの手前までを対象にする（ゲート先の未読分では加速しない）
      const backlog = limit - shown;
      const boost = Math.floor(Math.max(0, backlog - CATCHUP_THRESHOLD) / 20);
      shown = Math.min(limit, shown + BASE_CHARS_PER_TICK + boost);
    }
    if (shown !== shownRef.current) {
      shownRef.current = shown;
      const text = bufferRef.current.slice(0, shown);
      setMessages((m) => {
        const last = m[m.length - 1];
        if (!last || last.role !== "ASSISTANT") return m;
        // 末尾だけ差し替える。他要素は同一参照のままにして、memo化した吹き出しの再レンダーを防ぐ
        return [...m.slice(0, -1), { role: "ASSISTANT", content: text }];
      });
    }
    // ゲート: 表示が境界に達し、その先がまだある（同値のsetStateはReactが無視する）
    setGated(
      modeRef.current === "section" &&
        !skipRef.current &&
        shown >= limit &&
        limit < total
    );
    // 受信が終わり、表示も追いついたらストリーム終了
    if (doneRef.current && shown >= total) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setStreaming(false);
    }
  }

  async function stream(content: string) {
    setStreaming(true);
    setWaiting(true);
    setGated(false);
    setReceived(false);
    setSkipped(false);
    bufferRef.current = "";
    shownRef.current = 0;
    doneRef.current = false;
    skipRef.current = false;
    allowedRef.current = 1;
    setMessages((m) => [...m, { role: "ASSISTANT", content: "" }]);
    timerRef.current = setInterval(tick, TICK_MS);
    try {
      const res = await fetch(props.endpoint, {
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
        bufferRef.current += decoder.decode(value, { stream: true });
        // 最初のチャンクが届いたらオーバーレイを消す（同値のsetStateはReactが再レンダーしない）
        setWaiting(false);
      }
    } catch {
      if (!bufferRef.current) {
        bufferRef.current = props.errorText;
        skipRef.current = true; // エラー文は刻まず即表示
        setSkipped(true);
      }
    } finally {
      doneRef.current = true;
      setWaiting(false);
      setReceived(true);
      tick(); // タイマー停止条件の即時評価（表示済みならここで終了する）
    }
  }

  // ユーザー発言を追加してから返信をストリーミングする（通常の送信）
  async function send(content: string) {
    setMessages((m) => [...m, { role: "USER", content }]);
    await stream(content);
  }

  // 既に末尾にあるUSERメッセージへの返信だけを取りに行く（メンターの自動初回発火用）
  async function resume(content: string) {
    await stream(content);
  }

  // ペーシングとゲートをやめて残りを即時全表示（読み飛ばしたい人の逃げ道）。
  // skipRefはレスポンス終了までtrueのままなので、以後の受信分も1tickごとに即時反映される
  function skip() {
    skipRef.current = true;
    setSkipped(true);
    tick();
  }

  // ゲートを1つ進める（「▶ つづき」）
  function continueGate() {
    allowedRef.current += 1;
    tick();
  }

  return {
    messages,
    streaming,
    waiting,
    gated,
    received,
    skipped,
    send,
    resume,
    skip,
    continueGate,
  };
}
