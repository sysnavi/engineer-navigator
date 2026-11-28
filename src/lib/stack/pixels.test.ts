import { describe, expect, it } from "vitest";
import { pixelsToCharMap, charMapImageToVox } from "./pixels";
import { COLOR, packRgba, type RGB } from "./vox";

// 文字マップ → 拡大した PNG 相当のピクセル（1 ドット = dot×dot）
function blowUp(rows: string[], colors: Record<string, RGB>, dot: number, pad = 0) {
  const W = (rows[0].length + pad * 2) * dot,
    H = (rows.length + pad * 2) * dot;
  const px = new Uint32Array(W * H);
  rows.forEach((s, r) =>
    [...s].forEach((ch, c) => {
      if (ch === ".") return;
      for (let y = 0; y < dot; y++)
        for (let x = 0; x < dot; x++) px[((r + pad) * dot + y) * W + (c + pad) * dot + x] = packRgba(colors[ch]);
    }),
  );
  return { px, w: W, h: H };
}

const SLIME = ["..kkkk..", ".kggggk.", "kgkggkgk", "kgggwggk", "kggggggk", ".kkkkkk."];
const COLORS: Record<string, RGB> = { k: [26, 26, 30], g: [120, 200, 100], w: [250, 250, 250] };

describe("ドット絵の PNG → 文字マップ", () => {
  it("1 ドットの大きさを見つけて元の文字マップに戻す（まわりの空きは落とす）", () => {
    const { px, w, h } = blowUp(SLIME, COLORS, 24, 2);
    const img = pixelsToCharMap(px, w, h);
    expect(img.dot).toBe(24);
    expect(img.rows.length).toBe(SLIME.length);
    expect(img.rows.map((s) => s.replace(/[^.k]/g, "x"))).toEqual(SLIME.map((s) => s.replace(/[^.k]/g, "x")));
  });

  it("一番多い色が体、小さい白は目の光（正面だけ）、黒は線", () => {
    const { px, w, h } = blowUp(SLIME, COLORS, 12);
    const { vox, palette } = charMapImageToVox(pixelsToCharMap(px, w, h));
    expect(palette[COLOR.body]).toBe("#78c864");
    expect(palette[COLOR.eyeLight]).toBe("#fafafa");
    expect(palette[COLOR.line]).toBe("#1a1a1e");
    // 白は正面の面にだけある
    let white = 0;
    for (let i = 0; i < vox.c.length; i++) if (vox.c[i] === COLOR.eyeLight) white++;
    expect(white).toBe(1);
  });

  it("線の色だけの絵（点線のおばけ）は、内側を淡い体で埋めて立体にする", () => {
    const rows = ["k.k.k.k", "......." , "k.k.k.k", ".......", "k.k.k.k"];
    const { px, w, h } = blowUp(rows, COLORS, 6);
    const { vox, palette } = charMapImageToVox(pixelsToCharMap(px, w, h));
    expect(palette[COLOR.body]).toBeTruthy();
    let body = 0;
    for (let i = 0; i < vox.c.length; i++) if (vox.c[i] === COLOR.body) body++;
    expect(body).toBeGreaterThan(10);
  });
});
