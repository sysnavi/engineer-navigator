import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFullAccount } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { toggleStudyItem } from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireFullAccount();
  const plan = await prisma.studyPlan.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!plan || plan.userId !== user.id) notFound();

  // 各週のお題に、いま何問あるかを数えて出す（0問なら誘導しても空振りになるので出し分ける）。
  const topics = [...new Set(plan.items.map((i) => i.topic).filter((t): t is string => !!t))];
  const counts = topics.length
    ? await prisma.quizQuestion.groupBy({
        by: ["topic"],
        where: { topic: { in: topics } },
        _count: { _all: true },
      })
    : [];
  const countByTopic = new Map(counts.map((c) => [c.topic, c._count._all]));

  const total = plan.items.length;
  const done = plan.items.filter((i) => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const dl = Math.ceil(
    (plan.examDate.getTime() - new Date().getTime()) / 86400_000
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <PixelLabel>STUDY PLAN</PixelLabel>
          <PixelTitle as="h1" className="text-2xl text-royal">
            {plan.certification}
          </PixelTitle>
          <p className="mt-1 text-[13px] text-inksoft">
            試験日 {plan.examDate.toISOString().slice(0, 10)}
            {dl >= 0 ? ` ・ あと ${dl} 日` : " ・ 終了"}
          </p>
        </div>
        <Link href="/plan" className="btn8 text-[12px]">
          ← 一覧
        </Link>
      </div>

      {/* 進捗バー */}
      <Window title="PROGRESS" titleEm=".bar">
        <div className="flex items-center gap-3">
          <div className="h-4 flex-1 overflow-hidden rounded border-2 border-line8 bg-surface2">
            <div
              className="h-full bg-royal transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-pixel text-[13px] text-royal2">
            {done}/{total}・{pct}%
          </span>
        </div>
        {pct === 100 && (
          <p className="mt-3 font-pixel text-[12px] tracking-[0.1em] text-pinkhot">
            ★ ALL CLEAR — 準備万端！
          </p>
        )}
      </Window>

      {/* 週次チェックリスト */}
      <div className="space-y-3">
        {plan.items.map((it) => (
          <div
            key={it.id}
            className={`flex items-start gap-3 rounded-lg border-2 border-line8 p-4 shadow-hard-sm ${
              it.done ? "bg-surface2" : "bg-win"
            }`}
          >
            <form
              action={async () => {
                "use server";
                await toggleStudyItem(it.id, !it.done);
              }}
              className="pt-0.5"
            >
              <button
                className={`flex h-6 w-6 items-center justify-center rounded border-2 border-line8 font-pixel text-[13px] shadow-hard-sm ${
                  it.done ? "bg-royal text-white" : "bg-win text-transparent"
                }`}
                aria-label={it.done ? "未完了に戻す" : "完了にする"}
              >
                {it.done ? "✓" : ""}
              </button>
            </form>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {it.weekLabel && (
                  <span className="badge8">{it.weekLabel}</span>
                )}
                <span
                  className={`text-[14px] font-extrabold ${it.done ? "text-inksoft line-through" : ""}`}
                >
                  {it.title}
                </span>
                {it.targetDate && (
                  <span className="font-pixel text-[10.5px] tracking-wide text-inksoft">
                    〜{it.targetDate.toISOString().slice(0, 10)}
                  </span>
                )}
              </div>
              {it.detail && (
                <p className="mt-1 text-[12.5px] text-inksoft">{it.detail}</p>
              )}
              {it.topic &&
                (countByTopic.get(it.topic) ? (
                  <Link
                    href={`/quiz/play?topic=${encodeURIComponent(it.topic)}`}
                    className="btn8 mt-2 inline-block text-[11.5px]"
                  >
                    ▶ この章の腕試し（{it.topic}・{countByTopic.get(it.topic)}問）
                  </Link>
                ) : (
                  <p className="mt-2 text-[11px] text-inksoft">
                    「{it.topic}」の問題は準備中
                  </p>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
