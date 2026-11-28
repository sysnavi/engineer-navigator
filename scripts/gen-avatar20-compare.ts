// 検討用: アバターを 20×20 前後で描き直したらホームの舞台でどう見えるか（今の 10×10 と並べる）。
//   npx tsx scripts/gen-avatar20-compare.ts → docs/design/avatar20/*.vox（描き直し案）と compare.png・sheet.png（案だけを 4 方向）
// 描き直し案はまだ採用していない（アプリの絵は public/stack/avatar のまま）。並びは「左 = いま / 右 = 案」、
// 各段は ひよこ・いちにんまえ・マイスター。主役の左には大きさの目安として宇宙人（20×20）を立たせる。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  charMapToVox,
  writeVox,
  parseVox,
  bake,
  prepareModel,
  modelStack,
  renderStack,
  placeOf,
  depthOrder,
  hexToRgb,
  packRgba,
  type Palette,
  type Stack,
  type Frame,
} from "../src/lib/stack";
import { HOME_STAGE } from "../src/lib/home/stage";
import { contactSheet } from "./lib/png";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs/design/avatar20");
const LINE = "#12235f";

// 描き直し案（20×20）。k = 線（外周は捨てて描画側が引く）、w = 目の光、o = くちばし・足、p = ほっぺ
const CHICK = [
  "......kkkkkkkk......",
  "....kkyyyyyyyykk....",
  "...kyyyyyyyyyyyyk...",
  "..kyyyyyyyyyyyyyyk..",
  ".kyyyyyyyyyyyyyyyyk.",
  ".kyyyyyyyyyyyyyyyyk.",
  "kyyyyykwyyyykwyyyyyk",
  "kyyyyykkyyyykkyyyyyk",
  "kyyyyykkyyyykkyyyyyk",
  "kyyppyyyyooyyyyppyyk",
  "kyyppyyyooooyyyppyyk",
  "kyyyyyyyyooyyyyyyyyk",
  "kyyyyyyyyyyyyyyyyyyk",
  "kykyyyyyyyyyyyyyykyk",
  "kyykyyyyyyyyyyyykyyk",
  ".kyyyyyyyyyyyyyyyyk.",
  "..kyyyyyyyyyyyyyyk..",
  "...kkkkkkkkkkkkkk...",
  "......ko....ok......",
  ".....kkk....kkk.....",
];
const ICHININMAE = [
  "....bbkkkkkkkkbb....",
  "...bkkyyyyyyyykkb...",
  "..bkyyyyyyyyyyyykb..",
  "..bkyyyyyyyyyyyykb..",
  ".bkyyyyyyyyyyyyyykb.",
  "bbkyyyyyyyyyyyyyykbb",
  "bbkyyyykwyykwyyyykbb",
  "bbkyyyykkyykkyyyykbb",
  "bbkyyyykkyykkyyyykbb",
  ".kyppyyyyooyyyyppyk.",
  "kyyppyyyooooyyyppyyk",
  "kyyyyyyyyooyyyyyyyyk",
  "kyyyyyyyyyyyyyyyyyyk",
  "kykyyyyyyyyyyyyyykyk",
  "kyykyyyyyyyyyyyykyyk",
  ".kyyyyyyyyyyyyyyyyk.",
  "..kyyyyyyyyyyyyyyk..",
  "...kkkkkkkkkkkkkk...",
  "......ko....ok......",
  ".....kkk....kkk.....",
];
const MEISTER = [
  ".s....kkkkkkkk....s.",
  "....kkyyyyyyyykk....",
  "...kyyyyyyyyyyyyk...",
  "s.kyyyyyyyyyyyyyyk.s",
  ".kyyyyyyyyyyyyyyyyk.",
  ".kyyyyyyyyyyyyyyyyk.",
  "kyyyyykwyyyykwyyyyyk",
  "kyyyyykkyyyykkyyyyyk",
  "kyyyyykkyyyykkyyyyyk",
  "kyyppyyyyooyyyyppyyk",
  "kyyppyyyooooyyyppyyk",
  "kyyyyyyyyooyyyyyyyyk",
  "kggggggggggggggggggk",
  "kgkggggggggggggggkgk",
  "kggkggggggggggggkggk",
  ".kggggggggggggggggk.",
  "..kggggggggggggggk..",
  "...kkkkkkkkkkkkkk...",
  "......ko....ok......",
  ".....kkk....kkk.....",
];
// 色の番号: 4〜7 は顔の塗り（4 = 線・目、5 = 目の光、6 = ほっぺ）。まばたき・笑顔は目（4/5）を探して描き換える
const INDEX: Record<string, number> = { y: 1, o: 3, k: 4, w: 5, p: 6, b: 9, g: 10, s: 11 };
const PAL: Palette = [null, "#ffd84d", null, "#f59f00", LINE, "#ffffff", "#f24e9c", null, null, "#004aad", "#2e9e4f", "#c1dbff"];

const PROPOSALS: [string, string[]][] = [
  ["chick", CHICK],
  ["ichininmae", ICHININMAE],
  ["meister", MEISTER],
];

const loadStack = (p: string): Stack => {
  const { vox, palette } = parseVox(readFileSync(path.join(ROOT, "public", p)));
  return bake(vox, palette);
};
const loadModel = (file: string) => {
  const { vox, palette } = parseVox(readFileSync(file));
  return prepareModel(vox, palette, { legs: false });
};

/** ホームの舞台（スマホ幅 344×340 を 4 倍で出すのと同じ論理サイズ）を1枚描く */
function stageFrame(hero: ReturnType<typeof loadModel>, visitor: ReturnType<typeof loadModel>): Frame {
  const W = 86,
    H = 85,
    dir = 0,
    pitch = HOME_STAGE.pitch;
  const px = new Uint32Array(W * H);
  const top = hexToRgb("#cfe2f5"),
    bot = hexToRgb("#f7fbff");
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    px.fill(packRgba([0, 1, 2].map((i) => Math.round(top[i] + (bot[i] - top[i]) * t)) as [number, number, number]), y * W, (y + 1) * W);
  }
  const ox = W / 2,
    oy = H * HOME_STAGE.centerY;
  const blit = (f: Frame, x0: number, y0: number) => {
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const p = f.px[y * f.w + x];
        const X = x0 + x,
          Y = y0 + y;
        if (p >>> 24 && X >= 0 && Y >= 0 && X < W && Y < H) px[Y * W + X] = p;
      }
  };
  const gf = renderStack(loadStack(HOME_STAGE.ground.slice(1)), { dir, pitch, line: LINE });
  blit(gf, Math.round(ox - gf.pivotX), Math.round(oy - gf.pivotY));
  const items = [
    ...HOME_STAGE.props.map((p) => ({ ...p, stack: loadStack(p.src.slice(1)), follow: false })),
    { id: "visitor", x: -18, y: 12, follow: true, stack: modelStack(visitor) },
    { id: "hero", ...HOME_STAGE.player, follow: true, stack: modelStack(hero) },
  ];
  for (const it of depthOrder(items, dir, { pitch })) {
    const f = renderStack(it.stack, { dir: it.follow ? 0 : dir, pitch, line: LINE });
    const p = placeOf({ ...it, z: HOME_STAGE.groundZ }, dir, { pitch });
    blit(f, Math.round(ox + p.x - f.pivotX), Math.round(oy + p.y - f.pivotY));
  }
  return { w: W, h: H, px, pivotX: 0, pivotY: 0, solid: new Uint8Array(0) };
}

mkdirSync(OUT, { recursive: true });
const visitor = loadModel(path.join(ROOT, "public/aliens/vox/alien-03.vox"));
const rows: Frame[][] = [];
const solo: Frame[][] = [];
for (const [id, rows20] of PROPOSALS) {
  if (rows20.some((r) => r.length !== 20) || rows20.length !== 20) throw new Error(`${id}: 20×20 になっていない`);
  const colors: Record<string, number> = {};
  for (const ch of new Set(rows20.join("").replace(/\./g, ""))) colors[ch] = INDEX[ch];
  const file = path.join(OUT, `${id}.vox`);
  writeFileSync(file, writeVox(charMapToVox(rows20, { colors, outline: "k", facePaint: ["o", "p", "w"] }), PAL));
  const now = loadModel(path.join(ROOT, "public/stack/avatar", `${id}.vox`));
  const next = loadModel(file);
  rows.push([stageFrame(now, visitor), stageFrame(next, visitor)]);
  solo.push([0, 1, 2, 4].map((dir) => renderStack(modelStack(next), { dir, line: LINE })));
}
writeFileSync(path.join(OUT, "compare.png"), contactSheet(rows, { cols: 1, cellW: 90, cellH: 85, scale: 4 }));
writeFileSync(path.join(OUT, "sheet.png"), contactSheet(solo, { cols: 1, cellW: 30, cellH: 30, scale: 6 }));
console.log(`avatar20: ${rows.length} rows → docs/design/avatar20/compare.png`);
