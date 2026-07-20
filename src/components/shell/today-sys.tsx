// TODAY.sys — 「今日どこへ行くべきか」の案内所（デスクトップホームのウィジェット）。
// 週報・スキル承認・ダンジョン・連続訪問の実データから行を組み立てる。

import Link from "next/link";
import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";
import { getPlayerStats } from "@/lib/exp";
import { getDungeonState } from "@/lib/dungeon/run";
import { getPendingVisitor } from "@/lib/pets/encounter";

export async function TodaySys(props: { userId: string }) {
  const weekStart = mondayOf(new Date());
  const [report, pendingSuggestions, stats, dungeon, visitor] = await Promise.all([
    prisma.weeklyReport.findUnique({
      where: { userId_weekStart: { userId: props.userId, weekStart } },
      select: { status: true },
    }),
    prisma.skillSuggestion.count({
      where: { userId: props.userId, status: "PENDING" },
    }),
    getPlayerStats(props.userId),
    getDungeonState(props.userId),
    getPendingVisitor(props.userId),
  ]);
  const reportDone = report?.status === "SUBMITTED";

  const rows: { icon: string; text: string; cta?: { href: string; label: string } }[] = [];
  rows.push(
    reportDone
      ? { icon: "✅", text: "今週の週報 — 提出済み" }
      : { icon: "⚠", text: "今週の週報 — 未提出", cta: { href: "/report", label: "▶ 書く" } }
  );
  if (pendingSuggestions > 0) {
    rows.push({
      icon: "⏳",
      text: `スキル承認まち — ${pendingSuggestions}件`,
      cta: { href: "/skills", label: "▶ 見る" },
    });
  }
  rows.push(
    dungeon.canDive
      ? { icon: "⛏", text: "ダンジョン — 潜行OK", cta: { href: "/dungeon", label: "▶ 潜る" } }
      : { icon: "💤", text: "アバターは休養中 — また明日" }
  );
  if (visitor) {
    rows.push({ icon: "👾", text: "だれか遊びに来てる…！（画面のすみを見て）" });
  }
  if (stats.currentStreak >= 2) {
    rows.push({ icon: "🔥", text: `${stats.currentStreak}日連続訪問中 — この調子！` });
  }

  return (
    <div className="overflow-hidden rounded-lg border-[2.5px] border-line8 bg-win shadow-[3px_3px_0_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between bg-ink px-3 py-1.5 font-pixel text-[10.5px] tracking-[0.12em] text-white">
        <span>
          TODAY<span className="text-peri">.sys</span> — きょうの状態
        </span>
        <span aria-hidden="true">▮▮▮</span>
      </div>
      <div className="grid gap-2 p-3">
        {rows.map((r) =>
          r.cta ? (
            <Link
              key={r.text}
              href={r.cta.href}
              className="flex items-center gap-2 rounded-lg border-2 border-line8 bg-surface px-2.5 py-1.5 text-[12.5px] font-bold hover:bg-win"
            >
              <span aria-hidden="true">{r.icon}</span>
              {r.text}
              <span className="ml-auto font-pixel text-[10px] tracking-wide text-pinkhot">
                {r.cta.label}
              </span>
            </Link>
          ) : (
            <p
              key={r.text}
              className="flex items-center gap-2 rounded-lg border-2 border-dashed border-peri px-2.5 py-1.5 text-[12.5px] font-bold text-inksoft"
            >
              <span aria-hidden="true">{r.icon}</span>
              {r.text}
            </p>
          )
        )}
      </div>
    </div>
  );
}
