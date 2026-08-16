import { describe, expect, it } from "vitest";
import { PET_SPECIES, pickFromPool, visitablePool } from "./species";

describe("visitablePool", () => {
  it("誰も所持していなければ現役全種が候補になる", () => {
    const pool = visitablePool(new Set());
    expect(pool).toEqual(PET_SPECIES.filter((s) => !s.retired));
  });

  it("所持済みの種族は候補から外れる（同じ子が二度来ない）", () => {
    const owned = new Set(["melon-hyozaurus", "yurei-boy"]);
    const pool = visitablePool(owned);
    expect(pool.some((s) => owned.has(s.id))).toBe(false);
    expect(pool.length).toBe(
      PET_SPECIES.filter((s) => !s.retired).length - owned.size
    );
  });

  it("全種コンプすると候補は空になる", () => {
    const all = new Set(PET_SPECIES.map((s) => s.id));
    expect(visitablePool(all)).toEqual([]);
  });
});

describe("pickFromPool", () => {
  it("空プールなら null（=その日は誰も来ない）", () => {
    expect(pickFromPool([], 0.5)).toBeNull();
  });

  it("roll=0 は先頭、roll≈1 は末尾を選ぶ（重み境界）", () => {
    const pool = visitablePool(new Set());
    expect(pickFromPool(pool, 0)).toBe(pool[0]);
    expect(pickFromPool(pool, 0.999999)).toBe(pool[pool.length - 1]);
  });

  it("どの roll でも所持済み種族は選ばれない", () => {
    const owned = new Set(["melon-hyozaurus"]);
    const pool = visitablePool(owned);
    for (let i = 0; i < 100; i++) {
      const picked = pickFromPool(pool, i / 100);
      expect(picked).not.toBeNull();
      expect(owned.has(picked!.id)).toBe(false);
    }
  });
});
