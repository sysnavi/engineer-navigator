import { describe, expect, it } from "vitest";
import {
  dailySeries,
  daysBetween,
  guestFunnel,
  median,
  retentionByWeek,
} from "./stats";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("dailySeries", () => {
  it("欠けた日を0で埋め、ゲストと登録済みを分けて数える", () => {
    const rows = dailySeries(
      [
        { date: d("2026-09-10"), guest: true },
        { date: d("2026-09-10"), guest: false },
        { date: d("2026-09-08"), guest: false },
        { date: d("2026-08-01"), guest: false }, // 範囲外
      ],
      3,
      d("2026-09-10")
    );
    expect(rows.map((r) => r.day)).toEqual(["2026-09-08", "2026-09-09", "2026-09-10"]);
    expect(rows[0]).toEqual({ day: "2026-09-08", guest: 0, member: 1 });
    expect(rows[2]).toEqual({ day: "2026-09-10", guest: 1, member: 1 });
  });
});

describe("guestFunnel", () => {
  const cohort = [
    { id: "a", createdAt: d("2026-09-01"), promotedAt: d("2026-09-04"), visitDays: 3 },
    { id: "b", createdAt: d("2026-09-02"), promotedAt: null, visitDays: 1 },
    { id: "c", createdAt: d("2026-09-03"), promotedAt: null, visitDays: 2 },
  ];
  const events = [
    { name: "guest_gate", userId: "a", props: { app: "report" } },
    { name: "guest_gate", userId: "a", props: { app: "report" } },
    { name: "guest_gate", userId: "c", props: { app: "mentor" } },
    { name: "guest_needsaccount", userId: "c", props: null },
    { name: "oauth_start", userId: "a", props: { guest: true, provider: "google" } },
    { name: "oauth_start", userId: "zzz", props: { guest: true } }, // コホート外
    { name: "oauth_result", userId: "a", props: { guest: true, outcome: "promoted" } },
    { name: "oauth_result", userId: "c", props: { guest: true, outcome: "fail", reason: "denied" } },
    { name: "oauth_result", userId: "b", props: { guest: false, outcome: "login" } }, // 非ゲスト
  ];
  const f = guestFunnel(cohort, events);

  it("各段はユニークユーザー数（イベント件数ではない）", () => {
    const by = Object.fromEntries(f.steps.map((s) => [s.key, s.users]));
    expect(by).toEqual({ started: 3, returned: 2, gated: 2, wall: 1, oauth: 1, promoted: 1 });
  });
  it("遮断は機能別に件数で集計し、多い順", () => {
    expect(f.gateByApp).toEqual([
      { app: "report", count: 2 },
      { app: "mentor", count: 1 },
    ]);
  });
  it("OAuth結果はゲスト分だけ。失敗は理由つき", () => {
    expect(f.oauthOutcomes).toEqual([
      { outcome: "promoted", count: 1 },
      { outcome: "fail:denied", count: 1 },
    ]);
  });
  it("登録までの日数の中央値", () => {
    expect(f.medianDaysToPromote).toBe(3);
  });
  it("空コホートでも壊れない", () => {
    const e = guestFunnel([], events);
    expect(e.steps.every((s) => s.users === 0)).toBe(true);
    expect(e.medianDaysToPromote).toBeNull();
  });
});

describe("retentionByWeek", () => {
  const today = d("2026-09-10"); // 木曜。今週の月曜は 09-07
  const users = [
    { id: "u1", createdAt: d("2026-08-03") }, // 5週前（D30判定可能）
    { id: "u2", createdAt: d("2026-08-05") },
    { id: "u3", createdAt: d("2026-09-08") }, // 今週
  ];
  const visits = [
    { userId: "u1", date: d("2026-08-03") },
    { userId: "u1", date: d("2026-08-04") }, // D1
    { userId: "u1", date: d("2026-09-05") }, // D30以上
    { userId: "u2", date: d("2026-08-12") }, // D7
    { userId: "u3", date: d("2026-09-09") }, // D1
  ];
  const rows = retentionByWeek(users, visits, 6, today);

  it("週は月曜起点で古い順に並ぶ", () => {
    expect(rows.map((r) => r.weekStart)).toEqual([
      "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07",
    ]);
  });
  it("古いコホートは D1/D7/D30 が出る", () => {
    expect(rows[0]).toEqual({ weekStart: "2026-08-03", size: 2, d1: 100, d7: 100, d30: 50 });
  });
  it("若いコホートは判定できない指標が null", () => {
    const cur = rows[5];
    expect(cur.size).toBe(1);
    expect(cur.d1).toBeNull(); // 週末登録者がまだ翌日を迎えていない可能性
    expect(cur.d30).toBeNull();
  });
});

describe("helpers", () => {
  it("median / daysBetween", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(daysBetween(d("2026-09-01"), new Date("2026-09-04T23:00:00Z"))).toBe(3);
  });
});
