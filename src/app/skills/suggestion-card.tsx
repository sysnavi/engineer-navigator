"use client";

// AIスキル提案の承認カード（Issue #25）。
// 「深掘りして承認（検証済み）」と「そのまま承認（仮判定）」の2経路を提供する。
// Lv6以上（本番経験〜）は申告だけで判断するのは早計なので深掘りを推奨表示。
// AI未設定/停止環境ではエラーをトーストで受け、仮判定承認だけで運用できる。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideSuggestion } from "@/app/actions";
import { generateSkillProbe, submitSkillProbe } from "./actions";
import { notify } from "@/components/toast";
import { PROBE_RECOMMENDED_FROM, skillLevelDef } from "@/lib/skill-levels";

export type SuggestionData = {
  id: string;
  kindLabel: string;
  skillName: string;
  suggestedLevel: number | null;
  reason: string;
  evidenceQuote: string | null;
};

type Judged = { level: number; label: string; rationale: string };

export function SuggestionCard(props: {
  suggestion: SuggestionData;
  aiEnabled: boolean; // ANTHROPIC_API_KEY 未設定環境では深掘りを出さず仮判定のみ
}) {
  const s = props.suggestion;
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [judged, setJudged] = useState<Judged | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const probeRecommended =
    s.suggestedLevel != null && s.suggestedLevel >= PROBE_RECOMMENDED_FROM;

  const startProbe = () =>
    start(async () => {
      try {
        const r = await generateSkillProbe(s.id);
        setQuestions(r.questions);
        setAnswers(r.questions.map(() => ""));
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "深掘りを開始できませんでした");
      }
    });

  const judge = () =>
    start(async () => {
      try {
        const r = await submitSkillProbe(s.id, answers);
        setJudged(r);
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "判定に失敗しました");
      }
    });

  const decide = (approve: boolean, message: string) =>
    start(async () => {
      try {
        await decideSuggestion(s.id, approve);
        notify("ok", message);
        router.refresh();
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "処理に失敗しました");
      }
    });

  return (
    <div className="rounded-lg border-2 border-line8 bg-surface p-4 shadow-hard-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px] flex-1 space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-[14px] font-extrabold">
            <span className="badge8">{s.kindLabel}</span>
            {s.skillName}
            {s.suggestedLevel != null && (
              <span className="text-royal2">
                → Lv{judged?.level ?? s.suggestedLevel}
                「{judged?.label ?? skillLevelDef(s.suggestedLevel).label}」
              </span>
            )}
          </p>
          <p className="text-[13px] text-inksoft">{s.reason}</p>
          {s.evidenceQuote && <p className="quote8">週報より:「{s.evidenceQuote}」</p>}

          {/* 深掘りQ&A */}
          {questions && !judged && (
            <div className="space-y-2.5 rounded-lg border-2 border-dashed border-peri bg-win p-3">
              <p className="font-pixel text-[11px] tracking-wide text-royal">
                🔍 深掘りインタビュー — 具体的に教えてください
              </p>
              {questions.map((q, i) => (
                <div key={i}>
                  <p className="text-[12.5px] font-bold">{q}</p>
                  <textarea
                    value={answers[i] ?? ""}
                    onChange={(e) =>
                      setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    rows={2}
                    maxLength={600}
                    className="field8 mt-1 w-full text-[12.5px]"
                    placeholder="手順・ツール・担当範囲など具体的に"
                  />
                </div>
              ))}
              <button
                onClick={judge}
                disabled={pending || answers.some((a) => !a.trim())}
                className="btn8 btn8-start px-4 py-1.5 text-[12px] disabled:opacity-50"
              >
                {pending ? "判定中…" : "▶ 回答してレベル判定"}
              </button>
            </div>
          )}
          {judged && (
            <div className="rounded-lg border-2 border-dashed border-peri bg-win p-3">
              <p className="font-pixel text-[12px] tracking-wide text-[var(--good)]">
                ✓ 判定: Lv{judged.level}「{judged.label}」
              </p>
              <p className="mt-1 text-[12.5px]">{judged.rationale}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2">
          {judged ? (
            <button
              onClick={() => decide(true, `${s.skillName} を検証済みで登録しました`)}
              disabled={pending}
              className="btn8 btn8-ok px-4 py-2 text-[12px]"
            >
              ◯ この内容で承認
            </button>
          ) : (
            <>
              {!questions && props.aiEnabled && (
                <button
                  onClick={startProbe}
                  disabled={pending}
                  className={`px-4 py-2 text-[12px] btn8 ${probeRecommended ? "btn8-ok" : ""}`}
                >
                  {pending ? "…" : "🔍 深掘りして承認"}
                </button>
              )}
              <button
                onClick={() => decide(true, `${s.skillName} を仮判定で登録しました`)}
                disabled={pending}
                className="btn8 px-4 py-2 text-[12px]"
              >
                ◯ しょうにん（仮判定）
              </button>
            </>
          )}
          <button
            onClick={() => decide(false, "提案を見送りました")}
            disabled={pending}
            className="btn8 px-4 py-2 text-[12px]"
          >
            × きゃっか
          </button>
          {probeRecommended && !judged && props.aiEnabled && (
            <p className="max-w-[160px] text-[10.5px] leading-relaxed text-inksoft">
              ⚠ Lv{PROBE_RECOMMENDED_FROM}以上は深掘りでの検証がおすすめです
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
