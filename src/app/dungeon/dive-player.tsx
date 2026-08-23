"use client";

// コマンド選択制ダンジョン（松）のUI。
//
// 【前の問題】フルオートの紙芝居が毎秒42文字で流れ、13.8秒で終わっていた。
// 読む間もなく、選択も無く、半分は手ぶらで帰る体験だった。
//
// 【この画面の原則】
//  - **待つ**。メッセージは1つずつ出して、必ずクリックで進める。勝手に進まない。
//  - **見せる**。HP/SP/敵HPを常に出す。判断に必要な情報を隠さない。
//  - **選ばせる**。戦闘はコマンド、階層移動は深さの選択。結果は自分の判断のもの。

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PixelAvatar } from "@/components/pixel-avatar";
import type { BattleLog } from "@/lib/dungeon/battle";
import { startDive, act, type DiveView } from "./session-actions";
import type { BattleCommand } from "@/lib/dungeon/battle";
import type { Choice } from "@/lib/dungeon/session";

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

function fxSound(fx: BattleLog["fx"]) {
  if (fx === "crit") seCrit();
  else if (fx === "hit") seHit();
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
    setView(v);
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
  const next = () => send(() => act(view!.runId, { type: "next" }));
  const choose = (choice: Choice) => send(() => act(view!.runId, { type: "choice", choice }));

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
                  コマンドを選んで戦います。HPは潜行のあいだ持ち越し。
                  深く潜るほど強い相手が出ますが、宝も増えます。
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

      {/* 舞台 */}
      <div className="relative flex min-h-[128px] items-end justify-between rounded-lg border-2 border-line8 bg-quotebg px-4 py-3">
        <span className="block">
          <PixelAvatar sprite={props.avatarSprite} px={5} accent={props.avatarAccent} />
        </span>
        {v.foe && (
          <span className="flex flex-col items-center gap-1">
            <span className="font-pixel text-[10px] tracking-wide text-pinkhot">
              {v.foe.name}
              {v.foe.charging && <span className="ml-1 text-lemon">…ためている！</span>}
            </span>
            <span className="h-2 w-[92px] rounded-sm border-2 border-line8 bg-surface">
              <span
                className="block h-full bg-pinkhot transition-[width] duration-300"
                style={{ width: `${(v.foe.hp / v.foe.maxHp) * 100}%` }}
              />
            </span>
            <Image
              src={`/dungeon/${v.foe.sprite}.png`}
              alt=""
              width={v.foe.boss ? 84 : 60}
              height={v.foe.boss ? 84 : 60}
              style={{ imageRendering: "pixelated" }}
              unoptimized
            />
          </span>
        )}
      </div>

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
      ) : v.phase === "BATTLE" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button onClick={() => battle("attack")} disabled={busy} className="btn8 btn8-start py-2 text-[12.5px] disabled:opacity-50">
            ⚔ たたかう
          </button>
          <button onClick={() => battle("guard")} disabled={busy} className="btn8 py-2 text-[12.5px] disabled:opacity-50">
            🛡 まもる
          </button>
          <button
            onClick={() => battle("special")}
            disabled={busy || v.sp < 3}
            title={v.sp < 3 ? "SPが たりない" : "SPを3つかう"}
            className="btn8 btn8-ok py-2 text-[12.5px] disabled:opacity-40"
          >
            ✦ ひっさつ
          </button>
          <button
            onClick={() => battle("item")}
            disabled={busy || v.items.length === 0}
            className="btn8 py-2 text-[12.5px] disabled:opacity-40"
          >
            🍙 どうぐ{v.items.length > 0 && `(${v.items.length})`}
          </button>
          {v.charms > 0 && (
            <button
              onClick={() => battle("charm")}
              disabled={busy}
              title="AIメンターに相談した日だけ持てる。HPが全快する"
              className="btn8 py-2 text-[12.5px] disabled:opacity-40"
              style={{ borderColor: "var(--lemon)" }}
            >
              ✨ おふだ({v.charms})
            </button>
          )}
          <button
            onClick={() => battle("flee")}
            disabled={busy || !v.canFlee}
            title={v.canFlee ? "" : "ボスからは にげられない"}
            className="btn8 py-2 text-[12.5px] disabled:opacity-40"
          >
            💨 にげる
          </button>
        </div>
      ) : v.phase === "CHOICE" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <button onClick={() => choose("deep")} disabled={busy} className="btn8 btn8-start py-2 text-[12.5px] disabled:opacity-50">
            ▼▼ 深く潜る
            <span className="ml-1 font-pixel text-[9px] text-white/80">+2階</span>
          </button>
          <button onClick={() => choose("careful")} disabled={busy} className="btn8 py-2 text-[12.5px] disabled:opacity-50">
            ▼ 慎重に進む
            <span className="ml-1 font-pixel text-[9px] text-inksoft">+1階</span>
          </button>
          <button onClick={() => choose("leave")} disabled={busy} className="btn8 py-2 text-[12.5px] disabled:opacity-50">
            ▲ 引き返す
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
