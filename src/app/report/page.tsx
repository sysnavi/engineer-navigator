import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf, formatWeek } from "@/lib/week";
import { giveConsent } from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { ReportForm } from "./report-form";
import { InterviewChat } from "./interview";

// 初回オンボーディング: 同意（AI解析・閲覧範囲・評価不使用）を取ってから週報を解錠する
function ConsentGate() {
  return (
    <Window title="LICENSE" titleEm=".txt">
      <PixelLabel className="!text-pinkhot">
        FIRST BOOT — はじめる前に
      </PixelLabel>
      <p className="mt-2 text-[13.5px]">
        週報をはじめる前に、次の3つに目を通してください。
      </p>
      <ol className="mt-3 space-y-3 text-[13px]">
        <li className="rounded-lg border-2 border-line8 bg-surface p-3 shadow-hard-sm">
          <b>1. AIが解析します</b> — 提出した週報はAIが解析し、スキルの抽出とコンディションの把握に使われます。
        </li>
        <li className="rounded-lg border-2 border-line8 bg-surface p-3 shadow-hard-sm">
          <b>2. 閲覧範囲は限定されます</b> —
          コンディション（設問1・2・5とスコア）を見られるのは<b>あなた・管理者・担当営業だけ</b>です。
          実績（設問3・4）は経歴書として営業活動に使われます。
        </li>
        <li className="rounded-lg border-2 border-line8 bg-surface p-3 shadow-hard-sm">
          <b>3. 人事評価には使いません</b> —
          コンディションのスコアやアラートが評価に使われることはありません。早期フォローのためだけに使います。
        </li>
      </ol>
      <form action={giveConsent} className="mt-5">
        <button className="btn8 btn8-start">▶ 同意してはじめる</button>
      </form>
    </Window>
  );
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const user = await getCurrentUser();
  if (!user.consentedAt) {
    return (
      <div className="mx-auto max-w-2xl space-y-7">
        <div>
          <PixelLabel>WEEKLY QUEST — ONBOARDING</PixelLabel>
          <PixelTitle as="h1" className="text-3xl text-royal">
            週報をはじめる
          </PixelTitle>
        </div>
        <ConsentGate />
      </div>
    );
  }
  const weekStart = mondayOf(new Date());
  const report = await prisma.weeklyReport.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    include: { analysis: true },
  });

  const submitted = report?.status === "SUBMITTED";
  const interview = mode === "interview";

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

      {/* 書き方の切替: フォーム / インタビュー（話すだけで週報になる） */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/report"
          className={`btn8 text-[12px] ${interview ? "" : "btn8-ok"}`}
        >
          フォームで書く
        </Link>
        <Link
          href="/report?mode=interview"
          className={`btn8 text-[12px] ${interview ? "btn8-ok" : ""}`}
        >
          🎙 インタビューで答える
        </Link>
        {interview && (
          <span className="text-[11.5px] text-inksoft">
            AIが1問ずつ聞きます。話すだけで週報のドラフトができます
          </span>
        )}
      </div>

      {interview ? (
        <Window title="インタビュー" titleEm=".rec" bodyClass="p-4 sm:p-5">
          <InterviewChat />
        </Window>
      ) : (
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
              }
            }
            submitted={submitted}
          />
        </Window>
      )}
    </div>
  );
}
