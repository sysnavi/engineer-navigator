"use client";

// 5ステップ紙芝居プレイヤー（Issue #3）。
// サーバーで確定済みの steps を1コマずつ表示するだけ（結果はもう決まっている）。
// 1コマ約2.4秒・スキップ可。8bitのDUNGEON.logにテキストが積もっていく。

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { dive } from "./actions";
import { PixelAvatar } from "@/components/pixel-avatar";
import type { DungeonStep } from "@/lib/dungeon/run";

const STEP_MS = 2400;

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
  const [idx, setIdx] = useState(0);
  const [replay, setReplay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const playing = steps !== null;
  const finished = playing && idx >= steps.length - 1;

  useEffect(() => {
    if (!playing || finished) return;
    timer.current = setTimeout(() => setIdx((i) => i + 1), STEP_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, finished, idx]);

  const start = () => {
    startTransition(async () => {
      try {
        setError(null);
        const r = await dive();
        setReplay(false);
        setSteps(r.steps);
        setIdx(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "潜行に失敗しました");
      }
    });
  };

  const startReplay = () => {
    if (!props.lastRunSteps) return;
    setReplay(true);
    setSteps(props.lastRunSteps);
    setIdx(0);
  };

  const close = () => {
    setSteps(null);
    setIdx(0);
    if (!replay) router.refresh();
  };

  // --- 待機画面 ---
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
              直近のログを再生
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- 紙芝居 ---
  const step = steps[idx];
  const isResult = step.kind === "RESULT";
  return (
    <div>
      {/* 進行ドット + 深度 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <i
              key={i}
              className={`h-3 w-3 rounded-[3px] border-2 border-line8 ${
                i < idx ? "bg-lemon" : i === idx ? "bg-pinkhot" : "bg-win"
              }`}
            />
          ))}
        </div>
        <span className="font-pixel text-[13px] tracking-wide text-royal">
          地下{step.depthAfter}階
        </span>
      </div>

      {/* 現在のコマ */}
      <div className="mt-3 flex items-start gap-4">
        <div className="grid h-[92px] w-[92px] shrink-0 place-items-center rounded-lg border-[2.5px] border-line8 bg-surface">
          {step.sprite ? (
            <Image
              src={`/dungeon/${step.sprite}.png`}
              alt=""
              width={72}
              height={72}
              style={{ imageRendering: "pixelated" }}
              unoptimized
            />
          ) : (
            <PixelAvatar sprite={props.avatarSprite} px={6} accent={props.avatarAccent} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`font-pixel text-[13.5px] tracking-wide ${
              step.outcome === "fail"
                ? "text-[var(--crit)]"
                : isResult
                  ? "text-pinkhot"
                  : "text-royal"
            }`}
          >
            {isResult ? `★ ${step.title} ★` : step.title}
          </p>
          <div className="mt-1.5 space-y-1">
            {step.lines.map((line, i) => (
              <p key={i} className="text-[12.5px] leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* これまでのログ（積もっていく） */}
      {idx > 0 && (
        <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2">
          {steps.slice(0, idx).map((s, i) => (
            <p key={i} className="font-pixel text-[10.5px] leading-relaxed text-inksoft">
              ▸ {s.title} {s.outcome === "fail" ? "✗" : s.outcome === "success" ? "○" : ""}
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2.5">
        {!finished ? (
          <button
            className="btn8 px-4 py-1.5 text-[11.5px]"
            onClick={() => setIdx(steps.length - 1)}
          >
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
