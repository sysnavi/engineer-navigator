import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf, formatWeek } from "@/lib/week";

export default async function Home() {
  const user = await getCurrentUser();
  const weekStart = mondayOf(new Date());

  const [report, pendingSuggestions, skillCount] = await Promise.all([
    prisma.weeklyReport.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
    }),
    prisma.skillSuggestion.count({
      where: { userId: user.id, status: "PENDING" },
    }),
    prisma.engineerSkill.count({ where: { userId: user.id } }),
  ]);

  const reportDone = report?.status === "SUBMITTED";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">こんにちは、{user.name} さん</h1>
        <p className="text-sm text-zinc-500">{formatWeek(weekStart)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/report"
          className={`rounded-lg border p-5 transition-colors ${
            reportDone
              ? "border-zinc-200 bg-white hover:bg-zinc-50"
              : "border-amber-300 bg-amber-50 hover:bg-amber-100"
          }`}
        >
          <p className="text-2xl">{reportDone ? "✅" : "📝"}</p>
          <p className="mt-2 font-semibold">今週の週報</p>
          <p className="mt-1 text-sm text-zinc-600">
            {reportDone
              ? "提出済み。おつかれさまでした"
              : "未提出です。5分で書けます"}
          </p>
        </Link>

        <Link
          href="/skills"
          className={`rounded-lg border p-5 transition-colors ${
            pendingSuggestions > 0
              ? "border-blue-300 bg-blue-50 hover:bg-blue-100"
              : "border-zinc-200 bg-white hover:bg-zinc-50"
          }`}
        >
          <p className="text-2xl">📈</p>
          <p className="mt-2 font-semibold">スキルマップ</p>
          <p className="mt-1 text-sm text-zinc-600">
            {pendingSuggestions > 0
              ? `AIからの更新提案が ${pendingSuggestions} 件あります`
              : `登録スキル ${skillCount} 件`}
          </p>
        </Link>
      </div>

      <p className="text-xs text-zinc-400">
        週報を書く → AIがスキルを抽出 → 承認すると経歴書が育つ。あなたの成長がそのまま単価交渉のエビデンスになります。
      </p>
    </div>
  );
}
