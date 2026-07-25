"use client";

// ペットとの「会話」パネル。おせわメニューの「はなす」から開く。
//
// 【声について】音声合成でも録音でもなく、文字数ぶんの短いビープを鳴らす
// （どうぶつの森方式）。データ不要・コスト0で、8bitの世界と噛み合う。
// 種族idからピッチを決めるので、子ごとに声の高さが変わる。

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { petTalk, type TalkTurn } from "./talk-actions";

const TYPE_MS = 42; // 1文字あたりの表示間隔

// --- ぴこぴこ喋り -----------------------------------------------------------
let actx: AudioContext | null = null;
/** 種族ごとに声の高さを変える（idから決定的に） */
function voicePitch(speciesId: string): number {
  let h = 0;
  for (let i = 0; i < speciesId.length; i++) h = (h * 31 + speciesId.charCodeAt(i)) >>> 0;
  return 320 + (h % 9) * 45; // 320〜680Hz
}
function blip(base: number) {
  try {
    actx ??= new AudioContext();
    if (actx.state === "suspended") actx.resume();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "square";
    // 1音ごとに少しだけ揺らすと「喋っている」感じになる
    o.frequency.value = base * (0.94 + Math.random() * 0.12);
    g.gain.setValueAtTime(0.05, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.055);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + 0.06);
  } catch {
    /* 音が出せない環境でも会話は成立する */
  }
}

export function TalkPanel(props: {
  petId: string;
  petName: string;
  speciesId: string;
  spriteNormal: string;
  spriteHappy: string;
  initialRemaining: number;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<TalkTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState(props.initialRemaining);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<string | null>(null); // 表示途中の返事
  const [remembered, setRemembered] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const logRef = useRef<HTMLDivElement | null>(null);
  const pitch = voicePitch(props.speciesId);

  // 新しい行が増えたら下まで送る
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns, typing]);

  /** 返事を1文字ずつ出しながら鳴らす */
  const typeOut = (full: string) => {
    let i = 0;
    setTyping("");
    const timer = setInterval(() => {
      i++;
      setTyping(full.slice(0, i));
      const ch = full[i - 1];
      if (soundOn && ch && !"　 、。！？…・".includes(ch) && i % 2 === 1) blip(pitch);
      if (i >= full.length) {
        clearInterval(timer);
        setTyping(null);
        setTurns((t) => [...t, { role: "pet", text: full }]);
      }
    }, TYPE_MS);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || pending || remaining <= 0) return;
    setError(null);
    setRemembered(null);
    setInput("");
    const history = [...turns];
    setTurns([...history, { role: "user", text }]);
    setPending(true);
    try {
      const r = await petTalk(props.petId, text, history);
      if (r.ok) {
        setRemaining(r.remaining);
        if (r.remembered) setRemembered(r.remembered);
        typeOut(r.reply);
      } else {
        setError(r.error);
      }
    } catch {
      setError("うまく はなせなかった…。もういちど どうぞ。");
    } finally {
      setPending(false);
    }
  };

  if (typeof document === "undefined") return null;

  const spriteNow = typing != null || pending ? props.spriteHappy : props.spriteNormal;

  return createPortal(
    <div
      className="fixed inset-0 z-[1400] flex items-end justify-center sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`${props.petName}とはなす`}
    >
      <div className="absolute inset-0 bg-ink/45" onClick={props.onClose} />
      <div className="relative mb-[calc(54px+env(safe-area-inset-bottom))] flex max-h-[76vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-xl border-[3px] border-b-0 border-line8 bg-win shadow-hard sm:mb-0 sm:max-h-[85vh] sm:max-w-[380px] sm:rounded-xl sm:border-b-[3px]">
        <div className="flex shrink-0 items-center gap-2 bg-royal px-2.5 py-1.5 font-pixel text-[11px] tracking-wide text-white">
          <span className="mx-auto h-1 w-10 rounded-full bg-white/70 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">
            はなす<span className="text-peri">.exe</span>
          </span>
          <button
            onClick={() => setSoundOn((v) => !v)}
            aria-pressed={soundOn}
            title={soundOn ? "こえを けす" : "こえを だす"}
            className="ml-auto rounded border-2 border-white px-1.5 text-[10px] leading-tight"
          >
            {soundOn ? "♪" : "🔇"}
          </button>
          <button
            onClick={props.onClose}
            className="rounded border-2 border-white px-1.5 text-[10px] leading-tight"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* 会話ログ */}
        <div ref={logRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          <div className="flex items-center gap-2.5 rounded-lg border-2 border-dashed border-peri bg-surface px-2.5 py-2">
            <Image
              src={spriteNow}
              alt=""
              width={40}
              height={40}
              style={{ imageRendering: "pixelated" }}
              unoptimized
            />
            <p className="text-[11.5px] leading-snug text-inksoft">
              {props.petName}は、きみの週報やダンジョンのことを知っています。
            </p>
          </div>

          {turns.map((t, i) =>
            t.role === "user" ? (
              <p
                key={i}
                className="ml-auto max-w-[80%] rounded-lg border-2 border-line8 bg-royal px-2.5 py-1.5 text-[12.5px] text-white"
              >
                {t.text}
              </p>
            ) : (
              <p
                key={i}
                className="max-w-[85%] rounded-lg border-2 border-line8 bg-surface px-2.5 py-1.5 text-[12.5px] leading-relaxed"
              >
                {t.text}
              </p>
            )
          )}

          {typing != null && (
            <p className="max-w-[85%] rounded-lg border-2 border-line8 bg-surface px-2.5 py-1.5 text-[12.5px] leading-relaxed">
              {typing}
              <span className="animate-pulse">▌</span>
            </p>
          )}
          {pending && typing == null && (
            <p className="font-pixel text-[10px] tracking-wide text-inksoft">
              {props.petName}が かんがえてる…
            </p>
          )}
          {remembered && (
            <p className="rounded-lg border-2 border-dashed border-lemon bg-quotebg px-2.5 py-1.5 font-pixel text-[10px] tracking-wide text-royal2">
              📝 おぼえた: {remembered}
            </p>
          )}
          {error && (
            <p className="rounded-lg border-2 border-pinkhot bg-quotebg px-2.5 py-1.5 text-[12px] font-bold">
              {error}
            </p>
          )}
        </div>

        {/* 入力 */}
        <div className="shrink-0 border-t-2 border-line8 p-2.5">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
              }}
              maxLength={300}
              disabled={pending || remaining <= 0}
              placeholder={remaining > 0 ? "はなしかける…" : "きょうは おしまい"}
              aria-label="はなしかける内容"
              className="field8 min-w-0 flex-1 !py-1.5 text-[12.5px]"
            />
            <button
              onClick={send}
              disabled={pending || remaining <= 0 || !input.trim()}
              className="btn8 btn8-start px-3 text-[12px] disabled:opacity-45"
            >
              ▶
            </button>
          </div>
          <p className="mt-1 font-pixel text-[9.5px] tracking-wide text-inksoft">
            きょう あと {remaining} 回
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
