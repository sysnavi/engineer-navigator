import { describe, expect, it } from "vitest";
import { dayNumber, parseChoice, pickIndex } from "./welcome-quiz";

describe("dayNumber", () => {
  it("同じ日なら時刻が違っても同じ番号（日替わりの境目はローカル0時）", () => {
    const morning = new Date(2026, 8, 16, 0, 5);
    const night = new Date(2026, 8, 16, 23, 55);
    expect(dayNumber(morning)).toBe(dayNumber(night));
    expect(dayNumber(new Date(2026, 8, 17, 0, 0))).toBe(dayNumber(morning) + 1);
  });
});

describe("pickIndex", () => {
  it("プール内に収まり、日付が進むと巡回する", () => {
    expect(pickIndex(0, 3)).toBe(0);
    expect(pickIndex(4, 3)).toBe(1);
    expect(pickIndex(-1, 3)).toBe(2);
  });
  it("プールが空なら -1", () => {
    expect(pickIndex(10, 0)).toBe(-1);
  });
});

describe("parseChoice", () => {
  it("0〜size-1 の整数だけ通す", () => {
    expect(parseChoice("0", 4)).toBe(0);
    expect(parseChoice("3", 4)).toBe(3);
    expect(parseChoice("4", 4)).toBeNull();
    expect(parseChoice("-1", 4)).toBeNull();
    expect(parseChoice("1.5", 4)).toBeNull();
    expect(parseChoice("abc", 4)).toBeNull();
    expect(parseChoice("", 4)).toBeNull();
    expect(parseChoice(undefined, 4)).toBeNull();
  });
});
