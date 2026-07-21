"use client";

// ダンジョン探索リプレイ（Issue #3 松演出）。
// サーバーで確定済みの steps を「動くリプレイ」として上演する。
// - 結果はサーバー確定済み（run.ts）。ここは見た目だけ＝トークンゼロ・改ざん耐性そのまま
// - HPゲージ/ダメージ数字は演出用のフレーバー（ゲームロジックには存在しない）
// - スキップは即リザルトへ。reduced-motion はシェイク等を止め、待ち時間も短縮

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { dive } from "./actions";
import { PixelAvatar } from "@/components/pixel-avatar";
import { GADGETS } from "@/lib/dungeon/content";
import type { DungeonStep } from "@/lib/dungeon/run";

// ---------------------------------------------------------------------------
// SE（WebAudio・デフォルトOFF。切替はlocalStorageに記憶）
// ---------------------------------------------------------------------------
// ON/OFFはモジュールストア + useSyncExternalStore（effect内setStateを避ける）
let seOn = false;
let seLoaded = false;
const seListeners = new Set<() => void>();
function seSnapshot(): boolean {
  if (!seLoaded && typeof window !== "undefined") {
    seLoaded = true;
    seOn = localStorage.getItem("dungeon-se") === "1";
  }
  return seOn;
}
function seSubscribe(cb: () => void): () => void {
  seListeners.add(cb);
  return () => seListeners.delete(cb);
}
function seSet(v: boolean) {
  seOn = v;
  localStorage.setItem("dungeon-se", v ? "1" : "0");
  seListeners.forEach((l) => l());
}
let actx: AudioContext | null = null;
function blip(freq: number, dur = 0.07, type: OscillatorType = "square", vol = 0.04) {
  if (!seOn) return;
  try {
    actx ??= new AudioContext();
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
    // 音が出せない環境でも演出は続行
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
const seFanfare = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.12), i * 130));
const seStep = () => blip(70, 0.05, "triangle", 0.05);

// ---------------------------------------------------------------------------
// 演出ステート
// ---------------------------------------------------------------------------
type Foe = { sprite: string; px: number; cls: string };
type Obj = { sprite: string; cls: string };
type Pop = { id: number; text: string; cls: string; style: React.CSSProperties };
type Particle = { id: number; style: React.CSSProperties };

/** 深度→部屋の暗さ。ボス部屋は赤紫 */
function floorCss(depth: number, boss: boolean) {
  if (boss) {
    return { "--dg-wall-a": "#3a1330", "--dg-wall-b": "#200a20", "--dg-floor-a": "#4a2038", "--dg-floor-b": "#2c1226" };
  }
  const t = Math.min(Math.max(depth - 1, 0) / 11, 1);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return {
    "--dg-wall-a": `rgb(${mix(38, 14)},${mix(58, 22)},${mix(118, 58)})`,
    "--dg-wall-b": `rgb(${mix(25, 8)},${mix(38, 13)},${mix(84, 40)})`,
    "--dg-floor-a": `rgb(${mix(48, 20)},${mix(66, 30)},${mix(128, 70)})`,
    "--dg-floor-b": `rgb(${mix(31, 11)},${mix(46, 18)},${mix(98, 48)})`,
  };
}

export function DungeonPlayer(props: {
  canDive: boolean;
  diveKind: "daily" | "bonus" | null;
  restingMessage: string | null;
  avatarSprite: string;
  avatarAccent?: string;
  baseDepth: number;
  lastRunSteps: DungeonStep[] | null;
}) {
  const [steps, setSteps] = useState<DungeonStep[] | null>(null);
  const [replay, setReplay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // シーンの見た目ステート
  const [depth, setDepth] = useState(props.baseDepth);
  const [bossMode, setBossMode] = useState(false);
  const [bossName, setBossName] = useState<string | null>(null);
  const [heroCls, setHeroCls] = useState("dg-hero-idle");
  const [foe, setFoe] = useState<Foe | null>(null);
  const [foeHp, setFoeHp] = useState(100);
  const [foeName, setFoeName] = useState("");
  const [myHp, setMyHp] = useState(100);
  const [obj, setObj] = useState<Obj | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [parts, setParts] = useState<Particle[]>([]);
  const [loot, setLoot] = useState<string | null>(null);
  const [vign, setVign] = useState<"" | "red" | "gold">("");
  const [shaking, setShaking] = useState(false);
  const [blackout, setBlackout] = useState<string | null>(null);
  const [msgCur, setMsgCur] = useState("");
  const [msgOld, setMsgOld] = useState<string[]>([]);
  const [progIdx, setProgIdx] = useState(0);
  const [result, setResult] = useState<DungeonStep | null>(null);
  const [confetti, setConfetti] = useState<Particle[]>([]);
  const seState = useSyncExternalStore(seSubscribe, seSnapshot, () => false);

  const runIdRef = useRef(0);
  const skipRef = useRef(false);
  const sayTokenRef = useRef(0);
  const uid = useRef(0);
  const rmRef = useRef(false);

  useEffect(() => {
    rmRef.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const playing = steps !== null;

  // ---- 小道具 ----
  const sleep = (ms: number) =>
    new Promise<void>((r) => setTimeout(r, skipRef.current ? 0 : rmRef.current ? Math.min(ms, 350) : ms));

  const pop = (text: string, cls: string, left: string, top: string) => {
    if (skipRef.current) return;
    const id = ++uid.current;
    setPops((p) => [...p, { id, text, cls, style: { left, top } }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1400);
  };
  const burst = (left: string, top: string, color: string) => {
    if (skipRef.current || rmRef.current) return;
    const added: Particle[] = Array.from({ length: 10 }, (_, i) => ({
      id: ++uid.current,
      style: {
        left,
        top,
        background: color,
        ["--dx" as string]: `${Math.cos((i / 10) * 6.28) * (30 + (i % 3) * 14)}px`,
        ["--dy" as string]: `${Math.sin((i / 10) * 6.28) * (24 + (i % 4) * 12) - 20}px`,
      },
    }));
    setParts((p) => [...p, ...added]);
    setTimeout(() => setParts((p) => p.filter((x) => !added.includes(x))), 800);
  };
  const shake = () => {
    if (skipRef.current || rmRef.current) return;
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };
  const flashVign = (kind: "red" | "gold") => {
    if (skipRef.current) return;
    setVign(kind);
    setTimeout(() => setVign(""), 450);
  };

  /** メッセージ窓に1行タイプ表示（直前の行は小さく残す） */
  const say = async (text: string, runId: number) => {
    if (runId !== runIdRef.current) return;
    const token = ++sayTokenRef.current;
    // updater内でrefを読むと遅延実行時に次行のタイプ途中が入るため、先にキャプチャする
    const prev = msgCurRef.current;
    setMsgOld((old) => (prev ? [prev, ...old].slice(0, 2) : old));
    msgCurRef.current = "";
    setMsgCur("");
    if (skipRef.current || rmRef.current) {
      msgCurRef.current = text;
      setMsgCur(text);
      return;
    }
    for (const ch of text) {
      if (token !== sayTokenRef.current || runId !== runIdRef.current) return;
      msgCurRef.current += ch;
      setMsgCur(msgCurRef.current);
      await new Promise((r) => setTimeout(r, 24));
    }
  };
  const msgCurRef = useRef("");

  const stairs = async (to: number, dir: "down" | "up", boss: boolean, runId: number) => {
    seStep();
    setBlackout(dir === "down" ? `▼ B${to}F${boss ? "  …なにか いる" : ""}` : `▲ B${to}F  おしもどされた…`);
    await sleep(1000);
    if (runId !== runIdRef.current) return;
    setDepth(to);
    setBossMode(boss);
    setBlackout(null);
    seStep();
    await sleep(350);
  };

  // ---- 戦闘（勝ち/盾/負けを1関数で）----
  const battle = async (step: DungeonStep, isBoss: boolean, runId: number) => {
    const exchanges = isBoss ? 3 : 2;
    const win = step.outcome === "success";
    const shield = step.outcome === "avoid";
    let hp = 100;
    for (let i = 0; i < exchanges; i++) {
      if (runId !== runIdRef.current) return;
      await sleep(450);
      const lastAndWin = win && i === exchanges - 1;
      // こちらの攻撃（負け筋では最後の攻撃を外す）
      if (win || i < exchanges - 1) {
        setHeroCls("dg-dash-r");
        await sleep(190);
        setFoe((f) => f && { ...f, cls: "dg-foe-flash" });
        if (lastAndWin && isBoss) {
          seCrit();
          pop("CRITICAL!", "text-[26px] text-lemon", "52%", "24%");
          pop(`-${30 + i * 7}`, "text-[20px] text-white", "72%", "38%");
        } else {
          seHit();
          pop(`-${14 + i * 5}`, "text-[20px] text-white", "72%", "40%");
        }
        // とどめの一撃はゲージを必ず0に（残ったまま勝つと不自然）
        hp = lastAndWin ? 0 : hp - 32;
        setFoeHp(Math.max(0, hp));
        await sleep(320);
        setHeroCls("dg-hero-idle");
        setFoe((f) => f && { ...f, cls: "" });
        if (lastAndWin) break;
      }
      // 相手の攻撃
      await sleep(380);
      if (runId !== runIdRef.current) return;
      setFoe((f) => f && { ...f, cls: "dg-dash-l" });
      await sleep(190);
      setHeroCls("dg-hurt");
      seHurt();
      pop(`-${6 + i * 3}`, "text-[20px] text-[#ffb0b6]", "24%", "42%");
      setMyHp((h) => Math.max(4, h - (win ? 8 : 16)));
      shake();
      await sleep(320);
      setFoe((f) => f && { ...f, cls: "" });
      setHeroCls("dg-hero-idle");
    }
    if (runId !== runIdRef.current) return;
    await sleep(300);
    if (win) {
      setFoe((f) => f && { ...f, cls: "dg-foe-dying" });
      burst("74%", "50%", "#ffd84d");
      burst("70%", "44%", "#f24e9c");
      seCoin();
      await sleep(820);
      setFoe(null);
    } else if (shield) {
      // 週報の盾: 金の光で踏みとどまり、相手は去っていく
      flashVign("gold");
      seCoin();
      pop("週報の盾！", "text-[16px] text-lemon", "34%", "30%");
      await sleep(700);
      setFoe((f) => f && { ...f, cls: "dg-foe-flee" });
      await sleep(650);
      setFoe(null);
    } else {
      // 敗走: 追い返される
      setHeroCls("dg-hurt");
      seHurt();
      await sleep(600);
      setHeroCls("dg-hero-idle");
      setFoe(null);
    }
  };

  // ---- 上演本体 ----
  const perform = async (list: DungeonStep[], runId: number) => {
    let prevDepth = list[0]?.depthAfter ?? props.baseDepth;
    setDepth(prevDepth);
    setBossMode(false);
    setMyHp(100);
    setMsgOld([]);
    msgCurRef.current = "";
    setMsgCur("");
    setResult(null);
    setFoe(null);
    setObj(null);

    for (let i = 0; i < list.length; i++) {
      if (runId !== runIdRef.current) return;
      const step = list[i];
      setProgIdx(i);

      if (step.kind === "DEPART") {
        setHeroCls("dg-hero-walk");
        for (const line of step.lines) await say(line, runId);
        await sleep(1000);
        setHeroCls("dg-hero-idle");
        prevDepth = step.depthAfter;
        continue;
      }

      if (step.kind === "RESULT") {
        await say(step.title, runId);
        await sleep(500);
        if (runId !== runIdRef.current) return;
        showResult(step);
        return;
      }

      // イベント間の階段（深度が変わっていたら移動演出）— イベント解決後に反映するので
      // ここでは「イベント前の到達階」に合わせるだけ（DEPART直後は同階）
      if (step.kind === "ENCOUNTER" || step.kind === "BOSS") {
        const isBoss = step.kind === "BOSS";
        if (isBoss) {
          await stairs(prevDepth, "down", true, runId);
          setBossName(step.title.replace(/^ボス:\s*/, ""));
          shake();
        }
        setFoeName(step.title.replace(/^ボス:\s*/, ""));
        setFoeHp(100);
        setFoe({ sprite: step.sprite ?? "mon-minibug", px: isBoss ? 96 : 64, cls: "dg-foe-enter" });
        seHurt();
        await say(step.lines[0], runId);
        await battle(step, isBoss, runId);
        if (runId !== runIdRef.current) return;
        for (const line of step.lines.slice(1)) await say(line, runId);
        setBossName(null);
      } else if (step.kind === "TRAP") {
        setObj({ sprite: "icon-trap", cls: "" });
        await say("……いやな よかんが する。", runId);
        await sleep(550);
        if (step.outcome === "avoid") {
          setHeroCls("dg-hop");
          seCoin();
          pop("ひらり！", "text-[15px] text-lemon", "30%", "32%");
          await sleep(600);
          setHeroCls("dg-hero-idle");
        } else {
          setObj({ sprite: "icon-trap", cls: "dg-obj-spring" });
          shake();
          flashVign("red");
          setHeroCls("dg-hurt");
          seHurt();
          pop("-15", "text-[20px] text-[#ffb0b6]", "24%", "40%");
          setMyHp((h) => Math.max(4, h - 15));
          await sleep(600);
          setHeroCls("dg-hero-idle");
        }
        for (const line of step.lines) await say(line, runId);
        await sleep(600);
        setObj(null);
      } else if (step.kind === "REST") {
        setObj({ sprite: "icon-rest", cls: "dg-obj-glow" });
        pop("Zzz…", "dg-pop-zzz text-[16px] text-peri", "30%", "34%");
        seCoin();
        pop("+20", "text-[18px] text-[#8af0b0]", "24%", "38%");
        setMyHp((h) => Math.min(100, h + 20));
        for (const line of step.lines) await say(line, runId);
        await sleep(900);
        setObj(null);
      } else if (step.kind === "TREASURE") {
        setObj({ sprite: "icon-chest", cls: "dg-obj-bounce" });
        await say(step.lines[0], runId);
        await sleep(650);
        if (runId !== runIdRef.current) return;
        if (step.outcome === "success") {
          burst("76%", "56%", "#ffd84d");
          seCoin();
          if (step.gadgetId && !skipRef.current) {
            const name = GADGETS.find((g) => g.id === step.gadgetId)?.name ?? "なにか";
            setLoot(`🎁 ${name}`);
            setTimeout(() => setLoot(null), 1600);
          }
        } else {
          pop("……", "text-[18px] text-peri", "74%", "40%");
        }
        for (const line of step.lines.slice(1)) await say(line, runId);
        await sleep(700);
        setObj(null);
      }

      // 深度反映（勝ち=降りる / 負け=押し戻し）
      if (runId !== runIdRef.current) return;
      if (step.depthAfter > prevDepth) {
        await stairs(step.depthAfter, "down", false, runId);
      } else if (step.depthAfter < prevDepth) {
        await stairs(step.depthAfter, "up", false, runId);
      } else if (step.kind === "BOSS") {
        setBossMode(false);
      }
      prevDepth = step.depthAfter;
    }
  };

  const showResult = (step: DungeonStep) => {
    skipRef.current = false;
    setFoe(null);
    setObj(null);
    setBossName(null);
    setResult(step);
    seFanfare();
    if (!rmRef.current) {
      const colors = ["#ffd84d", "#f24e9c", "#2e9e5b", "#5dade2", "#ffffff"];
      for (let i = 0; i < 24; i++) {
        setTimeout(() => {
          const id = ++uid.current;
          const c: Particle = {
            id,
            style: {
              left: `${(i * 37 + 13) % 100}%`,
              background: colors[i % colors.length],
              animationDelay: `${(i % 5) * 0.08}s`,
            },
          };
          setConfetti((p) => [...p, c]);
          setTimeout(() => setConfetti((p) => p.filter((x) => x.id !== id)), 2200);
        }, i * 60);
      }
    }
  };

  // steps がセットされたら上演開始（closeで runId を進めて中断）
  useEffect(() => {
    if (!steps) return;
    const ref = runIdRef;
    const runId = ++ref.current;
    skipRef.current = false;
    void perform(steps, runId);
    return () => {
      // このrunを無効化（closeが先に進めていたら巻き戻さない）
      ref.current = Math.max(ref.current, runId + 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  const start = () => {
    startTransition(async () => {
      try {
        setError(null);
        const r = await dive();
        setReplay(false);
        setSteps(r.steps);
      } catch (e) {
        setError(e instanceof Error ? e.message : "潜行に失敗しました");
      }
    });
  };
  const startReplay = () => {
    if (!props.lastRunSteps) return;
    setReplay(true);
    setSteps([...props.lastRunSteps]);
  };
  const close = () => {
    runIdRef.current++;
    setSteps(null);
    setResult(null);
    if (!replay) router.refresh();
  };
  const skipAll = () => {
    if (!steps) return;
    skipRef.current = true;
    sayTokenRef.current++;
  };
  const toggleSe = () => {
    seSet(!seOn);
    if (seOn) seCoin();
  };

  // --- 待機画面（従来どおり）---
  if (!playing) {
    return (
      <div className="flex flex-wrap items-center gap-5">
        <div className="grid h-[92px] w-[92px] shrink-0 place-items-center rounded-lg border-[2.5px] border-line8 bg-surface">
          <PixelAvatar sprite={props.avatarSprite} px={7} accent={props.avatarAccent} />
        </div>
        <div className="min-w-[220px] flex-1">
          {props.canDive ? (
            <>
              <p className="font-pixel text-[13px] tracking-wide text-royal">
                じゅんびOK — 地下{props.baseDepth}階からスタート
              </p>
              <p className="mt-1 text-[12.5px] text-inksoft">
                フルオート探索。出発したら見守るだけ。イベント3つの結果で到達階が決まります。
              </p>
            </>
          ) : (
            <>
              <p className="font-pixel text-[13px] tracking-wide text-royal2">
                💤 {props.restingMessage}
              </p>
              <p className="mt-1 text-[12.5px] text-inksoft">
                探索は1日1回。週報を出した週は「もう一潜り」できます。また明日！
              </p>
            </>
          )}
          {error && (
            <p className="mt-1 text-[12px] font-bold text-[var(--crit)]">{error}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2">
          {props.canDive && (
            <button
              className="btn8 btn8-start px-5 py-2.5 text-[13px]"
              onClick={start}
              disabled={pending}
            >
              {pending
                ? "…"
                : props.diveKind === "bonus"
                  ? "▶ 週報ボーナスでもう一潜り"
                  : "▶ ダンジョンに潜る"}
            </button>
          )}
          {props.lastRunSteps && (
            <button className="btn8 px-5 py-2 text-[11.5px]" onClick={startReplay}>
              直近の探索をリプレイ
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- リプレイ画面 ---
  return (
    <div className="overflow-hidden rounded-lg border-[2.5px] border-line8">
      {/* シーン */}
      <div
        className={`dg-scene h-[210px] sm:h-[240px] ${shaking ? "dg-shake" : ""}`}
        style={floorCss(depth, bossMode) as React.CSSProperties}
      >
        <i className="dg-torch" style={{ left: "16%" }} aria-hidden="true" />
        <i className="dg-torch" style={{ left: "76%" }} aria-hidden="true" />

        {/* HPゲージ（演出用） */}
        <div className="absolute left-3 top-3 z-[6] w-[126px]">
          <p className="font-pixel text-[9px] tracking-wide text-white [text-shadow:1px_1px_0_#000]">アバター</p>
          <div className="h-[10px] overflow-hidden rounded-[3px] border-2 border-line8 bg-[#0b1234]">
            <div
              className="h-full bg-gradient-to-b from-[#9be8b8] to-[var(--good)] transition-[width] duration-300"
              style={{ width: `${myHp}%` }}
            />
          </div>
        </div>
        {foe && (
          <div className="absolute right-3 top-3 z-[6] w-[126px]">
            <p className="text-right font-pixel text-[9px] tracking-wide text-white [text-shadow:1px_1px_0_#000]">{foeName}</p>
            <div className="h-[10px] overflow-hidden rounded-[3px] border-2 border-line8 bg-[#0b1234]">
              <div
                className="h-full bg-gradient-to-b from-[#ff8a8f] to-[var(--crit)] transition-[width] duration-300"
                style={{ width: `${foeHp}%` }}
              />
            </div>
          </div>
        )}
        <span className="absolute right-3 bottom-2 z-[6] font-pixel text-[12px] tracking-wide text-lemon [text-shadow:1px_1px_0_#000]">
          B{depth}F
        </span>
        {bossName && (
          <p className="absolute left-1/2 top-8 z-[6] -translate-x-1/2 whitespace-nowrap font-pixel text-[12px] tracking-[0.2em] text-lemon [text-shadow:2px_2px_0_#000]">
            — {bossName} —
          </p>
        )}

        {/* 役者 */}
        <div className={`dg-actor left-[16%] ${heroCls.startsWith("dg-dash") ? heroCls : ""}`}>
          <span className={`block ${heroCls.startsWith("dg-dash") ? "" : heroCls}`}>
            <PixelAvatar sprite={props.avatarSprite} px={5} accent={props.avatarAccent} />
          </span>
        </div>
        {foe && (
          <div className={`dg-actor right-[14%] ${foe.cls === "dg-dash-l" ? "dg-dash-l" : ""}`}>
            <span className={`block ${foe.cls !== "dg-dash-l" ? foe.cls : ""}`}>
              <Image
                src={`/dungeon/${foe.sprite}.png`}
                alt=""
                width={foe.px}
                height={foe.px}
                style={{ imageRendering: "pixelated" }}
                unoptimized
              />
            </span>
          </div>
        )}
        {obj && (
          <div className={`dg-actor right-[20%] ${obj.cls}`}>
            <Image
              src={`/dungeon/${obj.sprite}.png`}
              alt=""
              width={56}
              height={56}
              style={{ imageRendering: "pixelated" }}
              unoptimized
            />
          </div>
        )}

        {/* エフェクト層 */}
        {pops.map((p) => (
          <span key={p.id} className={`dg-pop font-pixel ${p.cls}`} style={p.style}>
            {p.text}
          </span>
        ))}
        {parts.map((p) => (
          <i key={p.id} className="dg-particle" style={p.style} />
        ))}
        {loot && (
          <span className="dg-loot rounded-lg border-2 border-line8 bg-win px-2.5 py-1 font-pixel text-[11px] text-ink shadow-hard-sm">
            {loot}
          </span>
        )}
        <div className={`dg-vignette ${vign === "red" ? "dg-vignette-red" : "dg-vignette-gold"} ${vign ? "dg-vignette-on" : ""}`} />
        <div className={`dg-blackout ${blackout ? "dg-blackout-on" : ""}`}>
          {blackout && (
            <p className="font-pixel text-[20px] tracking-[0.25em] text-lemon [text-shadow:3px_3px_0_#000]">
              {blackout}
            </p>
          )}
        </div>

        {/* リザルト */}
        {result && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[rgba(5,9,31,0.92)] text-center">
            {confetti.map((c) => (
              <i key={c.id} className="dg-confetti" style={c.style} />
            ))}
            <div className="px-4 font-pixel text-white">
              <p className="text-[15px] tracking-[0.25em] text-lemon [text-shadow:2px_2px_0_#000]">★ 探索結果 ★</p>
              <p className="mt-2 text-[26px] tracking-wide">
                とうたつ <b className="text-[32px] text-pinkhot">地下{result.depthAfter}階</b>
              </p>
              <div className="mt-2 space-y-1 text-[11px] leading-relaxed tracking-wide text-peri">
                {result.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* メッセージ窓 */}
      <div className="min-h-[76px] border-t-[2.5px] border-line8 bg-[#0d1638] px-3.5 py-2 font-pixel text-[12px] leading-relaxed tracking-wide text-white">
        <p className={result ? "" : "dg-msg-cursor"}>{msgCur}</p>
        {msgOld.map((line, i) => (
          <p key={i} className="text-[10.5px] text-[#7f92c9]">
            {line}
          </p>
        ))}
      </div>

      {/* コントロール */}
      <div className="flex flex-wrap items-center gap-2.5 border-t-2 border-dashed border-peri bg-win px-3 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <i
              key={i}
              className={`h-3 w-3 rounded-[3px] border-2 border-line8 ${
                result ? "bg-lemon" : i < progIdx ? "bg-lemon" : i === progIdx ? "bg-pinkhot" : "bg-win"
              }`}
            />
          ))}
        </span>
        <span className="flex-1" />
        <button className="btn8 px-3 py-1.5 text-[11px]" onClick={toggleSe} aria-pressed={seState}>
          {seState ? "🔊 SE" : "🔇 SE"}
        </button>
        {!result ? (
          <button className="btn8 px-4 py-1.5 text-[11.5px]" onClick={skipAll}>
            ▶▶ スキップ
          </button>
        ) : (
          <button className="btn8 btn8-start px-5 py-2 text-[12.5px]" onClick={close}>
            ▶ とじる
          </button>
        )}
      </div>
    </div>
  );
}
