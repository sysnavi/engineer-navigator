import { describe, expect, it } from "vitest";
import {
  Vox,
  bake,
  renderStack,
  project,
  placeOf,
  turnDir,
  depthOrder,
  hitTest,
  STACK_STYLE,
} from "./index";

describe("場面の並べ方", () => {
  it("置き場所の回り方が、物の絵の回り方とそろう（8方向すべて）", () => {
    // 21×21 の板の中心から右へ 7 の所に 3×3 の目印。板ごと回したときの目印の位置と、project の位置が合う
    // （1マスだと縦につぶすときに拾われないことがある）
    const v = new Vox(21, 21, 1);
    v.box(0, 0, 0, 20, 20, 0, 1);
    v.box(16, 9, 0, 18, 11, 0, 2, 1);
    const st = bake(v, [null, "#ffffff", "#ff0000"]);
    const red = (px: number) =>
      (px & 0xff) > 200 &&
      ((px >> 8) & 0xff) < 120 &&
      ((px >> 16) & 0xff) < 120;
    for (let dir = 0; dir < STACK_STYLE.dirs; dir++) {
      const f = renderStack(st, { dir, line: null });
      let sx = 0,
        sy = 0,
        n = 0;
      for (let y = 0; y < f.h; y++)
        for (let x = 0; x < f.w; x++)
          if (f.px[y * f.w + x] >>> 24 && red(f.px[y * f.w + x])) {
            sx += x + 0.5;
            sy += y + 0.5;
            n++;
          }
      expect(n, `dir ${dir}`).toBeGreaterThan(0);
      const p = project({ x: 7, y: 0 }, dir);
      expect(Math.abs(sx / n - f.pivotX - p.x), `dir ${dir} x`).toBeLessThan(
        1.6,
      );
      expect(Math.abs(sy / n - f.pivotY - p.y), `dir ${dir} y`).toBeLessThan(
        1.6,
      );
    }
  });

  it("向きは 0..dirs-1 に収まる", () => {
    expect(turnDir(0, -1, 8)).toBe(7);
    expect(turnDir(7, 1, 8)).toBe(0);
    expect(turnDir(3, 10, 8)).toBe(5);
  });

  it("奥のものほど先に描く。回すと前後が入れ替わる", () => {
    const back = { id: "back", x: 0, y: -10 },
      front = { id: "front", x: 0, y: 10 };
    expect(depthOrder([front, back], 0).map((o) => o.id)).toEqual([
      "back",
      "front",
    ]);
    expect(depthOrder([front, back], 4).map((o) => o.id)).toEqual([
      "front",
      "back",
    ]);
  });

  it("follow のものは回しても同じ所・同じ前後に立つ", () => {
    const hero = { id: "hero", x: 0, y: 16, follow: true },
      house = { id: "house", x: -6, y: -12 };
    for (let dir = 0; dir < 8; dir++) {
      expect(depthOrder([hero, house], dir).map((o) => o.id), `dir ${dir}`).toEqual(["house", "hero"]);
      expect(placeOf(hero, dir)).toEqual(placeOf(hero, 0));
    }
  });

  it("当たり判定は手前の絵を優先し、透明な所は抜ける", () => {
    const cube = new Vox(4, 4, 4);
    cube.box(0, 0, 0, 3, 3, 3, 1);
    const st = bake(cube, [null, "#ffffff"]);
    const f = renderStack(st, { dir: 0 });
    const placed = [
      { item: "a", x0: 0, y0: 0, frame: f },
      { item: "b", x0: 2, y0: 0, frame: f },
    ];
    const cx = f.pivotX,
      cy = f.pivotY - 2;
    expect(hitTest(placed, cx + 2, cy)).toBe("b");
    expect(hitTest(placed, -5, -5)).toBeNull();
    expect(hitTest(placed, 0, 0)).toBeNull();
  });
});
