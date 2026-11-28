// ホームの舞台（キャラが住む小島）の小道具の 3D（.vox）を起こす。
//   npx tsx scripts/gen-stage-vox.ts          → public/stack/stage/*.vox と一覧シート
//   npx tsx scripts/gen-stage-vox.ts --sheet  → .vox は書き換えず、今の .vox から一覧シートだけ作り直す
// 形は試作 docs/design/ui3d-proto.html（A 舞台）と同じ。一度作ったあとは .vox が原本（MagicaVoxel で直す）。
// --sheet 以外で再実行すると手直しが上書きされるので注意。並べ方は src/lib/home/stage.ts。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Vox,
  writeVox,
  parseVox,
  bake,
  renderStack,
  type Palette,
  type Frame,
} from "../src/lib/stack";
import { contactSheet } from "./lib/png";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/stack/stage");
const sheetOnly = process.argv.includes("--sheet");

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 草の小島（半径 R）。上面は z=4、花は z=5 */
function island(R: number): [Vox, Palette] {
  const S = 2 * R + 6,
    c = S / 2,
    v = new Vox(S, S, 6),
    rnd = rng(R);
  const taper = [R * 0.3, R * 0.16, R * 0.06, 1, 0];
  for (let z = 0; z < 5; z++)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - c,
          dy = y + 0.5 - c,
          d = Math.hypot(dx, dy),
          a = Math.atan2(dy, dx);
        if (d > R + 1.6 * Math.sin(3 * a) + Math.sin(5 * a + 1) - taper[z])
          continue;
        if (z < 4) v.set(x, y, z, z < 2 ? 3 : 2);
        else
          v.set(
            x,
            y,
            z,
            Math.sin(x * 0.5) + Math.sin(y * 0.45 + x * 0.2) > 0.5 ? 4 : 1,
          );
      }
  for (let i = 0; i < (S * S) / 9; i++) {
    const x = (rnd() * S) | 0,
      y = (rnd() * S) | 0,
      t = v.get(x, y, 4);
    if (t !== 1 && t !== 4) continue;
    v.set(x, y, 5, rnd() < 0.5 ? 6 : [7, 8, 9][(rnd() * 3) | 0], 1);
  }
  return [
    v,
    [
      null,
      "#86d672",
      "#c08a5a",
      "#9a6a45",
      "#72c460",
      "#f3dcaa",
      "#5fae4f",
      "#ff9ec4",
      "#ffe066",
      "#ffffff",
    ],
  ];
}

function tree(seed: number): [Vox, Palette] {
  const v = new Vox(20, 20, 32),
    R = rng(seed),
    c = 10;
  v.box(9, 9, 0, 10, 10, 12, 2);
  v.blob(c, c, 18, 9, 9, 8, 1, 2.3);
  v.blob(c, c, 25, 6, 6, 4.6, 1, 2.2);
  for (let i = 0; i < 150; i++) {
    const x = (R() * 20) | 0,
      y = (R() * 20) | 0,
      z = (12 + R() * 20) | 0;
    if (v.surface(x, y, z) && v.get(x, y, z) === 1) v.set(x, y, z, 3, 1);
  }
  return [v, [null, "#6cc65a", "#9a6a45", "#ff6b6b"]];
}

function house(): [Vox, Palette] {
  const v = new Vox(26, 22, 30);
  v.box(0, 0, 0, 25, 21, 1, 4);
  v.box(1, 2, 2, 24, 19, 13, 1);
  for (let zr = 0; zr <= 10; zr++)
    for (let y = zr; y <= 21 - zr; y++)
      for (let x = 0; x <= 25; x++) v.set(x, y, 14 + zr, (y + zr) % 3 ? 2 : 3);
  v.box(18, 6, 18, 20, 8, 27, 4);
  for (let x = 11; x <= 14; x++) for (let z = 2; z <= 8; z++) v.paint(x, z, 5);
  for (const x0 of [4, 18])
    for (let x = x0; x <= x0 + 3; x++)
      for (let z = 6; z <= 9; z++) v.paint(x, z, 7);
  return [
    v,
    [
      null,
      "#fff1d6",
      "#ff7a7a",
      "#e0585f",
      "#a8a3b8",
      "#a8693f",
      "#ffd84d",
      "#9fd8ff",
    ],
  ];
}

function mailbox(): [Vox, Palette] {
  const v = new Vox(8, 8, 15);
  v.box(3, 3, 0, 4, 4, 7, 2);
  v.box(0, 1, 8, 7, 6, 12, 1);
  v.box(1, 2, 13, 6, 5, 13, 1);
  for (let x = 2; x <= 5; x++) v.paint(x, 11, 3);
  return [v, [null, "#ff5d6c", "#8a5a40", "#fff1d6"]];
}

const PROPS: Record<string, () => [Vox, Palette]> = {
  island: () => island(24),
  house,
  tree: () => tree(2),
  mailbox,
};

mkdirSync(OUT, { recursive: true });
const rows: Frame[][] = [];
for (const [id, build] of Object.entries(PROPS)) {
  const file = path.join(OUT, `${id}.vox`);
  if (!sheetOnly || !existsSync(file)) {
    const [v, pal] = build();
    writeFileSync(file, writeVox(v, pal));
  }
  const { vox, palette } = parseVox(readFileSync(file));
  const st = bake(vox, palette);
  rows.push([0, 1, 2, 4].map((dir) => renderStack(st, { dir, pitch: 0.55 })));
}
const cell = Math.max(...rows.flat().map((f) => Math.max(f.w, f.h)));
writeFileSync(
  path.join(ROOT, "docs/design/stage-3d-sheet.png"),
  contactSheet(rows, { cols: 1, cellW: cell, cellH: cell, scale: 3 }),
);
console.log(`stage: ${rows.length}${sheetOnly ? " (sheet only)" : " .vox"}`);
