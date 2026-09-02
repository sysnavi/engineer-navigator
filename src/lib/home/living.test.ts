import { describe, expect, it } from "vitest";
import { clampFurniture, petAnchorFor, roomWidthFactor } from "./living";

describe("roomWidthFactor", () => {
  it("レベル0〜2で 1.0 / 1.5 / 2.0 になる", () => {
    expect(roomWidthFactor(0)).toBe(1);
    expect(roomWidthFactor(1)).toBe(1.5);
    expect(roomWidthFactor(2)).toBe(2);
  });

  it("範囲外はクランプする（負値=1・上限超え=2.0）", () => {
    expect(roomWidthFactor(-1)).toBe(1);
    expect(roomWidthFactor(99)).toBe(2);
  });
});

describe("clampFurniture", () => {
  // 拡張は「キャンバス自体が広がる」方式なので、クランプ範囲はレベルに依存しない。
  // この回帰テストでその前提を固定する
  it("床の x は [5, 95] にクランプされる（レベル非依存）", () => {
    const item = { zone: "floor" as const };
    expect(clampFurniture(item, -10, 66).x).toBe(5);
    expect(clampFurniture(item, 120, 66).x).toBe(95);
    expect(clampFurniture(item, 50, 66).x).toBe(50);
  });

  it("棚の x は近いほうのセグメントに吸着する", () => {
    const item = { zone: "shelf" as const };
    expect(clampFurniture(item, 2, 24).x).toBe(9); // 左セグメント[9,36]の左端
    expect(clampFurniture(item, 50, 24).x).toBe(36); // 中央は近いほうの端へ
    expect(clampFurniture(item, 98, 24).x).toBe(91); // 右セグメント[64,91]の右端
  });
});

describe("petAnchorFor の widthFactor", () => {
  const floorItem = { size: 10, zone: "floor" as const };

  it("watch（床）の x オフセットは widthFactor で割られる（W=2 で半分）", () => {
    const w1 = petAnchorFor("watch", floorItem, 50, 66, 1);
    const w2 = petAnchorFor("watch", floorItem, 50, 66, 2);
    expect(50 - w2.x).toBeCloseTo((50 - w1.x) / 2);
  });

  it("y はキャンバス高さ基準なので widthFactor に依存しない", () => {
    const w1 = petAnchorFor("watch", floorItem, 50, 66, 1);
    const w2 = petAnchorFor("watch", floorItem, 50, 66, 2);
    expect(w2.y).toBe(w1.y);
    // 他の kind（xオフセットなし）も倍率で変わらない
    expect(petAnchorFor("sleep", floorItem, 50, 66, 2)).toEqual(
      petAnchorFor("sleep", floorItem, 50, 66, 1)
    );
  });

  it("watch（棚・壁）は真下の床から見上げる位置のまま", () => {
    const shelfItem = { size: 7, zone: "shelf" as const };
    expect(petAnchorFor("watch", shelfItem, 20, 24, 2)).toEqual({
      x: 20,
      y: 56,
      scale: 1,
      behind: false,
    });
  });

  it("省略時は widthFactor=1 として従来と同じ位置を返す", () => {
    expect(petAnchorFor("watch", floorItem, 50, 66)).toEqual(
      petAnchorFor("watch", floorItem, 50, 66, 1)
    );
  });
});
