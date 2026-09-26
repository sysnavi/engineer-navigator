import { describe, expect, it } from "vitest";
import { petLine } from "./mutter";

describe("petLine", () => {
  const personalities = ["friendly", "tsun", "shy", "pace"] as const;

  it("どの性格・回数でも空でないひとことを返す", () => {
    for (const p of personalities) {
      for (const n of [1, 2, 5, 6, 30]) {
        expect(petLine(p, n).length).toBeGreaterThan(0);
      }
    }
  });

  it("直前と同じひとことは続けて出さない", () => {
    for (const p of personalities) {
      let prev: string | undefined;
      for (let i = 0; i < 50; i++) {
        const line = petLine(p, 3, prev);
        expect(line).not.toBe(prev);
        prev = line;
      }
    }
  });
});
