import { describe, expect, it } from "vitest";
import {
  Vox,
  bake,
  renderStack,
  project,
  hiddenMask,
  unproject,
  faceOf,
  spotPose,
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

  it("手前の絵に重なった所だけが、隠れた所になる", () => {
    const cube = new Vox(4, 4, 4);
    cube.box(0, 0, 0, 3, 3, 3, 1);
    const f = renderStack(bake(cube, [null, "#ffffff"]), { dir: 0 });
    const back = { item: "back", x0: 0, y0: 0, frame: f };
    // 重ならない
    expect(hiddenMask(back, [{ item: "far", x0: f.w + 3, y0: 0, frame: f }]).count).toBe(0);
    // 右へ 2 ずらして重ねる: 左の 2 列は見えたまま、残りは隠れる
    const { mask, count } = hiddenMask(back, [{ item: "front", x0: 2, y0: 0, frame: f }]);
    expect(count).toBeGreaterThan(0);
    for (let y = 0; y < f.h; y++) {
      expect(mask[y * f.w + 0]).toBe(0);
      expect(mask[y * f.w + 1]).toBe(0);
    }
    // 透明な所は隠れた所に数えない
    for (let i = 0; i < mask.length; i++) if (mask[i]) expect(f.px[i] >>> 24).toBeGreaterThan(0);
  });

  it("画面の点から床の点に戻せる（project の逆。8 方向・高さつき）", () => {
    for (let dir = 0; dir < 8; dir++)
      for (const p of [{ x: 10, y: -7 }, { x: -23, y: 15 }, { x: 0, y: 0 }]) {
        const s = project({ ...p, z: 3 }, dir, { pitch: 0.6 });
        const back = unproject(s.x, s.y, dir, { pitch: 0.6, z: 3 });
        expect(back.x).toBeCloseTo(p.x, 6);
        expect(back.y).toBeCloseTo(p.y, 6);
      }
  });

  it("進む向きにキャラが向く（手前へ = 0、うしろへ = 4、右へ・左へは横向き）", () => {
    expect(faceOf(0, 1)).toBe(0);
    expect(faceOf(0, -1)).toBe(4);
    expect(new Set([faceOf(1, 0), faceOf(-1, 0)])).toEqual(new Set([2, 6]));
  });

  it("家具でのくつろぎ: 寝る・座る・てっぺんは家具の上、前・横は床", () => {
    const sofa = { x: 0, y: 0, w: 20, d: 10, h: 12 };
    expect(spotPose("sit", sofa).z).toBeGreaterThan(0);
    expect(spotPose("top", sofa).z).toBe(11);
    expect(spotPose("sleep", { ...sofa, flat: true, h: 1 }).z).toBe(1);
    expect(spotPose("front", sofa)).toMatchObject({ z: 0, face: 4 });
    expect(spotPose("front", sofa).y).toBeGreaterThan(5);
    expect(spotPose("watch", sofa).x).toBeLessThan(-10);
    // 壁のものは、その前の床から見上げる
    expect(spotPose("watch", { ...sofa, onWall: true })).toMatchObject({ z: 0, face: 4 });
  });
});
