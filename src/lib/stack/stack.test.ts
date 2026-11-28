import { describe, expect, it } from "vitest";
import {
  Vox,
  writeVox,
  parseVox,
  charMapToVox,
  analyze,
  animate,
  prepareModel,
  modelStack,
  renderStack,
  frameBounds,
  bake,
  packRgba,
  hexToRgb,
  STACK_STYLE,
} from "./index";

// 小さな顔つきキャラ（目2つ・口・ほっぺ・2番の足）
function face(): Vox {
  const v = new Vox(12, 8, 14);
  v.box(4, 2, 0, 5, 5, 2, 2);
  v.box(7, 2, 0, 8, 5, 2, 2);
  v.blob(6, 4, 8, 5.5, 3.5, 5, 1, 2.6);
  for (const x0 of [3, 7]) for (let z = 8; z <= 10; z++) for (let x = x0; x <= x0 + 1; x++) v.paint(x, z, 4);
  v.paint(5, 6, 4);
  v.paint(6, 6, 4);
  v.paint(1, 7, 6);
  v.paint(10, 7, 6);
  return v;
}
const PAL = [null, "#8fe07a", "#5fb056", "#ffd84d", "#12235f", "#ffffff", "#ff8fb1", "#f24e9c"];

describe(".vox の読み書き", () => {
  it("書き出して読み戻すと同じボクセルと色になる", () => {
    const v = face();
    const { vox, palette } = parseVox(writeVox(v, PAL));
    expect([vox.w, vox.d, vox.h]).toEqual([v.w, v.d, v.h]);
    expect(Array.from(vox.c)).toEqual(Array.from(v.c));
    expect(palette.slice(1, 8)).toEqual(PAL.slice(1));
  });
  it(".vox でないデータは弾く", () => {
    expect(() => parseVox(new Uint8Array(32))).toThrow();
  });
});

describe("顔の見つけ方とコマ", () => {
  it("目2つと口、足を見つける", () => {
    const A = analyze(face(), true);
    expect(A.eyes).not.toBeNull();
    expect(A.mouth).not.toBeNull();
    expect(A.legTop).toBe(2);
  });
  it("まばたきは目のボクセルを減らし、笑顔は口を7番で塗る", () => {
    const v = face(),
      A = analyze(v, true);
    const count = (x: Vox, c: number) => Array.from(x.c).filter((n) => n === c).length;
    expect(count(animate(v, A, -1, "b", true), 4)).toBeLessThan(count(animate(v, A, -1, "n", true), 4));
    expect(count(animate(v, A, -1, "s", true), 7)).toBeGreaterThan(0);
  });
  it("足のないキャラは歩くコマで高さが変わる（縮む・伸びる）", () => {
    const v = face(),
      A = analyze(v, false);
    expect(animate(v, A, 0, "n", false).h).toBeLessThan(v.h);
    expect(animate(v, A, 1, "n", false).h).toBeGreaterThan(v.h);
  });
});

describe("描画", () => {
  it("正面の絵に線の色と体の色が入る", () => {
    const m = prepareModel(face(), PAL);
    const f = renderStack(modelStack(m), { dir: 0 });
    const px = Array.from(f.px);
    expect(px).toContain(packRgba(hexToRgb(STACK_STYLE.line)));
    expect(frameBounds(f)).not.toBeNull();
  });
  it("向きは8段に丸め、同じ向きは使い回す", () => {
    const st = bake(face(), PAL);
    const a = renderStack(st, { dir: 1 }),
      b = renderStack(st, { dir: 9 });
    expect(a).toBe(b);
  });
  it("一番手前（顔の面）を拾う：正面の絵に目の線色が出る", () => {
    const m = prepareModel(face(), PAL);
    const f = renderStack(modelStack(m), { dir: 0, line: null });
    expect(Array.from(f.px)).toContain(packRgba(hexToRgb("#12235f")));
  });
});

describe("2Dの文字マップから起こす", () => {
  const rows = [
    "....k.....",
    "....k.....",
    "..kkkkkk..",
    ".kbbbbbbk.",
    ".kbkbbkbk.",
    ".kbbbbbbk.",
    ".kbbkkbbk.",
    "..kkkkkk..",
  ];
  const v = charMapToVox(rows, { colors: { b: 1, k: 4 }, outline: "k" });
  it("外周の黒ふちは捨て、目・口と触角の棒は残す", () => {
    expect(v.get(1, v.d >> 1, 4)).toBe(0); // 左のふち
    expect(v.front(3, 3)).toBeGreaterThan(v.d >> 1); // 目は正面に出ている（4行目 = z3）
    expect(v.get(3, v.front(3, 3), 3)).toBe(4);
    expect(v.get(4, v.d >> 1, 7)).toBe(4); // 触角の棒
  });
  it("真ん中ほど厚い", () => {
    expect(v.front(5, 3)).toBeGreaterThan(v.front(2, 3));
  });
});

describe("正面の顔パーツ", () => {
  it("2ドット幅の目が、正面で2ドットのまま出る（左の列が体の色に消えない）", () => {
    const rows = [
      "..kkkkkkkk..",
      ".kyyyyyyyyk.",
      "kyyyyyyyyyyk",
      "kyykkyykkyyk",
      "kyykkyykkyyk",
      "kyyyyyyyyyyk",
      ".kyyyyyyyyk.",
      "..kkkkkkkk..",
    ];
    const v = charMapToVox(rows, { colors: { y: 1, k: 4 }, outline: "k" });
    const m = prepareModel(v, [null, "#ffd84d", null, null, "#12235f"], { legs: false });
    const f = renderStack(modelStack(m), { dir: 0, line: null });
    const ink = packRgba(hexToRgb("#12235f"));
    let best = 0;
    for (let y = 0; y < f.h; y++) {
      let n = 0;
      for (let x = 0; x < f.w; x++) if (f.px[y * f.w + x] === ink) n++;
      best = Math.max(best, n);
    }
    expect(best).toBe(4);
  });
});
