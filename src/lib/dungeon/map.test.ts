import { describe, expect, it } from "vitest";
import { generateFloor, distances, isOpen, cellKey, findEvent, markSeen, DIRS } from "./map";

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateFloor（迷路）", () => {
  it("同じシードなら同じ迷路になる", () => {
    const a = generateFloor({ rng: seeded(7), boss: false, firstDive: false });
    const b = generateFloor({ rng: seeded(7), boss: false, firstDive: false });
    expect(a).toEqual(b);
  });

  it("入口 (1,1) は通路で、全ての通路が入口から到達できる", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = generateFloor({ rng: seeded(seed), boss: false, firstDive: false });
      expect(isOpen(m, 1, 1)).toBe(true);
      const d = distances(m);
      for (let y = 0; y < m.n; y++) {
        for (let x = 0; x < m.n; x++) {
          if (isOpen(m, x, y)) expect(d[y][x]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("階段は入口から最も遠いマスにあり、イベントは入口から2歩以上離れている", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = generateFloor({ rng: seeded(seed), boss: false, firstDive: false });
      const d = distances(m);
      const [sx, sy] = m.stairs;
      expect(findEvent(m, sx, sy)).toBe("STAIRS");
      const maxD = Math.max(...d.flat());
      expect(d[sy][sx]).toBe(maxD);
      for (const [key, kind] of Object.entries(m.events)) {
        const [x, y] = key.split(",").map(Number);
        expect(isOpen(m, x, y)).toBe(true);
        if (kind !== "STAIRS") expect(d[y][x]).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("遭遇2・宝箱1・休憩1 は必ず置かれる（罠は半分の確率）", () => {
    const m = generateFloor({ rng: seeded(3), boss: false, firstDive: false });
    const kinds = Object.values(m.events);
    expect(kinds.filter((k) => k === "ENCOUNTER").length).toBe(2);
    expect(kinds.filter((k) => k === "TREASURE").length).toBe(1);
    expect(kinds.filter((k) => k === "REST").length).toBe(1);
  });

  it("初回の潜行は入口の隣に宝箱が確定で置かれる", () => {
    const m = generateFloor({ rng: seeded(5), boss: false, firstDive: true });
    const next = DIRS.map(([dx, dy]) => [1 + dx, 1 + dy]).filter(([x, y]) => isOpen(m, x, y));
    expect(next.some(([x, y]) => findEvent(m, x, y) === "TREASURE")).toBe(true);
  });

  it("ボスは階段に隣接するマスに置かれる", () => {
    const m = generateFloor({ rng: seeded(9), boss: true, firstDive: false });
    const [sx, sy] = m.stairs;
    const bossKeys = Object.entries(m.events).filter(([, k]) => k === "BOSS").map(([k]) => k);
    expect(bossKeys.length).toBe(1);
    const adjacent = DIRS.map(([dx, dy]) => cellKey(sx + dx, sy + dy));
    expect(adjacent).toContain(bossKeys[0]);
  });

  it("markSeen は自分と隣接4マスを見たことにする", () => {
    const m = generateFloor({ rng: seeded(1), boss: false, firstDive: false });
    const after = markSeen({ ...m, seen: [] }, 3, 3);
    expect(after.seen).toEqual(expect.arrayContaining(["3,3", "3,2", "4,3", "3,4", "2,3"]));
    expect(after.seen.length).toBe(5);
  });
});
