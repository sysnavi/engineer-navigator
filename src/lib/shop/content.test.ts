import { describe, expect, it } from "vitest";
import {
  collectionSeries,
  expansionBlockReason,
  expansionItems,
  expansionLevel,
  isExpansionItem,
  shopItemById,
  weeklyStock,
} from "./content";

describe("拡張キットのマスタ", () => {
  it("I→II の2段が expand 順で定義されている", () => {
    expect(expansionItems().map((i) => i.expand)).toEqual([1, 2]);
  });

  it("isExpansionItem はキットだけ true（家具は false）", () => {
    expect(isExpansionItem("living-expand-1")).toBe(true);
    expect(isExpansionItem("sofa")).toBe(false);
    expect(isExpansionItem("unknown")).toBe(false);
  });

  it("コレクション対象シリーズに kakuchou は含まれない", () => {
    expect(collectionSeries().some((s) => s.id === "kakuchou")).toBe(false);
  });
});

describe("expansionLevel", () => {
  it("未所持なら 0、Iで1、I+IIで2", () => {
    expect(expansionLevel(new Set())).toBe(0);
    expect(expansionLevel(new Set(["living-expand-1"]))).toBe(1);
    expect(expansionLevel(new Set(["living-expand-1", "living-expand-2"]))).toBe(2);
  });

  it("連番所持のみカウント（IIだけ持っていても 0）", () => {
    expect(expansionLevel(new Set(["living-expand-2"]))).toBe(0);
  });

  it("家具の所持はレベルに影響しない", () => {
    expect(expansionLevel(new Set(["sofa", "rug", "living-expand-1"]))).toBe(1);
  });
});

describe("expansionBlockReason", () => {
  const kit1 = shopItemById("living-expand-1")!;
  const kit2 = shopItemById("living-expand-2")!;

  it("キットIIはキットI未所持だとブロックされる", () => {
    expect(expansionBlockReason(kit2, new Set())).toContain(kit1.name);
    expect(expansionBlockReason(kit2, new Set(["living-expand-1"]))).toBeNull();
  });

  it("キットIと家具はいつでも買える（理由なし）", () => {
    expect(expansionBlockReason(kit1, new Set())).toBeNull();
    expect(expansionBlockReason(shopItemById("sofa")!, new Set())).toBeNull();
  });
});

describe("weeklyStock と拡張キット", () => {
  it("非ローテシリーズなので どの週でも在庫に含まれる", () => {
    for (const date of ["2026-09-01", "2026-09-08", "2027-01-04"]) {
      const stock = weeklyStock(date);
      expect(stock.has("living-expand-1")).toBe(true);
      expect(stock.has("living-expand-2")).toBe(true);
    }
  });
});
