"use client";

// 継承（転生）パネル: 2段階確認 → 転生実行 → 8bit孵化演出（Issue #1）。
// 取り返しがつかない操作なので、モーダルで「残るもの/戻るもの」を明示して
// チェックボックス + 最終ボタンの2段階を踏む。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rebirthAvatar } from "@/app/actions";
import { PixelAvatar } from "@/components/pixel-avatar";
import type { RebirthResult } from "@/lib/exp";

type Phase = "closed" | "confirm" | "hatching" | "born";

export function InheritPanel(props: {
  canRebirth: boolean;
  level: number;
  minLevel: number;
  generation: number;
  stageName: string;
  bequestPreview: number; // 転生した場合に次世代へ渡る初期EXP
}) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState<RebirthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const doRebirth = () => {
    startTransition(async () => {
      try {
        setError(null);
        const r = await rebirthAvatar();
        setResult(r);
        setPhase("hatching");
        // 孵化演出: 卵が揺れて割れるまで待ってから結果を見せる
        setTimeout(() => setPhase("born"), 2200);
      } catch (e) {
        setError(e instanceof Error ? e.message : "転生に失敗しました");
      }
    });
  };

  const close = () => {
    setPhase("closed");
    setAgreed(false);
    router.refresh();
  };

  return (
    <div>
      <button
        className="btn8 btn8-start text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!props.canRebirth}
        onClick={() => setPhase("confirm")}
      >
        ▶ 卵を産む（転生）
      </button>
      {!props.canRebirth && (
        <p className="mt-1.5 text-[11.5px] text-inksoft">
          🔒 マイスター（Lv{props.minLevel}）に到達すると解放されます（いま Lv
          {props.level}）
        </p>
      )}

      {phase !== "closed" && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(18,35,95,0.55)] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border-[2.5px] border-line8 bg-win shadow-hard">
            <div className="flex items-center justify-between bg-ink px-3 py-1.5 font-pixel text-[10.5px] tracking-[0.12em] text-white">
              <span>INHERIT.sys</span>
              <span aria-hidden="true">▮▮▮</span>
            </div>

            {phase === "confirm" && (
              <div className="space-y-3 p-5">
                <p className="font-pixel text-[14px] tracking-wide text-royal">
                  第{props.generation}世代を終えて、卵を産みますか？
                </p>
                <div className="rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed">
                  <p className="font-bold text-[var(--good)]">✓ 残るもの</p>
                  <p className="text-inksoft">
                    週報・スキル・経歴書・作問・投稿など、積み上げた記録と生涯EXPのすべて。
                    さらに今世代の実績から<b>遺伝子</b>が決まり、
                    <b>遺産 約{props.bequestPreview} EXP</b> を新世代が受け継ぎます。
                  </p>
                  <p className="mt-2 font-bold text-pinkhot">▼ 卵に戻るもの</p>
                  <p className="text-inksoft">
                    アバターのレベルと姿（Lv{props.level}・{props.stageName} →
                    Lv1・たまご）。この操作は取り消せません。
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[12.5px] font-bold">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="h-4 w-4 accent-[var(--pink-hot)]"
                  />
                  内容を理解しました（元に戻せないことに同意）
                </label>
                {error && (
                  <p className="text-[12px] font-bold text-[var(--crit)]">{error}</p>
                )}
                <div className="flex gap-2.5">
                  <button
                    className="btn8 btn8-start flex-1 text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!agreed || pending}
                    onClick={doRebirth}
                  >
                    {pending ? "…" : "▶ 卵を産む"}
                  </button>
                  <button className="btn8 text-[12px]" onClick={close} disabled={pending}>
                    やめる
                  </button>
                </div>
              </div>
            )}

            {phase === "hatching" && (
              <div className="grid place-items-center gap-3 p-8">
                <div className="hatch-egg">
                  <PixelAvatar sprite="egg" px={9} />
                </div>
                <p className="font-pixel text-[12px] tracking-[0.14em] text-royal">
                  いのちを つないでいます…
                </p>
              </div>
            )}

            {phase === "born" && result && (
              <div className="space-y-3 p-5 text-center">
                <p className="font-pixel text-[13px] tracking-[0.14em] text-pinkhot">
                  ★ A NEW LIFE IS BORN! ★
                </p>
                <div className="hatch-born mx-auto w-fit">
                  <PixelAvatar
                    sprite={result.newSprite}
                    px={9}
                    accent={result.dominant.color}
                  />
                </div>
                <p className="font-pixel text-[14px] tracking-wide text-royal">
                  第{result.newGen}世代 — {result.newStageName}
                </p>
                {result.newLevel > 1 && (
                  <p className="font-pixel text-[10.5px] tracking-wide text-[var(--good)]">
                    遺産のちからで Lv{result.newLevel} からスタート！
                  </p>
                )}
                <div className="space-y-1 text-[12.5px]">
                  <p>
                    遺伝子:{" "}
                    <b style={{ color: result.dominant.color }}>
                      {result.dominant.name}
                    </b>
                    （優性）
                    {result.recessive && (
                      <>
                        {" "}
                        ×{" "}
                        <b style={{ color: result.recessive.color }}>
                          {result.recessive.name}
                        </b>
                        （劣性）
                      </>
                    )}
                  </p>
                  <p>
                    称号: <b>{result.title}</b>
                  </p>
                  <p className="text-inksoft">
                    先代（Lv{result.levelAtEnd}・{result.stageAtEnd}）の遺産{" "}
                    <b className="text-[var(--good)]">+{result.bequest} EXP</b>{" "}
                    を受け継ぎました
                  </p>
                </div>
                <button className="btn8 btn8-start w-full text-[12px]" onClick={close}>
                  ▶ 新しい世代をはじめる
                </button>
              </div>
            )}
          </div>

          {/* 8bit孵化アニメーション（この画面でしか使わないのでローカル定義） */}
          <style>{`
            .hatch-egg { animation: hatch-shake 0.45s steps(2, end) infinite; }
            @keyframes hatch-shake {
              0% { transform: translateX(-3px) rotate(-4deg); }
              50% { transform: translateX(3px) rotate(4deg); }
              100% { transform: translateX(-3px) rotate(-4deg); }
            }
            .hatch-born { animation: hatch-pop 0.5s steps(4, end); }
            @keyframes hatch-pop {
              0% { transform: scale(0.4); filter: brightness(3); }
              100% { transform: scale(1); filter: brightness(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
