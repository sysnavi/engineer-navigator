// 来訪者分析の純ロジック（DBに触らない。テストは stats.test.ts）。
// 日付は UserVisit.date と同じ UTC の暦日で扱う（src/lib/exp.ts の dayOf と同じ丸め）。

const DAY_MS = 86400_000;

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((utcDay(to).getTime() - utcDay(from).getTime()) / DAY_MS);
}

export function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export type DailyPoint = { day: string; guest: number; member: number };

/** 直近 days 日ぶんの日次ユニーク訪問（ゲスト/登録済み）。欠けた日は0で埋める。 */
export function dailySeries(
  visits: { date: Date; guest: boolean }[],
  days: number,
  today: Date
): DailyPoint[] {
  const start = utcDay(today).getTime() - (days - 1) * DAY_MS;
  const byDay = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const day = dayKey(new Date(start + i * DAY_MS));
    byDay.set(day, { day, guest: 0, member: 0 });
  }
  for (const v of visits) {
    const p = byDay.get(dayKey(v.date));
    if (!p) continue;
    if (v.guest) p.guest++;
    else p.member++;
  }
  return [...byDay.values()];
}

export type GuestUser = {
  id: string;
  createdAt: Date;
  promotedAt: Date | null;
  visitDays: number;
};
export type AppEventRow = {
  name: string;
  userId: string | null;
  props: Record<string, unknown> | null;
};

export type FunnelStep = { key: string; label: string; users: number; hint: string };

export type GuestFunnel = {
  steps: FunnelStep[];
  gateByApp: { app: string; count: number }[];
  oauthOutcomes: { outcome: string; count: number }[];
  medianDaysToPromote: number | null;
};

/**
 * ゲスト→本登録のファネル。cohort は「期間内にゲストとして作られたUser」。
 * 各段は cohort 内のユニークユーザー数（イベント件数ではない）。
 */
export function guestFunnel(cohort: GuestUser[], events: AppEventRow[]): GuestFunnel {
  const ids = new Set(cohort.map((u) => u.id));
  const usersOf = (name: string, filter?: (p: Record<string, unknown>) => boolean) => {
    const s = new Set<string>();
    for (const e of events) {
      if (e.name !== name || !e.userId || !ids.has(e.userId)) continue;
      if (filter && !filter(e.props ?? {})) continue;
      s.add(e.userId);
    }
    return s.size;
  };

  const started = cohort.length;
  const returned = cohort.filter((u) => u.visitDays >= 2).length;
  const gated = usersOf("guest_gate");
  const sawWall = usersOf("guest_needsaccount");
  const triedOAuth = usersOf("oauth_start", (p) => p.guest === true);
  const promoted = cohort.filter((u) => !!u.promotedAt).length;

  const steps: FunnelStep[] = [
    { key: "started", label: "お試し開始", users: started, hint: "ゲスト発行" },
    { key: "returned", label: "2日目も来た", users: returned, hint: pct(returned, started) },
    { key: "gated", label: "登録限定に触れた", users: gated, hint: pct(gated, started) },
    { key: "wall", label: "登録案内を見た", users: sawWall, hint: pct(sawWall, gated) },
    { key: "oauth", label: "連携を始めた", users: triedOAuth, hint: pct(triedOAuth, started) },
    { key: "promoted", label: "登録完了", users: promoted, hint: pct(promoted, started) },
  ];

  const gateCount = new Map<string, number>();
  const outcomeCount = new Map<string, number>();
  for (const e of events) {
    if (!e.userId || !ids.has(e.userId)) continue;
    const p = e.props ?? {};
    if (e.name === "guest_gate") {
      const app = typeof p.app === "string" ? p.app : "unknown";
      gateCount.set(app, (gateCount.get(app) ?? 0) + 1);
    }
    if (e.name === "oauth_result" && p.guest === true) {
      const o = typeof p.outcome === "string" ? p.outcome : "unknown";
      const key = o === "fail" && typeof p.reason === "string" ? `fail:${p.reason}` : o;
      outcomeCount.set(key, (outcomeCount.get(key) ?? 0) + 1);
    }
  }
  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]);

  const days = cohort
    .filter((u) => u.promotedAt)
    .map((u) => daysBetween(u.createdAt, u.promotedAt!));

  return {
    steps,
    gateByApp: sortDesc(gateCount).map(([app, count]) => ({ app, count })),
    oauthOutcomes: sortDesc(outcomeCount).map(([outcome, count]) => ({ outcome, count })),
    medianDaysToPromote: median(days),
  };
}

export type RetentionRow = {
  weekStart: string;
  size: number;
  d1: number | null; // 翌日以降に戻った率（%）。コホートが若すぎるときは null
  d7: number | null;
  d30: number | null;
};

/**
 * 登録週ごとの定着。dN = 「登録からN日以上あとに訪問した人」の割合。
 * コホート全員が N 日を経過していない場合は null（早すぎて判定できない）。
 */
export function retentionByWeek(
  users: { id: string; createdAt: Date }[],
  visits: { userId: string; date: Date }[],
  weeks: number,
  today: Date
): RetentionRow[] {
  const t = utcDay(today);
  // 週の起点は月曜（UTC）
  const dow = (t.getUTCDay() + 6) % 7;
  const thisMonday = t.getTime() - dow * DAY_MS;

  const visitsByUser = new Map<string, Date[]>();
  for (const v of visits) {
    const arr = visitsByUser.get(v.userId) ?? [];
    arr.push(v.date);
    visitsByUser.set(v.userId, arr);
  }

  const rows: RetentionRow[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = thisMonday - w * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    const cohort = users.filter((u) => {
      const c = u.createdAt.getTime();
      return c >= start && c < end;
    });
    const rate = (n: number): number | null => {
      // 週末登録の人が N 日経っていないなら判定不能
      if (end - DAY_MS + n * DAY_MS > t.getTime()) return null;
      if (cohort.length === 0) return 0;
      const hit = cohort.filter((u) =>
        (visitsByUser.get(u.id) ?? []).some((d) => daysBetween(u.createdAt, d) >= n)
      ).length;
      return Math.round((hit / cohort.length) * 100);
    };
    rows.push({
      weekStart: dayKey(new Date(start)),
      size: cohort.length,
      d1: rate(1),
      d7: rate(7),
      d30: rate(30),
    });
  }
  return rows;
}
