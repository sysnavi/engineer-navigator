import { getConditionSeries } from "@/lib/condition";
import { Window, PixelLabel } from "@/components/retro";

// セルフケアログ（Issue #16）。コンディションの推移を **本人だけ** が振り返るビュー。
// 個人サービス化に伴い、運営/営業へのアラートは廃止。ここは見守りではなく、
// 自分で自分の調子に気づくための鏡。判定は出さず、事実（推移）と優しい一言だけ。

const COND_FACE: Record<number, { emoji: string; label: string }> = {
  4: { emoji: "☀️", label: "good" },
  3: { emoji: "🌤", label: "ok" },
  2: { emoji: "☁️", label: "low" },
  1: { emoji: "🌧", label: "hard" },
};
const LOAD_LABEL: Record<number, string> = {
  4: "余裕",
  3: "ふつう",
  2: "多め",
  1: "限界ちかい",
};

export async function SelfCareLog({ userId }: { userId: string }) {
  const series = await getConditionSeries(userId, 8);
  const withCond = series.filter((w) => w.workloadSelf != null || w.selfNorm != null);
  // 2週分そろって初めて「推移」になる
  if (withCond.length < 2) return null;

  // 直近の落ち込み/高負荷が続いていたら、本人向けにそっと言葉を添える（アラートではない）
  const recent = withCond.slice(-3);
  const lowStreak = recent.length >= 2 && recent.every((w) => (w.selfNorm ?? 100) <= 40);
  const loadStreak =
    recent.length >= 2 && recent.every((w) => (w.workloadSelf ?? 4) <= 1);

  return (
    <Window title="SELF-CARE" titleEm=".log">
      <PixelLabel>セルフケアログ — あなただけの記録</PixelLabel>
      <p className="mt-1.5 text-[12px] text-inksoft">
        コンディションの移りかわり。運営を含め、これはあなた以外には見えません。
      </p>

      <div className="mt-3 flex flex-wrap gap-2.5">
        {withCond.map((w) => {
          const c =
            w.selfNorm != null
              ? COND_FACE[Math.round(w.selfNorm / (100 / 3)) + 1] ?? COND_FACE[2]
              : null;
          return (
            <div
              key={w.weekStart.toISOString()}
              className="flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg border-2 border-line8 bg-surface px-2 py-2 shadow-hard-sm"
            >
              <span className="text-[20px]" aria-hidden="true">
                {c?.emoji ?? "・"}
              </span>
              <span className="font-pixel text-[9px] tracking-wide text-inksoft">
                {w.weekStart.toISOString().slice(5, 10)}
              </span>
              {w.workloadSelf != null && (
                <span className="text-[9.5px] text-inksoft">
                  {LOAD_LABEL[w.workloadSelf] ?? ""}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {(lowStreak || loadStreak) && (
        <p className="mt-3 rounded-lg border-2 border-dashed border-peri bg-quotebg px-3 py-2 text-[12.5px] leading-relaxed text-ink">
          {loadStreak
            ? "ここ数週、負荷が高めが続いていますね。無理のない範囲で、意識的に休む時間もつくってください。"
            : "少し曇り空が続いています。調子は波があって当たり前。今日はちょっと早めに切り上げるのもあり。"}
        </p>
      )}
    </Window>
  );
}
