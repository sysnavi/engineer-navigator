import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMentorSession } from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { SubmitButton } from "@/components/submit-button";
import { ProposeTopics } from "./propose";

export default async function MentorPage() {
  const user = await getCurrentUser();
  const sessions = await prisma.mentorSession.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>MENTOR.exe — {user.name}</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          AIメンター
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          資格・技術の相談に「理論 → 現場でどう使うか」を具体例つきで答えます。
        </p>
        <Link
          href="/plan"
          className="mt-2 inline-block font-pixel text-[11px] tracking-wide text-royal2 hover:text-pinkhot"
        >
          ▶ 資格の学習プラン（試験日から逆算）を作る →
        </Link>
      </div>

      <Window title="先回り提案" titleEm=".ai" barClass="!bg-pinkhot">
        <PixelLabel className="!text-pinkhot">STUDY QUEST</PixelLabel>
        <p className="mt-1 mb-3 text-[12.5px] text-inksoft">
          あなたの週報の「詰まったこと・新しく触れた技術」から、次に学ぶと効く学習トピックを提案します。
        </p>
        <ProposeTopics createAction={createMentorSession} />
      </Window>

      <Window title="あたらしく相談" titleEm=".new">
        <form action={createMentorSession} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-extrabold">
                資格（任意）
              </label>
              <input
                name="certification"
                placeholder="例: AWS SAA / JSTQB FL"
                className="field8"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-extrabold">
                テーマ（任意）
              </label>
              <input
                name="topic"
                placeholder="例: IAMの考え方 / テスト設計"
                className="field8"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-extrabold">
              聞きたいこと
            </label>
            <textarea
              name="firstMessage"
              rows={2}
              required
              placeholder="例: IAMロールとユーザーの使い分けを知りたい"
              className="field8"
            />
          </div>
          <SubmitButton className="btn8 btn8-start" pendingLabel="準備中…">
            ▶ そうだんを始める
          </SubmitButton>
        </form>
      </Window>

      <Window title="これまでの相談" titleEm={` (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-inksoft">
            まだ相談履歴はありません。上のフォームから始めましょう。
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/mentor/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border-2 border-line8 bg-surface px-4 py-3 shadow-hard-sm transition-transform hover:-translate-y-0.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-extrabold">
                      {s.certification || s.topic || "相談"}
                    </span>
                    <span className="block truncate text-[12px] text-inksoft">
                      {s.messages[0]?.content ?? "（メッセージなし）"}
                    </span>
                  </span>
                  <span className="shrink-0 font-pixel text-[11px] tracking-wide text-royal2">
                    {s._count.messages} msg
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Window>
    </div>
  );
}
