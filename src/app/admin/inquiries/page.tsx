// 問い合わせの対応画面（管理者限定・Issue #9）。
// 返信するとユーザーのマイページに届く（メールは使わない）。

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import {
  INQUIRY_CATEGORIES,
  STATUS_LABELS,
  type InquiryCategory,
  type InquiryStatus,
} from "@/lib/inquiry";
import { replyToInquiry, closeInquiry, reopenInquiry } from "./actions";

const STATUS_STYLE: Record<InquiryStatus, string> = {
  OPEN: "bg-pinkhot text-white",
  REPLIED: "bg-[var(--good)] text-white",
  CLOSED: "bg-surface text-inksoft",
};

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") notFound();
  const { status } = await searchParams;
  const filter = status === "all" ? undefined : status ?? "open";

  const where =
    filter === "open" ? { status: { in: ["OPEN", "REPLIED"] } } : {};
  const [inquiries, counts] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: { user: { select: { name: true, handle: true, role: true } } },
    }),
    prisma.inquiry.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PixelLabel>INQUIRIES — 問い合わせ対応（管理者）</PixelLabel>
          <PixelTitle as="h1" className="text-3xl text-royal">
            問い合わせ
          </PixelTitle>
          <p className="mt-1 text-[13px] text-inksoft">
            返信するとユーザーのマイページに届きます（メールは使いません）。
            未ログインからの声はDBに保存せずSlackにのみ通知されます。
          </p>
        </div>
        <Link href="/admin" className="btn8 text-[12px]">
          ← 管理ダッシュボード
        </Link>
      </div>

      <Window title="FILTER" titleEm=".cfg" bodyClass="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/inquiries"
            className={`btn8 px-3 py-1.5 text-[11.5px] ${filter === "open" ? "btn8-ok" : ""}`}
          >
            未対応・返信済み（{countOf("OPEN") + countOf("REPLIED")}）
          </Link>
          <Link
            href="/admin/inquiries?status=all"
            className={`btn8 px-3 py-1.5 text-[11.5px] ${filter === undefined ? "btn8-ok" : ""}`}
          >
            すべて（{counts.reduce((s, c) => s + c._count, 0)}）
          </Link>
          <span className="ml-auto font-pixel text-[10.5px] tracking-wide text-inksoft">
            未対応 {countOf("OPEN")} ／ 返信済み {countOf("REPLIED")} ／ クローズ{" "}
            {countOf("CLOSED")}
          </span>
        </div>
      </Window>

      {inquiries.length === 0 ? (
        <Window title="INQUIRIES" titleEm=".dat">
          <p className="py-6 text-center text-[13px] text-inksoft">
            問い合わせはありません。
          </p>
        </Window>
      ) : (
        <div className="space-y-4">
          {inquiries.map((q) => {
            const st = q.status as InquiryStatus;
            return (
              <Window
                key={q.id}
                title={INQUIRY_CATEGORIES[q.category as InquiryCategory] ?? q.category}
                titleEm={`.${q.category}`}
                barClass={st === "OPEN" ? "!bg-pinkhot" : ""}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                  <span
                    className={`rounded-md border-2 border-line8 px-2 py-0.5 font-pixel text-[10px] ${STATUS_STYLE[st]}`}
                  >
                    {STATUS_LABELS[st] ?? q.status}
                  </span>
                  <span className="font-bold">{q.user.handle ?? q.user.name}</span>
                  <span className="text-inksoft">
                    {q.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                  {q.repliedAt && (
                    <span className="text-inksoft">
                      ／ 返信 {q.repliedAt.toISOString().slice(0, 10)}
                      {q.readAt ? "（既読）" : "（未読）"}
                    </span>
                  )}
                </div>

                <p className="mt-2.5 whitespace-pre-wrap rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2.5 text-[13px] leading-relaxed">
                  {q.body}
                </p>

                {q.adminReply && (
                  <div className="mt-2.5 rounded-lg border-2 border-line8 bg-quotebg px-3 py-2.5">
                    <p className="font-pixel text-[10px] tracking-wide text-royal2">
                      運営からの返信
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed">
                      {q.adminReply}
                    </p>
                  </div>
                )}

                <form
                  action={replyToInquiry.bind(null, q.id)}
                  className="mt-3 space-y-2"
                >
                  <textarea
                    name="reply"
                    rows={3}
                    defaultValue={q.adminReply ?? ""}
                    className="field8"
                    placeholder="返信を書く（ユーザーのマイページに届きます）"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn8 btn8-start px-4 py-1.5 text-[12px]">
                      ▶ {q.adminReply ? "返信を更新" : "返信する"}
                    </button>
                    {st !== "CLOSED" ? (
                      <button
                        formAction={closeInquiry.bind(null, q.id)}
                        className="btn8 px-4 py-1.5 text-[12px]"
                      >
                        クローズ
                      </button>
                    ) : (
                      <button
                        formAction={reopenInquiry.bind(null, q.id)}
                        className="btn8 px-4 py-1.5 text-[12px]"
                      >
                        未対応にもどす
                      </button>
                    )}
                  </div>
                </form>
              </Window>
            );
          })}
        </div>
      )}
    </div>
  );
}
