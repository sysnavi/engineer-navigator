"use client";

// ダンジョン（問いに答えて倒す）のUI。
//
// 【前の問題】コマンド戦闘は「たたかう連打、ボスがためたら まもる」で終わり、
// エンジニアであることが戦闘に乗っていなかった。
//
// 【この画面の原則】
//  - **待つ**。メッセージは1つずつ出して、必ずクリックで進める。勝手に進まない。
//  - **見せる**。HP/SP/敵HP/問いを常に出す。判断に必要な情報を隠さない。
//  - **選ばせる**。戦闘は問いへの解答（か、見送るか）、階層移動は深さの選択。
//    正誤もダメージもサーバーが決める。クライアントは選択肢の番号しか送らない。

import { useEffect, useRef, useState } from "react";
import { PixelAvatar } from "@/components/pixel-avatar";
import type { BattleLog } from "@/lib/dungeon/battle";
import { startDive, act, type DiveView } from "./session-actions";
import type { BattleCommand } from "@/lib/dungeon/battle";
import type { Choice } from "@/lib/dungeon/session";
import type { Facing } from "@/lib/dungeon/map";
import { FirstPersonView } from "./first-person-view";

const FACING_LABEL = ["N", "E", "S", "W"];

// --- 効果音（既存のダンジョンと同じ作り。音が出せない環境でも進行する）---
let actx: AudioContext | null = null;
function blip(freq: number, dur = 0.07, type: OscillatorType = "square", vol = 0.04) {
  try {
    actx ??= new AudioContext();
    if (actx.state === "suspended") actx.resume();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch {
    /* 無音でも進行 */
  }
}
const seHit = () => blip(180, 0.08);
const seHurt = () => blip(110, 0.12, "sawtooth");
const seCrit = () => {
  blip(880, 0.06);
  setTimeout(() => blip(1320, 0.1), 60);
};
const seCoin = () => {
  blip(988, 0.06);
  setTimeout(() => blip(1319, 0.12), 70);
};
const seFanfare = () =>
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.12), i * 130));

/** 1文字あたりの表示間隔。以前は24ms（毎秒42文字）で速すぎた */
const TYPE_MS = 55;

/** 振動（Android/Chrome）。無い環境では何もしない */
function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 無視 */
  }
}

// --- 操作パッドのアイコン ---
// 文字の ▲◀ はピクセルフォントにグリフが無くフォールバックで描かれ、letter-spacing も乗って
// 中央からズレる。SVG で描けばボタンの中心にぴたりと乗る。
function TriIcon(props: { dir: "up" | "down"; size?: number }) {
  const n = props.size ?? 16;
  return (
    <svg
      viewBox="0 0 16 16"
      width={n}
      height={n}
      aria-hidden
      className="shrink-0"
      style={props.dir === "down" ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M8 2.5 L14 13 H2 Z" fill="currentColor" />
    </svg>
  );
}
/** 曲がり矢印（道路標識の「左折」）。◀ だと「左に歩く」に見えるが、実際は向きを変えるだけ */
function TurnIcon(props: { dir: "left" | "right"; size?: number }) {
  const n = props.size ?? 20;
  return (
    <svg viewBox="0 0 16 16" width={n} height={n} aria-hidden className="shrink-0">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={props.dir === "right" ? "translate(16 0) scale(-1 1)" : undefined}
      >
        <path d="M11.5 14 V8.5 A3.5 3.5 0 0 0 8 5 H4.5" />
        <path d="M7 2.5 L4.5 5 L7 7.5" />
      </g>
    </svg>
  );
}

function fxSound(fx: BattleLog["fx"]) {
  if (fx === "crit") seCrit();
  else if (fx === "hit" || fx === "correct") seHit();
  else if (fx === "wrong") seHurt();
  else if (fx === "guard") blip(300, 0.09, "triangle");
  else if (fx === "heal") seCoin();
  else if (fx === "miss") blip(140, 0.1, "triangle");
  else if (fx === "charge") blip(220, 0.16, "sawtooth", 0.05);
  else if (fx === "flee") blip(660, 0.1, "triangle");
}

function Gauge(props: { label: string; now: number; max: number; color: string }) {
  const pct = props.max > 0 ? Math.max(0, Math.min(100, (props.now / props.max) * 100)) : 0;
  return (
    <div className="min-w-[92px] flex-1">
      <div className="flex items-baseline justify-between font-pixel text-[9.5px] tracking-wide">
        <span className="text-inksoft">{props.label}</span>
        <span>
          {props.now}/{props.max}
        </span>
      </div>
      <div className="mt-0.5 h-2.5 rounded-sm border-2 border-line8 bg-surface">
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: props.color }}
        />
      </div>
    </div>
  );
}

export function DivePlayer(props: {
  canDive: boolean;
  diveKind: "daily" | "bonus" | "earned" | null;
  restingMessage: string | null;
  avatarSprite: string;
  avatarAccent?: string;
  baseDepth: number;
  initialView: DiveView | null;
}) {
  const [view, setView] = useState<DiveView | null>(props.initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 向きはクライアントが持つ（描画にしか効かない）。進む時に move に載せてサーバーへ
  const [facing, setFacing] = useState<Facing>(props.initialView?.map?.facing ?? 1);
  // 「出口」は誤タップで潜行が終わる危険ボタンなので、ひと呼吸（確認行）を挟む
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  // 表示中のログ（1つずつ・クリックで進める）
  const [queue, setQueue] = useState<BattleLog[]>([]);
  const [shown, setShown] = useState<BattleLog[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const typeRef = useRef(0);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [shown, typing]);

  /** サーバーから返った状態を取り込み、ログを1つずつ出す準備をする */
  const apply = (v: DiveView) => {
    // 歩いたのに位置が変わらない＝壁。少し強めに振動させて「ぶつかった」を手に伝える
    const prev = view;
    if (prev?.map && v.map && prev.phase === "EXPLORE" && v.phase === "EXPLORE") {
      buzz(prev.map.x === v.map.x && prev.map.y === v.map.y ? 40 : 12);
    }
    setView(v);
    setLeaveConfirm(false);
    if (v.map) setFacing(v.map.facing);
    setQueue(v.logs);
    setShown([]);
    setTyping(null);
  };

  // キューの先頭を1文字ずつ流す。状態の更新はタイマーのコールバック側で行う
  const runningRef = useRef(false);
  useEffect(() => {
    if (runningRef.current || queue.length === 0) return;
    runningRef.current = true;
    const [head, ...rest] = queue;
    const token = ++typeRef.current;
    fxSound(head.fx);
    let i = 0;
    const t = setInterval(() => {
      if (token !== typeRef.current) {
        clearInterval(t);
        return;
      }
      i++;
      setTyping(head.text.slice(0, i));
      if (i >= head.text.length) {
        clearInterval(t);
        runningRef.current = false;
        setTyping(null);
        setShown((s) => [...s, head]);
        setQueue(rest);
      }
    }, TYPE_MS);
    return () => {
      clearInterval(t);
      runningRef.current = false;
    };
  }, [queue]);

  /** 文字送りを飛ばす（せっかちな人向け） */
  const skipTyping = () => {
    if (queue.length === 0) return;
    typeRef.current++;
    runningRef.current = false;
    const [head, ...rest] = queue;
    setTyping(null);
    setShown((s) => [...s, head]);
    setQueue(rest);
  };

  const send = async (fn: () => Promise<{ ok: true; view: DiveView } | { ok: false; error: string }>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (r.ok) apply(r.view);
      else setError(r.error);
    } catch {
      setError("うまく つながらなかった。もういちど。");
    } finally {
      setBusy(false);
    }
  };

  const begin = () => send(() => startDive());
  const battle = (command: BattleCommand) =>
    send(() => act(view!.runId, { type: "battle", command }));
  const answer = (choiceIndex: number) =>
    send(() => act(view!.runId, { type: "answer", choiceIndex }));
  const next = () => send(() => act(view!.runId, { type: "next" }));
  const choose = (choice: Choice) => send(() => act(view!.runId, { type: "choice", choice }));
  const turn = (d: -1 | 1) => {
    buzz(8);
    setFacing(((facing + d + 4) % 4) as Facing);
  };
  const step = (sign: 1 | -1) =>
    send(() =>
      act(view!.runId, { type: "move", dir: ((facing + (sign < 0 ? 2 : 0)) % 4) as Facing, facing })
    );

  // 「すすむ」長押しで歩き続ける。間隔ごとに最新の step を呼ぶ（busy 中は send が弾くので詰まらない）
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; loop: ReturnType<typeof setInterval> | null; ran: boolean }>({
    timer: null,
    loop: null,
    ran: false,
  });
  const holdStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    holdStop();
    hold.current.ran = false;
    hold.current.timer = setTimeout(() => {
      hold.current.ran = true;
      stepRef.current(1);
      hold.current.loop = setInterval(() => stepRef.current(1), 240);
    }, 380);
  };
  const holdStop = () => {
    if (hold.current.timer) clearTimeout(hold.current.timer);
    if (hold.current.loop) clearInterval(hold.current.loop);
    hold.current.timer = null;
    hold.current.loop = null;
  };
  /** 長押しの後に発火する click は無視する（離した瞬間にもう1歩進んでしまうのを防ぐ） */
  const forwardClick = () => {
    if (hold.current.ran) {
      hold.current.ran = false;
      return;
    }
    step(1);
  };
  useEffect(() => holdStop, []);

  // キーボード: 探索中だけ（矢印 / WASD）
  // 探索フェーズのあいだは矢印キーのデフォルト（ページスクロール）を常に止める。
  // 以前は「動ける瞬間」だけリスナーを付けていたので、サーバー往復中や文字送り中に
  // 押した矢印がブラウザに渡ってページが上下に滑っていた。
  const inExplore = view?.phase === "EXPLORE";
  const exploring = inExplore && queue.length === 0 && typing === null && !busy;
  useEffect(() => {
    if (!inExplore) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const isNav = k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright" || k === "w" || k === "a" || k === "s" || k === "d";
      if (!isNav) return;
      e.preventDefault();
      if (!exploring) return;
      if (k === "arrowup" || k === "w") step(1);
      else if (k === "arrowdown" || k === "s") step(-1);
      else if (k === "arrowleft" || k === "a") turn(-1);
      else if (k === "arrowright" || k === "d") turn(1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inExplore, exploring, facing, view?.runId]);

  // 決着したらファンファーレ
  useEffect(() => {
    if (view?.phase === "END" && queue.length === 0 && typing === null) {
      if (view.ending === "cleared") seFanfare();
      else if (view.ending === "defeated") seHurt();
    }
  }, [view?.phase, view?.ending, queue.length, typing]);

  // --- 潜行していないとき ---
  if (!view) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-3">
          <PixelAvatar sprite={props.avatarSprite} px={5} accent={props.avatarAccent} />
          <div className="min-w-0 flex-1">
            {props.canDive ? (
              <>
                <p className="text-[13px] font-bold">
                  地下{props.baseDepth}階から 潜れます。
                </p>
                <p className="mt-0.5 text-[11.5px] text-inksoft">
                  迷路を歩いて階段を探す。出会った相手には問いで答える。
                  HPは潜行のあいだ持ち越し。
                </p>
              </>
            ) : (
              <p className="text-[12.5px]">{props.restingMessage}</p>
            )}
          </div>
        </div>
        {props.canDive && (
          <button onClick={begin} disabled={busy} className="btn8 btn8-start w-full py-2.5 text-[13px] disabled:opacity-50">
            {busy ? "もぐっています…" : props.diveKind === "bonus" ? "▶ もう一潜り（週報ボーナス）" : "▶ 潜る"}
          </button>
        )}
        {error && (
          <p className="rounded-lg border-2 border-pinkhot bg-quotebg px-3 py-2 text-[12.5px] font-bold">
            {error}
          </p>
        )}
      </div>
    );
  }

  const typingDone = queue.length === 0 && typing === null;
  const v = view;

  return (
    <div className="space-y-3">
      {/* ステータス */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-line8 bg-surface px-3 py-2">
        <span className="font-pixel text-[11px] tracking-wide text-royal2">
          地下{v.depth}階
          <span className="ml-1.5 text-inksoft">
            {v.floor}/{v.maxFloors}
          </span>
        </span>
        <Gauge label="HP" now={v.hp} max={v.maxHp} color="var(--good, #2e9e5b)" />
        <Gauge label="SP" now={v.sp} max={v.maxSp} color="var(--royal-2)" />
        {v.shieldLeft > 0 && (
          <span className="rounded border-2 border-lemon bg-win px-1.5 font-pixel text-[9.5px] tracking-wide text-royal2">
            🛡 盾 {v.shieldLeft}
          </span>
        )}
      </div>

      {/* 舞台: 迷路の一人称ビュー（無ければアバターだけ） */}
      {v.map ? (
        // PC では横幅いっぱいの 4:3 が縦 1000px 級になり操作パッドが画面外へ出ていた。
        // 高さを画面の 52%（上限 520px）で頭打ちにし、幅はそれに合わせて中央寄せ
        <div className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-lg border-2 border-line8 bg-[#0b1130] sm:max-w-[calc(min(52dvh,520px)*4/3)]">
          <FirstPersonView
            map={v.map}
            facing={facing}
            foe={v.foe ? { sprite: v.foe.sprite, boss: v.foe.boss } : null}
          />
          <span className="absolute left-2 top-1 font-pixel text-[11px] tracking-widest text-[#cfe1ff] [text-shadow:1px_1px_0_#000]">
            {FACING_LABEL[facing]}
          </span>
          {v.foe && (
            <span className="absolute bottom-1.5 left-2 right-2 flex items-center gap-2 font-pixel text-[10px] tracking-wide text-[#ffb3d6] [text-shadow:1px_1px_0_#000]">
              <span>
                {v.foe.name}
                {v.foe.charging && <span className="ml-1 text-lemon">…ためている！</span>}
                {v.foe.rapid && <span className="ml-1 text-[#9fd0ff]">○×</span>}
              </span>
              <span className="h-2 w-[92px] rounded-sm border-2 border-[#cfe1ff]/60 bg-black/50">
                <span
                  className="block h-full bg-pinkhot transition-[width] duration-300"
                  style={{ width: `${(v.foe.hp / v.foe.maxHp) * 100}%` }}
                />
              </span>
            </span>
          )}
        </div>
      ) : (
        <div className="relative flex min-h-[96px] items-end justify-between rounded-lg border-2 border-line8 bg-quotebg px-4 py-3">
          <span className="block">
            <PixelAvatar sprite={props.avatarSprite} px={5} accent={props.avatarAccent} />
          </span>
        </div>
      )}

      {/* メッセージ（クリックで進む） */}
      <div
        ref={logRef}
        onClick={skipTyping}
        className="max-h-[150px] min-h-[72px] space-y-1 overflow-y-auto rounded-lg border-2 border-line8 bg-win px-3 py-2 text-[12.5px] leading-relaxed"
      >
        {shown.map((l, i) => (
          <p key={i}>
            {l.text}
            {l.damage != null && l.damage > 0 && (
              <b className={l.target === "hero" ? "ml-1.5 text-pinkhot" : "ml-1.5 text-royal2"}>
                {l.target === "hero" ? "-" : "-"}
                {l.damage}
              </b>
            )}
          </p>
        ))}
        {typing !== null && (
          <p>
            {typing}
            <span className="animate-pulse">▌</span>
          </p>
        )}
      </div>

      {/* コマンド */}
      {!typingDone ? (
        <p className="text-center font-pixel text-[10px] tracking-wide text-inksoft">
          （クリックで はやく送る）
        </p>
      ) : v.phase === "BATTLE" && v.foe?.question ? (
        <div className="space-y-2">
          {/* 問い */}
          <div className="rounded-lg border-[2.5px] border-line8 bg-surface p-3 shadow-hard-sm">
            <div className="flex items-center gap-1.5 font-pixel text-[10px] tracking-wide">
              <span className="chip8 chip8-info">{v.foe.question.topic}</span>
              {v.foe.question.difficulty === 3 && (
                <span className="chip8 text-pinkhot">難問</span>
              )}
              {v.foe.question.source === "bank" && (
                <span className="text-inksoft">良問バンク</span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[13.5px] font-bold leading-relaxed">
              {v.foe.question.prompt}
            </p>
            <div
              className={
                v.foe.question.kind === "truefalse"
                  ? "mt-3 grid grid-cols-2 gap-2"
                  : "mt-3 space-y-2"
              }
            >
              {v.foe.question.choices.map((c, idx) => {
                const hidden = v.foe!.question!.hidden.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => answer(idx)}
                    disabled={busy || hidden}
                    className={`flex w-full items-center gap-2.5 rounded-lg border-2 border-line8 px-3 py-2.5 text-left text-[13px] shadow-hard-sm transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:cursor-default ${
                      hidden ? "bg-surface2 text-inksoft line-through opacity-50" : "bg-win"
                    }`}
                  >
                    {v.foe!.question!.kind === "choice" && (
                      <span className="font-pixel text-[11px] text-inksoft">
                        {String.fromCharCode(65 + idx)}
                      </span>
                    )}
                    <span className="flex-1">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 解答以外のコマンド */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button
              onClick={() => battle("pass")}
              disabled={busy}
              title="この問いを見送る。敵の攻撃は軽く受ける"
              className="btn8 py-2 text-[12px] disabled:opacity-50"
            >
              🛡 パス
            </button>
            <button
              onClick={() => battle("hint")}
              disabled={busy || v.sp < v.hintCost || v.foe.question.kind !== "choice"}
              title={
                v.foe.question.kind !== "choice"
                  ? "○×には きかない"
                  : v.sp < v.hintCost
                    ? "SPが たりない"
                    : `SPを${v.hintCost}つかって 選択肢を2つ消す`
              }
              className="btn8 btn8-ok py-2 text-[12px] disabled:opacity-40"
            >
              ✦ ヒント
            </button>
            <button
              onClick={() => battle("item")}
              disabled={busy || v.items.length === 0}
              className="btn8 py-2 text-[12px] disabled:opacity-40"
            >
              🍙 どうぐ{v.items.length > 0 && `(${v.items.length})`}
            </button>
            {v.charms > 0 && (
              <button
                onClick={() => battle("charm")}
                disabled={busy}
                title="AIメンターに相談した日だけ持てる。HPが全快する"
                className="btn8 py-2 text-[12px] disabled:opacity-40"
                style={{ borderColor: "var(--lemon)" }}
              >
                ✨ おふだ({v.charms})
              </button>
            )}
            <button
              onClick={() => battle("flee")}
              disabled={busy || !v.canFlee}
              title={v.canFlee ? "" : "ボスからは にげられない"}
              className="btn8 py-2 text-[12px] disabled:opacity-40"
            >
              💨 にげる
            </button>
          </div>
        </div>
      ) : v.phase === "EXPLORE" ? (
        // 操作パッド。いちばん押す「すすむ」を横幅いっぱいの太いバーに、回転は両脇の曲がり矢印。
        // 後退と出口は 2 段目に小さく、出口は確認を挟む（潜行が終わる危険ボタン）
        <div className="space-y-2 select-none [touch-action:manipulation]">
          <div className="grid grid-cols-[auto_1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => turn(-1)}
              disabled={busy}
              aria-label="左を向く"
              className="btn8 grid h-14 w-[72px] place-items-center p-0 tracking-normal disabled:opacity-50 sm:w-24"
            >
              <span className="flex flex-col items-center gap-0.5 leading-none">
                <TurnIcon dir="left" />
                <span className="font-pixel text-[9px]">左</span>
              </span>
            </button>
            <button
              type="button"
              onClick={forwardClick}
              onPointerDown={holdStart}
              onPointerUp={holdStop}
              onPointerLeave={holdStop}
              onPointerCancel={holdStop}
              onContextMenu={(e) => e.preventDefault()}
              disabled={busy}
              aria-label="進む"
              title="長押しで歩きつづける"
              className="btn8 btn8-start flex h-14 items-center justify-center gap-2 p-0 text-[14px] tracking-normal disabled:opacity-50"
            >
              <TriIcon dir="up" size={18} />
              <span>すすむ</span>
            </button>
            <button
              type="button"
              onClick={() => turn(1)}
              disabled={busy}
              aria-label="右を向く"
              className="btn8 grid h-14 w-[72px] place-items-center p-0 tracking-normal disabled:opacity-50 sm:w-24"
            >
              <span className="flex flex-col items-center gap-0.5 leading-none">
                <TurnIcon dir="right" />
                <span className="font-pixel text-[9px]">右</span>
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={busy}
              aria-label="後ろへ下がる"
              className="btn8 flex h-10 items-center gap-1.5 px-3 text-[11.5px] tracking-normal opacity-80 disabled:opacity-40"
            >
              <TriIcon dir="down" size={12} />
              もどる
            </button>
            <span className="hidden flex-1 text-center text-[11px] text-inksoft sm:block">
              矢印キー / WASD でも歩ける。すすむ長押しで歩きつづける。
            </span>
            {leaveConfirm ? (
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold">
                ここで帰る？
                <button
                  type="button"
                  onClick={() => choose("leave")}
                  disabled={busy}
                  className="btn8 h-10 px-3 text-[11.5px] tracking-normal disabled:opacity-50"
                  style={{ borderColor: "var(--pink-hot)" }}
                >
                  🚪 帰る
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveConfirm(false)}
                  className="btn8 h-10 px-3 text-[11.5px] tracking-normal"
                >
                  やめる
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setLeaveConfirm(true)}
                disabled={busy}
                title="戦利品を持って地上へ戻る"
                className="btn8 h-10 px-3 text-[11.5px] tracking-normal disabled:opacity-50"
              >
                🚪 出口
              </button>
            )}
          </div>
        </div>
      ) : v.phase === "CHOICE" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <button onClick={() => choose("descend")} disabled={busy} className="btn8 btn8-start py-2 text-[12.5px] disabled:opacity-50">
            ▼ 降りる
            <span className="ml-1 font-pixel text-[9px] text-white/80">地下{v.depth + 2}階</span>
          </button>
          <button onClick={() => choose("stay")} disabled={busy} className="btn8 py-2 text-[12.5px] disabled:opacity-50">
            まだ探索する
          </button>
          <button onClick={() => choose("leave")} disabled={busy} className="btn8 py-2 text-[12.5px] disabled:opacity-50">
            🚪 ここで帰る
          </button>
        </div>
      ) : v.phase === "END" ? (
        <div className="space-y-2">
          <div className="rounded-lg border-[2.5px] border-line8 bg-surface px-3 py-2.5">
            <p className="font-pixel text-[12px] tracking-wide text-pinkhot">
              {v.ending === "cleared"
                ? "★ ボスを たおした！"
                : v.ending === "defeated"
                  ? "…ちからつきた"
                  : v.ending === "escaped"
                    ? "ぶじに もどってきた"
                    : "ここまでで 時間ぎれ"}
            </p>
            <p className="mt-1 text-[12.5px]">
              地下{v.depth}階まで 到達（出発 地下{v.baseDepth}階）
            </p>
            {v.loot.gadgets.length + v.loot.foods.length > 0 ? (
              <p className="mt-1 text-[12.5px]">
                戦利品: <b>{[...v.loot.gadgets, ...v.loot.foods].join("・")}</b>
              </p>
            ) : (
              <p className="mt-1 text-[12.5px] text-inksoft">戦利品はなかった。</p>
            )}
            {v.ending === "defeated" && (
              <p className="mt-1 text-[11.5px] text-inksoft">
                力尽きても、拾ったものは持って帰れます。
              </p>
            )}
          </div>
          <a href="/dungeon" className="btn8 block w-full py-2 text-center text-[12.5px]">
            とじる
          </a>
        </div>
      ) : (
        <button onClick={next} disabled={busy} className="btn8 btn8-start w-full py-2 text-[12.5px] disabled:opacity-50">
          ▶ つぎへ
        </button>
      )}

      {error && (
        <p className="rounded-lg border-2 border-pinkhot bg-quotebg px-3 py-2 text-[12.5px] font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
