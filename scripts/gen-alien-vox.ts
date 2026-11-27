// 宇宙人20種の 3D の叩き台（.vox）を、2Dの文字マップ（scripts/gen-aliens.py が原本）から起こす。
//   npx tsx scripts/gen-alien-vox.ts          → public/aliens/vox/alien-NN.vox と一覧シート docs/design/aliens-3d-sheet.png
//   npx tsx scripts/gen-alien-vox.ts --sheet  → .vox は書き換えず、今の .vox から一覧シートだけ作り直す
// 一度作ったあとは .vox が原本（MagicaVoxel で直す）。--sheet 以外で再実行すると手直しが上書きされるので注意。

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import {
  charMapToVox,
  writeVox,
  parseVox,
  prepareModel,
  modelStack,
  renderStack,
  analyze,
  flattenFace,
  rgbToHex,
  STACK_STYLE,
  type Palette,
  type Frame,
} from "../src/lib/stack";

type AlienJson = {
  common: Record<string, [number, number, number]>;
  chars: { id: string; name: string; body: [number, number, number]; sub: [number, number, number]; rows: string[] }[];
};

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/aliens/vox");
const sheetOnly = process.argv.includes("--sheet");

const data = JSON.parse(execFileSync("python3", [path.join(ROOT, "scripts/dump-aliens-json.py")]).toString()) as AlienJson;

export const alienPalette = (body: [number, number, number], sub: [number, number, number], c: AlienJson["common"]): Palette => [
  null,
  rgbToHex(body),
  rgbToHex(sub),
  rgbToHex(c.y),
  STACK_STYLE.line,
  rgbToHex(c.w),
  rgbToHex(c.p),
  rgbToHex(c.m),
];

mkdirSync(OUT, { recursive: true });
const frames: Frame[][] = [];
for (const ch of data.chars) {
  const file = path.join(OUT, `alien-${ch.id}.vox`);
  if (!sheetOnly || !existsSync(file)) {
    const vox = charMapToVox(ch.rows, {
      colors: { b: 1, s: 2, y: 3, k: 4, w: 5, p: 6, m: 7 },
      outline: "k",
      facePaint: ["w", "p", "m"],
      fill: 1,
    });
    flattenFace(vox, analyze(vox, false));
    writeFileSync(file, writeVox(vox, alienPalette(ch.body, ch.sub, data.common)));
  }
  const { vox, palette } = parseVox(readFileSync(file));
  const m = prepareModel(vox, palette, { legs: false });
  frames.push([
    renderStack(modelStack(m, -1, "n"), { dir: 0 }),
    renderStack(modelStack(m, -1, "n"), { dir: 1 }),
    renderStack(modelStack(m, -1, "n"), { dir: 2 }),
    renderStack(modelStack(m, -1, "s"), { dir: 0 }),
  ]);
}
console.log(sheetOnly ? "sheet only" : `wrote ${data.chars.length} .vox → ${path.relative(ROOT, OUT)}`);

// ---- 一覧シート（5列×4行。各キャラ: 正面・斜め・横・笑顔） ----
const S = 4,
  cellW = 34,
  cellH = 40,
  pad = 6,
  cols = 5;
const blockW = cellW * 4 + pad,
  blockH = cellH + pad;
const W = (cols * blockW + pad) * S,
  H = (Math.ceil(frames.length / cols) * blockH + pad) * S;
const img = new Uint32Array(W * H).fill(0xfff4e7d7); // 方眼紙ブルー #d7e7f4
frames.forEach((fs, n) => {
  const bx = pad + (n % cols) * blockW,
    by = pad + Math.floor(n / cols) * blockH;
  fs.forEach((f, j) => {
    const ox = bx + j * cellW + Math.floor((cellW - f.w) / 2),
      oy = by + cellH - f.h;
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
writeFileSync(path.join(ROOT, "docs/design/aliens-3d-sheet.png"), png(img, W, H));

function png(px: Uint32Array, w: number, h: number) {
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
