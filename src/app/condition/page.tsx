import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getConditionSeries,
  getScopedEngineers,
  type WeekPoint,
} from "@/lib/condition";
import { startAlert, closeAlert, rescanConditions } from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";

const WEATHER: Record<number, string> = { 4: "☀️", 3: "🌤", 2: "☁️", 1: "🌧" };
const WORKLOAD: Record<number, string> = {
  4: "余裕あり",
  3: "ちょうどいい",
  2: "忙しい",
  1: "限界が近い",
};
const LEVEL_CHIP: Record<string, string> = {
  INFO: "chip8 chip8-info",
  WARN: "chip8 chip8-warn",
  CRITICAL: "chip8 chip8-crit",
};

function scoreColor(score: number): string {
  if (score >= 60) return "var(--good)";
  if (score >= 40) return "var(--warn)";
  return "var(--crit)";
}

/** 8週分のコンディションを8bitバーで */
function Sparkline(props: { series: WeekPoint[] }) {
  const cells: (WeekPoint | null)[] = [
    ...Array(Math.max(0, 8 - props.series.length)).fill(null),
    ...props.series.slice(-8),
  ];
  return (
    <span className="spark8" aria-label="直近8週のコンディション推移">
      {cells.map((p, i) =>
        p?.score == null ? (
          <i key={i} className="empty" />
        ) : (
          <i
            key={i}
            style={{
              height: `${Math.max(15, p.score)}%`,
              background: scoreColor(p.score),
            }}
            title={`${p.weekStart.toISOString().slice(0, 10)}: ${Math.round(p.score)}`}
          />
        )
      )}
    </span>
  );
}

export default async function ConditionPage() {
  const viewer = await getCurrentUser();

  if (viewer.role !== "ADMIN" && viewer.role !== "SALES") {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <Window title="ACCESS DENIED" barClass="!bg-crit">
          <PixelLabel className="!text-crit">403 — FORBIDDEN</PixelLabel>
          <p className="mt-2 text-[13.5px]">
            コンディション情報は<b>管理者と担当営業のみ</b>が閲覧できます。
          </p>
          <p className="mt-1 text-[12.5px] text-inksoft">
            あなた自身のコンディションは週報画面のフィードバックで確認できます。
          </p>
        </Window>
      </div>
    );
  }

  const engineers = await getScopedEngineers(viewer);
  const engineerIds = engineers.map((e) => e.id);

  const [openAlerts, closedRecent, seriesList] = await Promise.all([
    prisma.conditionAlert.findMany({
      where: { userId: { in: engineerIds }, status: { not: "CLOSED" } },
      include: { user: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.conditionAlert.findMany({
      where: { userId: { in: engineerIds }, status: "CLOSED" },
      include: { user: true },
      orderBy: { closedAt: "desc" },
      take: 5,
    }),
    Promise.all(engineerIds.map((id) => getConditionSeries(id))),
  ]);
  const seriesByUser = new Map(engineerIds.map((id, i) => [id, seriesList[i]]));

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PixelLabel>CONDITION.mon — {viewer.name}</PixelLabel>
          <PixelTitle as="h1" className="text-3xl text-royal">
            コンディション
          </PixelTitle>
        </div>
        <form action={rescanConditions}>
          <button className="btn8 text-[12px]">▶ トレンド再スキャン</button>
        </form>
      </div>

      <p className="rounded-lg border-2 border-dashed border-royal2 bg-quotebg px-4 py-2.5 text-[12px] text-inksoft">
        🔒 このページは<b>管理者と担当営業のみ</b>閲覧できます（担当営業は自分の案件のエンジニアのみ）。
        コンディションデータは早期フォローのためのもので、<b>人事評価には使用しません</b>。
        解析が行われることは週報画面で本人に明示しています。
      </p>

      {/* アラート */}
      <Window
        title="ALERTS"
        titleEm=".log"
        barClass={openAlerts.length > 0 ? "!bg-crit" : ""}
      >
        {openAlerts.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-inksoft">
            未対応のアラートはありません ✓
          </p>
        ) : (
          <div className="space-y-4">
            {openAlerts.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border-2 border-line8 bg-surface p-4 shadow-hard-sm"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={LEVEL_CHIP[a.level]}>{a.level}</span>
                  <span className="badge8">{a.trigger}</span>
                  <span className="text-[14px] font-extrabold">
                    {a.user.name}
                  </span>
                  <span className="font-pixel text-[11px] text-inksoft">
                    {a.createdAt.toISOString().slice(0, 10)}
                  </span>
                  {a.status === "IN_PROGRESS" && (
                    <span className="font-pixel text-[11px] tracking-wide text-royal2">
                      ● 対応中
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[13px]">{a.reason}</p>
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  {a.status === "OPEN" && (
                    <form
                      action={async () => {
                        "use server";
                        await startAlert(a.id);
                      }}
                    >
                      <button className="btn8 btn8-ok px-4 py-2 text-[12px]">
                        ▶ たいおう開始
                      </button>
                    </form>
                  )}
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await closeAlert(a.id, formData);
                    }}
                    className="flex min-w-[260px] flex-1 items-start gap-2.5"
                  >
                    <textarea
                      name="note"
                      rows={1}
                      required
                      placeholder="対応記録（面談メモ）— 例: 7/15 1on1実施。案件の環境不安定が主因…"
                      className="field8 !text-[12.5px]"
                    />
                    <button className="btn8 px-4 py-2 text-[12px]">
                      ✓ クローズ
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        {closedRecent.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer font-pixel text-[11.5px] tracking-wide text-inksoft">
              ▸ 最近クローズした対応記録（{closedRecent.length}件）
            </summary>
            <ul className="mt-2.5 space-y-2">
              {closedRecent.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border-2 border-dashed border-grid8 px-3 py-2 text-[12.5px] text-inksoft"
                >
                  <b className="text-ink">{a.user.name}</b> ・ {a.trigger} ・{" "}
                  {a.closedAt?.toISOString().slice(0, 10)}
                  <br />
                  面談メモ: {a.note}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Window>

      {/* チーム一覧 */}
      <Window title="TEAM" titleEm=".sav">
        {engineers.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-inksoft">
            担当中のエンジニアがいません（案件の営業担当に設定されると表示されます）
          </p>
        ) : (
          <div className="space-y-3">
            {engineers.map((e) => {
              const series = seriesByUser.get(e.id) ?? [];
              const latest = series.at(-1);
              const openCount = openAlerts.filter(
                (a) => a.userId === e.id
              ).length;
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border-2 border-line8 bg-surface px-4 py-3 shadow-hard-sm"
                >
                  <span className="min-w-[120px] text-[14px] font-extrabold">
                    {e.name}
                  </span>
                  <span className="text-[13px]">
                    {latest?.selfNorm != null
                      ? WEATHER[Math.round((latest.selfNorm / 100) * 3) + 1]
                      : "—"}
                    <span className="ml-1.5 text-[11.5px] text-inksoft">
                      {latest?.workloadSelf != null
                        ? WORKLOAD[latest.workloadSelf]
                        : "未提出"}
                    </span>
                  </span>
                  <span className="font-pixel text-[12px]">
                    AI:{" "}
                    {latest?.conditionAi != null ? (
                      <b style={{ color: scoreColor(latest.conditionAi) }}>
                        {Math.round(latest.conditionAi)}
                      </b>
                    ) : (
                      <span className="text-inksoft">--</span>
                    )}
                  </span>
                  {latest?.divergence != null && latest.divergence >= 35 && (
                    <span className="chip8 chip8-warn">乖離 {Math.round(latest.divergence)}</span>
                  )}
                  <span className="ml-auto flex items-center gap-4">
                    <Sparkline series={series} />
                    {openCount > 0 && (
                      <span className="chip8 chip8-crit">⚠ {openCount}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-right font-pixel text-[10.5px] tracking-wide text-inksoft">
          バー: 直近8週の総合スコア（AIトーン優先） ■60+ ■40-59 ■〜39
        </p>
      </Window>
    </div>
  );
}
