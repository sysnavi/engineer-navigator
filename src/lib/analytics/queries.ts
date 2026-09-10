import { prisma } from "@/lib/db";
import {
  dailySeries,
  guestFunnel,
  retentionByWeek,
  type AppEventRow,
  type DailyPoint,
  type GuestFunnel,
  type RetentionRow,
} from "./stats";

// 来訪者分析の集計（/admin/analytics）。数字の意味と読み方は docs/analytics.md。
// 規模が小さいうちは「30日ぶんを取ってJSで集計」で十分。重くなったら
// AppEvent.props の集計を SQL に寄せる（Looker Studio 直結も docs 参照）。

const DAY_MS = 86400_000;
const SERIES_DAYS = 14;
const RETENTION_WEEKS = 8;

export type FeatureUsage = { key: string; label: string; users: number; events: number };

export type VisitorAnalytics = {
  daily: DailyPoint[];
  today: { guest: number; member: number };
  wau: { guest: number; member: number };
  mau: { guest: number; member: number };
  members: number; // 登録済み（ゲスト以外）の総数
  newDirect30: number; // 30日以内に直接（ゲストを経ず）登録
  newGuests30: number; // 30日以内にゲスト発行
  promoted30: number; // 30日以内にゲストから昇格
  funnel: GuestFunnel;
  retention: RetentionRow[];
  features: FeatureUsage[];
  eventsSince: Date | null; // 最初のイベント日時（それ以前のゲストは段が欠ける）
};

export async function getVisitorAnalytics(now = new Date()): Promise<VisitorAnalytics> {
  const d7 = new Date(now.getTime() - 7 * DAY_MS);
  const d30 = new Date(now.getTime() - 30 * DAY_MS);
  const retentionFrom = new Date(now.getTime() - (RETENTION_WEEKS + 1) * 7 * DAY_MS);
  const usersOf = (rows: { userId: string }[]) => new Set(rows.map((r) => r.userId)).size;

  const [
    visits30,
    guestCohort,
    events30,
    members,
    newDirect30,
    newGuests30,
    promoted30,
    memberUsers,
    firstEvent,
    reports,
    quiz,
    dungeon,
    mentor,
    roleplay,
    yomoyama,
    shop,
  ] = await Promise.all([
    prisma.userVisit.findMany({
      where: { date: { gte: d30 } },
      select: { userId: true, date: true, user: { select: { role: true } } },
    }),
    // ゲストとして作られた人（まだゲスト or 昇格済み）。昇格前に消えた人は掃除で消えている
    prisma.user.findMany({
      where: { createdAt: { gte: d30 }, OR: [{ role: "GUEST" }, { promotedAt: { not: null } }] },
      select: { id: true, createdAt: true, promotedAt: true, _count: { select: { visits: true } } },
    }),
    prisma.appEvent.findMany({
      where: { createdAt: { gte: d30 } },
      select: { name: true, userId: true, props: true },
    }),
    prisma.user.count({ where: { role: { not: "GUEST" } } }),
    prisma.user.count({
      where: { createdAt: { gte: d30 }, role: { not: "GUEST" }, promotedAt: null },
    }),
    prisma.user.count({
      where: { createdAt: { gte: d30 }, OR: [{ role: "GUEST" }, { promotedAt: { not: null } }] },
    }),
    prisma.user.count({ where: { promotedAt: { gte: d30 } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: retentionFrom }, role: { not: "GUEST" } },
      select: { id: true, createdAt: true },
    }),
    prisma.appEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.weeklyReport.groupBy({ by: ["userId"], _count: { _all: true }, where: { createdAt: { gte: d30 } } }),
    prisma.quizAttempt.groupBy({ by: ["userId"], _count: { _all: true }, where: { createdAt: { gte: d30 } } }),
    prisma.dungeonRun.groupBy({ by: ["userId"], _count: { _all: true }, where: { createdAt: { gte: d30 } } }),
    prisma.mentorSession.groupBy({ by: ["userId"], _count: { _all: true }, where: { createdAt: { gte: d30 } } }),
    prisma.roleplaySession.groupBy({ by: ["userId"], _count: { _all: true }, where: { createdAt: { gte: d30 } } }),
    prisma.yomoyamaPost
      .groupBy({ by: ["authorId"], _count: { _all: true }, where: { createdAt: { gte: d30 } } })
      .then((rows) => rows.map((r) => ({ userId: r.authorId, _count: r._count }))),
    prisma.purchase.groupBy({ by: ["userId"], _count: { _all: true }, where: { createdAt: { gte: d30 } } }),
  ]);

  const visitRows = visits30.map((v) => ({
    userId: v.userId,
    date: v.date,
    guest: v.user.role === "GUEST",
  }));
  const daily = dailySeries(visitRows, SERIES_DAYS, now);
  const todayPoint = daily[daily.length - 1];
  const split = (rows: typeof visitRows) => ({
    guest: usersOf(rows.filter((r) => r.guest)),
    member: usersOf(rows.filter((r) => !r.guest)),
  });

  const events: AppEventRow[] = events30.map((e) => ({
    name: e.name,
    userId: e.userId,
    props: (e.props ?? null) as Record<string, unknown> | null,
  }));
  const funnel = guestFunnel(
    guestCohort.map((u) => ({
      id: u.id,
      createdAt: u.createdAt,
      promotedAt: u.promotedAt,
      visitDays: u._count.visits,
    })),
    events
  );

  const memberIds = memberUsers.map((u) => u.id);
  const memberVisits =
    memberIds.length > 0
      ? await prisma.userVisit.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true, date: true },
        })
      : [];
  const retention = retentionByWeek(memberUsers, memberVisits, RETENTION_WEEKS, now);

  // groupBy の _count 型は「true | 部分オブジェクト | undefined」の合併になるので緩く受ける
  const countAll = (c: unknown): number =>
    typeof c === "object" && c !== null && "_all" in c ? Number((c as { _all?: number })._all ?? 0) : 0;
  const feature = (key: string, label: string, rows: { userId: string; _count: unknown }[]) => ({
    key,
    label,
    users: rows.length,
    events: rows.reduce((s, r) => s + countAll(r._count), 0),
  });
  const features: FeatureUsage[] = [
    feature("report", "週報", reports),
    feature("quiz", "腕試し（ダンジョン内の出題も含む）", quiz),
    feature("dungeon", "ダンジョン", dungeon),
    feature("mentor", "AIメンター", mentor),
    feature("roleplay", "役割演習", roleplay),
    feature("yomoyama", "よもやま投稿", yomoyama),
    feature("shop", "おかいもの", shop),
  ].sort((a, b) => b.users - a.users);

  return {
    daily,
    today: { guest: todayPoint.guest, member: todayPoint.member },
    wau: split(visitRows.filter((r) => r.date >= d7)),
    mau: split(visitRows),
    members,
    newDirect30,
    newGuests30,
    promoted30,
    funnel,
    retention,
    features,
    eventsSince: firstEvent?.createdAt ?? null,
  };
}
