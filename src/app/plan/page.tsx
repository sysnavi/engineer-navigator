import Link from "next/link";
import { requireFullAccount } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { minExamDateStr } from "@/lib/plan-dates";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { PlanCreateForm } from "@/components/plan-create-form";

function daysLeft(examDate: Date, now: number): number {
  return Math.ceil((examDate.getTime() - now) / 86400_000);
}

export default async function PlanListPage() {
  const user = await requireFullAccount();
  const now = new Date().getTime();
  const plans = await prisma.studyPlan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } }, items: { where: { done: true } } },
  });

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>STUDY_PLAN.sav — {user.name}</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          資格学習プラン
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          試験日から逆算した週次カリキュラムを、AIが作成。
        </p>
      </div>

      <Window title="あたらしいプラン" titleEm=".new">
        <PlanCreateForm minExamDate={minExamDateStr(new Date())} />
      </Window>

      <Window title="これまでのプラン" titleEm={` (${plans.length})`}>
        {plans.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-inksoft">
            まだプランがありません。上のフォームから作りましょう。
          </p>
        ) : (
          <ul className="space-y-2.5">
            {plans.map((p) => {
              const total = p._count.items;
              const done = p.items.length;
              const dl = daysLeft(p.examDate, now);
              return (
                <li key={p.id}>
                  <Link
                    href={`/plan/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border-2 border-line8 bg-surface px-4 py-3 shadow-hard-sm transition-transform hover:-translate-y-0.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-extrabold">
                        {p.certification}
                      </span>
                      <span className="block text-[12px] text-inksoft">
                        試験日 {p.examDate.toISOString().slice(0, 10)}
                        {dl >= 0 ? `（あと${dl}日）` : "（終了）"}
                      </span>
                    </span>
                    {p.generationStatus === "GENERATING" ? (
                      <span className="badge8 shrink-0">AIが作成中…</span>
                    ) : p.generationStatus === "FAILED" ? (
                      <span className="shrink-0 font-pixel text-[11px] text-pinkhot">
                        生成失敗
                      </span>
                    ) : (
                      <span className="shrink-0 font-pixel text-[12px] text-royal2">
                        {done}/{total}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Window>
    </div>
  );
}
