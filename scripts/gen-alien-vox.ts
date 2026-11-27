// 宇宙人20種の 3D の叩き台（.vox）を、2Dの文字マップ（scripts/gen-aliens.py が原本）から起こす。
//   npx tsx scripts/gen-alien-vox.ts          → public/aliens/vox/alien-NN.vox と一覧シート docs/design/aliens-3d-sheet.png
//   npx tsx scripts/gen-alien-vox.ts --sheet  → .vox は書き換えず、今の .vox から一覧シートだけ作り直す
// 一度作ったあとは .vox が原本（MagicaVoxel で直す）。--sheet 以外で再実行すると手直しが上書きされるので注意。

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { contactSheet } from "./lib/png";
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

// ---- 一覧シート（5列。各キャラ: 正面・斜め・横・笑顔） ----
writeFileSync(path.join(ROOT, "docs/design/aliens-3d-sheet.png"), contactSheet(frames, { cols: 5, cellW: 34, cellH: 40 }));
