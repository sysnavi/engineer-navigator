import { describe, expect, it } from "vitest";
import { hash, matchStars, shuffled, strSeed, todayStr } from "./logic";

// げんばは「表示の再現はseedから決定的に」が設計方針（logic.ts 冒頭）。
// ハッシュ・シャッフルの決定性が崩れると、リロードのたびに案件や
// イベントが入れ替わって見えるバグになるため、ここで固定する。

describe("hash / strSeed", () => {
  it("同じ入力は常に同じ値（決定的）", () => {
    expect(hash(42)).toBe(hash(42));
    expect(strSeed("user-abc")).toBe(strSeed("user-abc"));
  });

  it("異なる入力は異なる値になる（代表ケース）", () => {
    expect(hash(1)).not.toBe(hash(2));
    expect(strSeed("user-a")).not.toBe(strSeed("user-b"));
  });

  it("常に32bit非負整数を返す", () => {
    for (const n of [0, 1, -1, 2 ** 31, 123456789]) {
      const h = hash(n);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(h)).toBe(true);
    }
  });
});

describe("shuffled", () => {
  it("同じseedなら同じ並び・要素は失わない", () => {
    const list = ["a", "b", "c", "d", "e"];
    const s1 = shuffled(list, 7);
    expect(shuffled(list, 7)).toEqual(s1);
    expect([...s1].sort()).toEqual([...list].sort());
  });

  it("元の配列を破壊しない", () => {
    const list = [1, 2, 3];
    shuffled(list, 1);
    expect(list).toEqual([1, 2, 3]);
  });
});

describe("todayStr", () => {
  it("サーバーローカル日付を YYYY-MM-DD で返す（ゼロ埋め）", () => {
    expect(todayStr(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("matchStars", () => {
  it("マッチ度0〜1を星の段階に写す（単調増加）", () => {
    let prev = matchStars(0);
    for (const m of [0.25, 0.5, 0.75, 1]) {
      const s = matchStars(m);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});
