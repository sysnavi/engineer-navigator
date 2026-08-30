import { describe, expect, it } from "vitest";
import {
  daysUntilExam,
  planWeeks,
  itemTargetDate,
  minExamDateStr,
  MIN_PLAN_LEAD_DAYS,
} from "./plan-dates";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("daysUntilExam", () => {
  it("同日は0、翌日は1（切り上げ）", () => {
    expect(daysUntilExam(d("2026-09-25"), d("2026-09-25"))).toBe(0);
    expect(daysUntilExam(d("2026-09-25"), d("2026-09-24"))).toBe(1);
  });

  it("時刻が進んでいても日単位で切り上げる", () => {
    const now = new Date("2026-09-20T15:30:00Z");
    expect(daysUntilExam(d("2026-09-25"), now)).toBe(5);
  });
});

describe("planWeeks", () => {
  it("7日以内は1週", () => {
    expect(planWeeks(d("2026-09-25"), d("2026-09-22"))).toBe(1); // 3日
    expect(planWeeks(d("2026-09-25"), d("2026-09-18"))).toBe(1); // 7日
  });

  it("8日で2週になる（切り上げ境界）", () => {
    expect(planWeeks(d("2026-09-25"), d("2026-09-17"))).toBe(2);
  });

  it("上限16週に丸める", () => {
    expect(planWeeks(d("2027-09-25"), d("2026-09-25"))).toBe(16);
  });

  it("過去日でも下限1週（呼び出し側の検証をすり抜けても壊れない）", () => {
    expect(planWeeks(d("2026-09-01"), d("2026-09-25"))).toBe(1);
  });
});

describe("minExamDateStr", () => {
  it("UTC深夜0時ちょうどはリード日数ぶん先の日付", () => {
    expect(minExamDateStr(d("2026-08-30"))).toBe("2026-09-02");
  });

  it("時刻が進んでいても同じ日付（切り捨てでフォーム検証と揃う）", () => {
    expect(minExamDateStr(new Date("2026-08-30T16:01:00Z"))).toBe("2026-09-02");
  });

  it("min当日は検証を通り、前日は弾かれる（サーバー検証との整合）", () => {
    // 境界がずれるとフォームで選べるのに送信で弾かれる（またはその逆）ので回帰テストで固定する
    for (const nowIso of ["2026-08-30T00:00:00Z", "2026-08-30T16:01:00Z", "2026-08-30T23:59:59Z"]) {
      const now = new Date(nowIso);
      const min = d(minExamDateStr(now));
      expect(daysUntilExam(min, now)).toBeGreaterThanOrEqual(MIN_PLAN_LEAD_DAYS);
      const dayBefore = new Date(min.getTime() - 86400_000);
      expect(daysUntilExam(dayBefore, now)).toBeLessThan(MIN_PLAN_LEAD_DAYS);
    }
  });
});

describe("itemTargetDate", () => {
  const examDate = d("2026-10-30");
  const now = d("2026-09-23"); // 水曜（週の月曜は 2026-09-21）

  it("最終週は試験日に固定", () => {
    expect(
      itemTargetDate({ index: 4, total: 5, examDate, now }).toISOString()
    ).toBe(examDate.toISOString());
  });

  it("途中の週は今週の月曜起点で1週間ずつ後ろへ", () => {
    expect(
      itemTargetDate({ index: 0, total: 5, examDate, now })
        .toISOString()
        .slice(0, 10)
    ).toBe("2026-09-28");
    expect(
      itemTargetDate({ index: 1, total: 5, examDate, now })
        .toISOString()
        .slice(0, 10)
    ).toBe("2026-10-05");
  });
});
