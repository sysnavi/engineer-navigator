// スクリプト用: ピクセル配列（0xAABBGGRR）↔ PNG、と Frame の一覧シート
import { deflateSync, inflateSync } from "node:zlib";
import type { Frame } from "../../src/lib/stack";

/** PNG → ピクセル配列（0xAABBGGRR）。8bit の RGBA / RGB、インターレースなしだけ読む（ペット・敵の支給 PNG の形式） */
export function decodePng(buf: Buffer): { px: Uint32Array; w: number; h: number } {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG ではない");
  let o = 8,
    w = 0,
    h = 0,
    ch = 4;
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o),
      type = buf.toString("ascii", o + 4, o + 8),
      d = buf.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      const depth = d[8],
        color = d[9],
        interlace = d[12];
      if (depth !== 8 || (color !== 6 && color !== 2) || interlace)
        throw new Error(`読めない PNG（bit ${depth}・色 ${color}・インターレース ${interlace}）。8bit RGBA で書き出し直す`);
      ch = color === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(d);
    else if (type === "IEND") break;
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)),
    stride = w * ch,
    out = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)],
      line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[y * stride + i - ch] : 0,
        b = y ? out[(y - 1) * stride + i] : 0,
        c = y && i >= ch ? out[(y - 1) * stride + i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + i] = v & 255;
    }
  }
  const px = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = out[i * ch],
      g = out[i * ch + 1],
      b = out[i * ch + 2],
      al = ch === 4 ? out[i * ch + 3] : 255;
    px[i] = ((al << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return { px, w, h };
}

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
