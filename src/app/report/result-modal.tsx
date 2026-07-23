"use client";

import Link from "next/link";
import type { SubmitReportResult } from "@/app/actions";

// 提出後のリザルト画面（RPGのリザルト風モーダル）。
// 従来は画面上部のバナーが差し替わるだけで提出の手応えが薄かったため、
// フィードバック・獲得EXP・スキル提案数をセレモニーとして真ん中に出す。
// バナー（page.tsx の QUEST CLEAR）は再訪時の記録として残す。

function Trophy() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path
        d="M4 1h8v1h1v4h-1v1h-1v1h-1v1h-1v2h1v1h1v1H5v-1h1v-1h1v-2H6V8H5V7H4V6H3V2h1z"
        fill="#FFD84D"
        stroke="#12235F"
        strokeWidth=".5"
      />
      <rect x="7" y="3" width="2" height="2" fill="#F24E9C" />
    </svg>
  );
}

export function ResultModal(props: {
  result: SubmitReportResult;
  onClose: () => void;
}) {
  const { result, onClose } = props;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="提出リザルト"
    >
      <div className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <div className="result8-pop relative w-full max-w-md overflow-hidden rounded-xl border-[3px] border-line8 bg-win shadow-hard">
        <div className="flex items-center gap-2 bg-royal px-3 py-2 font-pixel text-[12px] tracking-wide text-white">
          <span className="inline-flex gap-1.5" aria-hidden="true">
            <i className="h-2.5 w-2.5 rounded-full border-2 border-white bg-pinkhot" />
            <i className="h-2.5 w-2.5 rounded-full border-2 border-white bg-lemon" />
          </span>
          リザルト<span className="text-peri">.exe</span>
          <button
            onClick={onClose}
            className="ml-auto rounded border-2 border-white px-1.5 text-[10px] leading-tight"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
          <Trophy />
          <p className="font-pixel text-2xl tracking-wider text-pinkhot">
            QUEST CLEAR!
          </p>
          <p className="text-[13.5px] font-extrabold">今週の週報を提出しました</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {result.expGained > 0 && (
              <span className="badge8">+{result.expGained} EXP</span>
            )}
            {result.suggestionCount > 0 && (
              <span className="badge8">スキル提案 {result.suggestionCount}件</span>
            )}
          </div>

          {result.feedbackText ? (
            <div className="w-full rounded-lg border-2 border-dashed border-royal2 bg-quotebg p-3 text-left">
              <p className="font-pixel text-[11px] tracking-[0.1em] text-royal2">
                GROWTH POINT — 今週の成長ポイント
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed">
                {result.feedbackText}
              </p>
            </div>
          ) : (
            <p className="text-[12.5px] text-inksoft">
              {result.analysisFailed
                ? "AI解析は実行できませんでしたが、提出は完了しています。"
                : "フィードバックを準備中です。しばらくしてからこのページを開き直してください。"}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            {result.suggestionCount > 0 ? (
              <>
                <Link href="/skills" className="btn8 btn8-start text-[13px]">
                  ▶ スキル提案を見にいく
                </Link>
                <button onClick={onClose} className="btn8 text-[13px]">
                  閉じる
                </button>
              </>
            ) : (
              <button onClick={onClose} className="btn8 btn8-ok text-[13px]">
                OK
              </button>
            )}
          </div>
          {result.suggestionCount > 0 && (
            <p className="text-[11.5px] text-inksoft">
              AIが見つけたスキルは、あなたが承認して初めてスキルマップに反映されます
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
