import { describe, expect, it } from "vitest";
import { diagnose, fallbackProposal, formatSlack } from "./insights";
import type { VisitorAnalytics } from "./queries";

function base(over: Partial<VisitorAnalytics> = {}): VisitorAnalytics {
  const steps = (n: Record<string, number>) =>
    ["started", "returned", "gated", "wall", "oauth", "promoted"].map((key) => ({
      key,
      label: key,
      users: n[key] ?? 0,
      hint: "",
    }));
  return {
    daily: [],
    today: { guest: 0, member: 0 },
    wau: { guest: 2, member: 8 },
    mau: { guest: 5, member: 20 },
    members: 20,
    newDirect30: 2,
    newGuests30: 10,
    promoted30: 2,
    funnel: {
      steps: steps({ started: 10, returned: 6, gated: 5, wall: 5, oauth: 3, promoted: 2 }),
      gateByApp: [{ app: "report", count: 7 }],
      oauthOutcomes: [{ outcome: "promoted", count: 2 }],
      medianDaysToPromote: 2,
    },
    retention: [{ weekStart: "2026-08-24", size: 5, d1: 60, d7: 40, d30: null }],
    features: [{ key: "report", label: "週報", users: 8, events: 20 }],
    eventsSince: null,
    ...over,
  };
}

describe("diagnose", () => {
  it("ゲストが少ないときは集客を最優先にし、ファネルの落差は言わない", () => {
    const a = base({ funnel: { ...base().funnel, steps: base().funnel.steps.map((s) => ({ ...s, users: s.key === "started" ? 2 : 0 })) } });
    const f = diagnose(a, base());
    expect(f[0].key).toBe("few-guests");
    expect(f.some((x) => x.key.startsWith("drop-"))).toBe(false);
  });

  it("最大の落差の段を最優先の所見にする", () => {
    // 2日目に戻るのが 10→2 で最悪
    const cur = base();
    cur.funnel.steps.find((s) => s.key === "returned")!.users = 2;
    const f = diagnose(cur, base());
    expect(f[0].key).toBe("drop-return");
    expect(f[0].evidence).toContain("10人 → 2人");
  });

  it("落差が5割未満でなければ落差の所見は出さず、登録率だけ出す", () => {
    const f = diagnose(base(), base());
    expect(f.some((x) => x.key.startsWith("drop-"))).toBe(false);
    expect(f.find((x) => x.key === "conversion")?.title).toContain("20%");
  });

  it("既存アカウント衝突・WAU減・D7低下・週報未使用を拾う", () => {
    const cur = base({
      wau: { guest: 1, member: 4 }, // 先週10 → 5
      funnel: { ...base().funnel, oauthOutcomes: [{ outcome: "already-linked", count: 2 }] },
      retention: [{ weekStart: "2026-08-24", size: 5, d1: 60, d7: 20, d30: null }],
      features: [{ key: "report", label: "週報", users: 1, events: 1 }],
    });
    const keys = diagnose(cur, base()).map((x) => x.key);
    expect(keys).toEqual(expect.arrayContaining(["wau-down", "already-linked", "retention-d7", "report-unused"]));
  });

  it("OAuth失敗率が高いと最優先で拾う", () => {
    const cur = base({
      funnel: {
        ...base().funnel,
        oauthOutcomes: [
          { outcome: "fail:denied", count: 2 },
          { outcome: "promoted", count: 1 },
        ],
      },
    });
    const f = diagnose(cur, base());
    expect(f[0].key).toBe("oauth-fail");
    expect(f[0].evidence).toContain("denied 2");
  });

  it("優先度順に並ぶ", () => {
    const cur = base({ wau: { guest: 0, member: 3 } });
    const f = diagnose(cur, base());
    for (let i = 1; i < f.length; i++) expect(f[i].priority).toBeGreaterThanOrEqual(f[i - 1].priority);
  });
});

describe("fallbackProposal / formatSlack", () => {
  it("所見なしでも本文が組み立つ", () => {
    const p = fallbackProposal([]);
    expect(p.priorities).toHaveLength(0);
    const text = formatSlack({ current: base(), previous: base(), proposal: p, appUrl: "https://x", aiUsed: false });
    expect(text).toContain("来訪者分析");
    expect(text).toContain("WAU 10 →（先週 10）");
    expect(text).toContain("https://x/admin/analytics");
    expect(text).toContain("AI未使用");
  });
  it("所見は上位3つまで、根拠と行動が本文に入る", () => {
    const f = diagnose(base({ wau: { guest: 0, member: 3 } }), base());
    const p = fallbackProposal(f);
    expect(p.priorities.length).toBeLessThanOrEqual(3);
    const text = formatSlack({ current: base(), previous: base(), proposal: p, appUrl: "https://x", aiUsed: true });
    expect(text).toContain("*1. ");
    expect(text).toContain("根拠:");
    expect(text).toContain("AI 生成");
  });
});
