// MagicaVoxel の .vox（版 150）の読み書き。複数モデルや nTRN などの付属チャンクは読み飛ばし、最初のモデルだけを使う。
// 向き: .vox の Y はこのライブラリの奥行き y を反転したもの（このライブラリの「手前」が .vox の -Y 側）。Z は上。

import { Vox, hexToRgb, rgbToHex, type Palette } from "./vox";

export function writeVox(v: Vox, pal: Palette): Uint8Array {
  const pts: number[] = [];
  for (let z = 0; z < v.h; z++)
    for (let y = 0; y < v.d; y++)
      for (let x = 0; x < v.w; x++) {
        const c = v.get(x, y, z);
        if (c) pts.push(x, v.d - 1 - y, z, c);
      }
  const n = pts.length / 4;
  const sizeLen = 12,
    xyziLen = 4 + pts.length,
    rgbaLen = 1024;
  const children = 12 + sizeLen + (12 + xyziLen) + (12 + rgbaLen);
  const buf = new ArrayBuffer(8 + 12 + children);
  const dv = new DataView(buf),
    u8 = new Uint8Array(buf);
  let p = 0;
  const id = (t: string) => {
    for (let i = 0; i < 4; i++) u8[p++] = t.charCodeAt(i);
  };
  const i32 = (x: number) => {
    dv.setInt32(p, x, true);
    p += 4;
  };
  id("VOX ");
  i32(150);
  id("MAIN");
  i32(0);
  i32(children);
  id("SIZE");
  i32(sizeLen);
  i32(0);
  i32(v.w);
  i32(v.d);
  i32(v.h);
  id("XYZI");
  i32(xyziLen);
  i32(0);
  i32(n);
  u8.set(pts, p);
  p += pts.length;
  id("RGBA");
  i32(rgbaLen);
  i32(0);
  for (let i = 0; i < 256; i++) {
    const h = pal[i + 1];
    const [r, g, b] = h ? hexToRgb(h) : [200, 200, 200];
    u8[p++] = r;
    u8[p++] = g;
    u8[p++] = b;
    u8[p++] = 255;
  }
  return u8;
}

export function parseVox(data: ArrayBuffer | Uint8Array): { vox: Vox; palette: Palette } {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = (p: number) => String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]);
  if (u8.length < 20 || tag(0) !== "VOX ") throw new Error("not a .vox file");
  let p = 20;
  let size: [number, number, number] | null = null;
  let pts: Uint8Array | null = null;
  let palette: Palette | null = null;
  while (p + 12 <= u8.length) {
    const t = tag(p),
      n = dv.getInt32(p + 4, true),
      m = dv.getInt32(p + 8, true),
      q = p + 12;
    if (t === "SIZE" && !size) size = [dv.getInt32(q, true), dv.getInt32(q + 4, true), dv.getInt32(q + 8, true)];
    else if (t === "XYZI" && !pts) {
      const k = dv.getInt32(q, true);
      pts = u8.subarray(q + 4, q + 4 + k * 4);
    } else if (t === "RGBA") {
      palette = [null];
      for (let i = 0; i < 255; i++) palette.push(rgbToHex([u8[q + i * 4], u8[q + i * 4 + 1], u8[q + i * 4 + 2]]));
    }
    p = q + n + m;
  }
  if (!size || !pts) throw new Error(".vox has no model");
  if (!palette) {
    // RGBA が無い .vox は MagicaVoxel の既定パレット。ここでは番号ごとに見分けのつく色で代用する
    palette = [null];
    for (let i = 1; i < 256; i++) palette.push(rgbToHex([(i * 97) & 255, (i * 57) & 255, (i * 151) & 255]));
  }
  const vox = new Vox(size[0], size[1], size[2]);
  for (let i = 0; i < pts.length; i += 4) vox.set(pts[i], size[1] - 1 - pts[i + 1], pts[i + 2], pts[i + 3]);
  return { vox, palette };
}
