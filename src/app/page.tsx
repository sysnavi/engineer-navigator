import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf, formatWeek } from "@/lib/week";
import { PixelTitle, PixelLabel, Window } from "@/components/retro";

export default async function Home() {
  const user = await getCurrentUser();
  const weekStart = mondayOf(new Date());

  const [report, pendingSuggestions, skillCount, expCount] = await Promise.all([
    prisma.weeklyReport.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
    }),
    prisma.skillSuggestion.count({
      where: { userId: user.id, status: "PENDING" },
    }),
    prisma.engineerSkill.count({ where: { userId: user.id } }),
    prisma.skillSuggestion.count({
      where: { userId: user.id, status: "APPROVED", kind: "EXPERIENCE" },
    }),
  ]);

  const reportDone = report?.status === "SUBMITTED";

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>WEEKLY QUEST — {formatWeek(weekStart)}</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          こんにちは、{user.name} さん
        </PixelTitle>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Link href="/report" className="group">
          <Window
            title="週報"
            titleEm=".exe"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel className={reportDone ? "" : "!text-pinkhot"}>
              {reportDone ? "QUEST CLEAR!" : "NEW QUEST"}
            </PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">今週の週報</p>
            <p className="mt-1 text-[13px] text-inksoft">
              {reportDone
                ? "提出済み。おつかれさまでした"
                : "未提出です。5分で書けます"}
            </p>
          </Window>
        </Link>

        <Link href="/skills" className="group">
          <Window
            title="SKILL_MAP"
            titleEm=".sav"
            className="transition-transform group-hover:-translate-y-0.5"
            barClass={pendingSuggestions > 0 ? "!bg-pinkhot" : ""}
          >
            <PixelLabel className={pendingSuggestions > 0 ? "!text-pinkhot" : ""}>
              {pendingSuggestions > 0 ? "LEVEL UP READY!" : "SKILL MAP"}
            </PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">スキルマップ</p>
            <p className="mt-1 text-[13px] text-inksoft">
              {pendingSuggestions > 0
                ? `AIからの更新提案が ${pendingSuggestions} 件あります`
                : `登録スキル ${skillCount} 件`}
            </p>
          </Window>
        </Link>

        {(user.role === "SALES" || user.role === "ADMIN") && (
          <Link href="/condition" className="group sm:col-span-2">
            <Window
              title="CONDITION"
              titleEm=".mon"
              className="transition-transform group-hover:-translate-y-0.5"
            >
              <PixelLabel>TEAM MONITOR</PixelLabel>
              <p className="mt-1 text-[15px] font-extrabold">コンディション</p>
              <p className="mt-1 text-[13px] text-inksoft">
                担当エンジニアの週次コンディションとアラート対応（管理者・担当営業のみ）
              </p>
            </Window>
          </Link>
        )}

        <Link href="/mentor" className="group">
          <Window
            title="MENTOR"
            titleEm=".exe"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>AI MENTOR</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">AIメンター</p>
            <p className="mt-1 text-[13px] text-inksoft">
              資格・技術を「現場でどう使うか」まで具体例つきで24時間相談
            </p>
          </Window>
        </Link>

        <Link href="/roleplay" className="group">
          <Window
            title="ROLEPLAY"
            titleEm=".sim"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>ROLE SIMULATOR</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">役割シミュレーター</p>
            <p className="mt-1 text-[13px] text-inksoft">
              顧客調整・障害対応などリーダーの難題をAIとロールプレイ→評価
            </p>
          </Window>
        </Link>

        <Link href="/resume" className="group">
          <Window
            title="経歴書"
            titleEm=".doc"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <PixelLabel>CAREER SHEET</PixelLabel>
                <p className="mt-1 text-[15px] font-extrabold">経歴書</p>
                <p className="mt-1 text-[13px] text-inksoft">
                  スキル {skillCount} 件・実績 {expCount} 件から自動組版。営業向けに印刷/PDFエクスポート
                </p>
              </div>
              <span className="btn8 pointer-events-none text-[12px]">
                ひらく ▶
              </span>
            </div>
          </Window>
        </Link>
      </div>

      <p className="text-center font-pixel text-[12px] tracking-[0.1em] text-royal2">
        週報を書く → スキルLvが上がる → 経歴書が育つ ▶ PRESS START
      </p>
    </div>
  );
}
