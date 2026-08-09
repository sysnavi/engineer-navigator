import { describe, expect, it } from "vitest";
import { formatWeek, mondayOf } from "./week";

// weekStart はUTC日付として保存する決まり（week.ts 冒頭のコメント参照）。
// ここが1日ずれると週報の upsert キーが割れて二重提出になるため、境界を固定する。

describe("mondayOf", () => {
  it("週の途中（水曜）はその週の月曜を返す", () => {
    expect(mondayOf(new Date(2026, 7, 5)).toISOString()).toBe(
      "2026-08-03T00:00:00.000Z"
    );
  });

  it("月曜はその日自身を返す", () => {
    expect(mondayOf(new Date(2026, 7, 3)).toISOString()).toBe(
      "2026-08-03T00:00:00.000Z"
    );
  });

  it("日曜は前週ではなく同じ週の月曜（6日前）を返す", () => {
    expect(mondayOf(new Date(2026, 7, 9)).toISOString()).toBe(
      "2026-08-03T00:00:00.000Z"
    );
  });

  it("年をまたぐ週も正しく遡る", () => {
    expect(mondayOf(new Date(2026, 0, 1)).toISOString()).toBe(
      "2025-12-29T00:00:00.000Z"
    );
  });
});

describe("formatWeek", () => {
  it("月曜〜金曜の表示になる", () => {
    expect(formatWeek(new Date(Date.UTC(2026, 7, 3)))).toBe(
      "2026年 8/3〜8/7"
    );
  });

  it("月をまたぐ週も月/日で表示する", () => {
    expect(formatWeek(new Date(Date.UTC(2026, 6, 27)))).toBe(
      "2026年 7/27〜7/31"
    );
  });
});
