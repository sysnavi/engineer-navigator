import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf, formatWeek } from "@/lib/week";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { ReportForm } from "./report-form";

export default async function ReportPage() {
  const user = await getCurrentUser();
  const weekStart = mondayOf(new Date());
  const report = await prisma.weeklyReport.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    include: { analysis: true },
  });

  const submitted = report?.status === "SUBMITTED";

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>
          WEEKLY QUEST — {formatWeek(weekStart)} ・ {user.name}
        </PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          今週の週報
        </PixelTitle>
      </div>

      {submitted && (
        <div className="ach8">
          <svg
            width="46"
            height="46"
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
          <div>
            <p className="font-pixel text-[12px] tracking-[0.1em] text-pinkhot">
              ★ QUEST CLEAR — 提出済みです
            </p>
            {report?.analysis?.feedbackText && (
              <p className="mt-1 text-[13.5px] font-bold">
                今週の成長ポイント:{" "}
                <span className="font-normal">
                  {report.analysis.feedbackText}
                </span>
              </p>
            )}
            {report?.analysis?.status === "FAILED" && (
              <p className="mt-1 text-[12.5px]">
                AI解析に失敗しました（提出は完了しています）
              </p>
            )}
          </div>
        </div>
      )}

      <Window title="週報" titleEm=".exe">
        <ReportForm
          report={
            report && {
              conditionSelf: report.conditionSelf,
              workloadSelf: report.workloadSelf,
              didText: report.didText,
              newText: report.newText,
              struggleText: report.struggleText,
              nextText: report.nextText,
              shareText: report.shareText,
              wantsConsultation: report.wantsConsultation,
            }
          }
          submitted={submitted}
        />
      </Window>
    </div>
  );
}
