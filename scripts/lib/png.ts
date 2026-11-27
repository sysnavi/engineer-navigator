// スクリプト用: ピクセル配列（0xAABBGGRR）→ PNG、と Frame の一覧シート
import { deflateSync } from "node:zlib";
import type { Frame } from "../../src/lib/stack";

export function encodePng(px: Uint32Array, w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const p = px[y * w + x],
        o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = p & 255;
      raw[o + 1] = (p >> 8) & 255;
      raw[o + 2] = (p >> 16) & 255;
      raw[o + 3] = (p >>> 24) & 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t: string, d: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** キャラごとに数コマ（向き違いなど）を横に並べ、cols キャラずつ折り返した一覧（方眼紙ブルーの背景・4倍） */
export function contactSheet(rows: Frame[][], o: { cols: number; cellW: number; cellH: number; scale?: number }): Buffer {
  const S = o.scale ?? 4,
    pad = 6,
    per = Math.max(...rows.map((r) => r.length));
  const blockW = o.cellW * per + pad,
    blockH = o.cellH + pad;
  const W = (o.cols * blockW + pad) * S,
    H = (Math.ceil(rows.length / o.cols) * blockH + pad) * S;
  const img = new Uint32Array(W * H).fill(0xfff4e7d7);
  rows.forEach((fs, n) => {
    const bx = pad + (n % o.cols) * blockW,
      by = pad + Math.floor(n / o.cols) * blockH;
    fs.forEach((f, j) => {
      const ox = bx + j * o.cellW + Math.floor((o.cellW - f.w) / 2),
        oy = by + o.cellH - f.h;
      for (let y = 0; y < f.h; y++)
        for (let x = 0; x < f.w; x++) {
          const p = f.px[y * f.w + x];
          if (!(p >>> 24)) continue;
          for (let dy = 0; dy < S; dy++)
            for (let dx = 0; dx < S; dx++) {
              const X = (ox + x) * S + dx,
                Y = (oy + y) * S + dy;
              if (X >= 0 && Y >= 0 && X < W && Y < H) img[Y * W + X] = p;
            }
        }
    });
  });
  return encodePng(img, W, H);
}
