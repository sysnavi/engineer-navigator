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
import { SendingOverlay } from "@/components/sending-overlay";
import { PROBE_RECOMMENDED_FROM, skillLevelDef } from "@/lib/skill-levels";

export type SuggestionData = {
  id: string;
  kindLabel: string;
  skillName: string;
  suggestedLevel: number | null;
  reason: string;
  evidenceQuote: string | null;
  // 保存済みの深掘りログ（判定後に承認せず離脱した場合の復元用）
  probe?: { judgedLevel?: number; rationale?: string } | null;
};

type Judged = { level: number; label: string; rationale: string };

export function SuggestionCard(props: {
  suggestion: SuggestionData;
  aiEnabled: boolean; // ANTHROPIC_API_KEY 未設定環境では深掘りを出さず仮判定のみ
}) {
  const s = props.suggestion;
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [judged, setJudged] = useState<Judged | null>(
    s.probe?.judgedLevel != null
      ? {
          level: s.probe.judgedLevel,
          label: skillLevelDef(s.probe.judgedLevel).label,
          rationale: s.probe.rationale ?? "",
        }
      : null
  );
  // AI待ち（数秒）だけ宇宙人オーバーレイを出す。承認/却下は一瞬なので出さない（Issue #7の塩梅ルール）
  const [aiWait, setAiWait] = useState<null | "probe" | "judge">(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const probeRecommended =
    s.suggestedLevel != null && s.suggestedLevel >= PROBE_RECOMMENDED_FROM;

  // setAiWait は start() の外で呼ぶ。非同期トランジション内の更新は完了まで
  // 描画が遅延され、待ち時間中にオーバーレイが出ないため（React 19）。
  const startProbe = () => {
    setAiWait("probe");
    start(async () => {
      try {
        const r = await generateSkillProbe(s.id);
        setQuestions(r.questions);
        setAnswers(r.questions.map(() => ""));
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "深掘りを開始できませんでした");
      } finally {
        setAiWait(null);
      }
    });
  };

  const judge = () => {
    setAiWait("judge");
    start(async () => {
      try {
        const r = await submitSkillProbe(s.id, answers);
        setJudged(r);
      } catch (e) {
        notify("error", e instanceof Error ? e.message : "判定に失敗しました");
      } finally {
        setAiWait(null);
      }
    });
  };

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
      <SendingOverlay
        show={aiWait !== null}
        label={aiWait === "judge" ? "判定中" : "質問づくり中"}
        sub={
          aiWait === "judge"
            ? "回答をルーブリックに照らしています"
            : `${s.skillName} の経験を確かめる質問を考えています`
        }
      />
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
          {/* 判定後は「当初の提案」と明示する。そうしないと確定Lvの真下に
              旧Lvの根拠が残り、矛盾した2つの主張が並んで見える。 */}
          <p className={`text-[13px] text-inksoft ${judged ? "opacity-60" : ""}`}>
            {judged && <span className="font-bold">当初の提案: </span>}
            {s.reason}
          </p>
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
