// 文字マップでできている登場キャラ（アバター・げんばNPC）の 3D（.vox）を起こす。
//   npx tsx scripts/gen-charmap-vox.ts          → public/stack/avatar/*.vox・public/stack/npc/*.vox と一覧シート
//   npx tsx scripts/gen-charmap-vox.ts --sheet  → .vox は書き換えず、今の .vox から一覧シートだけ作り直す
//   npx tsx scripts/gen-charmap-vox.ts avatar   → アバターだけ（npc だけなら npc）
// 一度作ったあとは .vox が原本（MagicaVoxel で直す）。--sheet 以外で再実行すると手直しが上書きされるので注意。
// 色は CSS 変数（きせかえパレット）のまま表示時に解くので、.vox に入る色は既定のパレットでの見本。

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { charMapToVox, writeVox, parseVox, prepareModel, modelStack, renderStack, type Palette, type Frame } from "../src/lib/stack";
import { AVATAR_SPRITES, AVATAR_VOX_INDEX, AVATAR_VOX_PALETTE } from "../src/components/pixel-avatar-data";
import { NPC_SPRITES, NPC_VOX_INDEX, NPC_VOX_PALETTE } from "../src/app/genba/npc-sprite-data";
import { contactSheet } from "./lib/png";

const ROOT = path.resolve(__dirname, "..");
const sheetOnly = process.argv.includes("--sheet");
const only = process.argv.slice(2).find((a) => !a.startsWith("--"));

// CSS 変数の既定値（globals.css の :root）。.vox の中の見本色にだけ使う
const CSS_DEFAULTS: Record<string, string> = {
  "--ink": "#12235f",
  "--lemon": "#ffd84d",
  "--pink-hot": "#f24e9c",
  "--royal": "#004aad",
  "--good": "#2e9e4f",
  "--peri": "#c1dbff",
};
const toHex = (c: string) => {
  const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(c.trim());
  return (m ? (CSS_DEFAULTS[m[1]] ?? m[2] ?? "#888888") : c).trim().toLowerCase();
};
const paletteOf = (byIndex: Record<number, string>): Palette => {
  const p: Palette = [null];
  for (let i = 1; i < 256; i++) p.push(byIndex[i] ? toHex(byIndex[i]) : null);
  return p;
};

type Set = {
  dir: string;
  sprites: Record<string, string[]>;
  index: Record<string, number>;
  palette: Record<number, string>;
  outline: string | null;
  facePaint: string[];
};
const SETS: Set[] = [
  // アバター: k が黒ふち（外周は捨てて線は描画側が引く）。o=くちばし・p=ほっぺ・e=目の光・a=エプロンは正面の塗り
  { dir: "avatar", sprites: AVATAR_SPRITES, index: AVATAR_VOX_INDEX, palette: AVATAR_VOX_PALETTE, outline: "k", facePaint: ["o", "p", "e", "a"] },
  // NPC: 黒ふちが無い絵。k は目なので正面の塗り。w（おなか）も正面だけ
  { dir: "npc", sprites: NPC_SPRITES, index: NPC_VOX_INDEX, palette: NPC_VOX_PALETTE, outline: null, facePaint: ["k", "w"] },
];

for (const set of SETS.filter((s) => !only || s.dir === only)) {
  const out = path.join(ROOT, "public/stack", set.dir);
  mkdirSync(out, { recursive: true });
  const frames: Frame[][] = [];
  for (const [id, rows] of Object.entries(set.sprites)) {
    const file = path.join(out, `${id}.vox`);
    if (!sheetOnly || !existsSync(file)) {
      const colors: Record<string, number> = {};
      for (const ch of new Set(rows.join("").replace(/\./g, ""))) if (ch !== set.outline && set.index[ch]) colors[ch] = set.index[ch];
      const vox = charMapToVox(rows, {
        colors: set.outline ? { ...colors, [set.outline]: set.index[set.outline] } : colors,
        outline: set.outline ?? "\u0000",
        facePaint: set.facePaint,
      });
      writeFileSync(file, writeVox(vox, paletteOf(set.palette)));
    }
    const { vox, palette } = parseVox(readFileSync(file));
    const m = prepareModel(vox, palette, { legs: false });
    frames.push([0, 1, 2, 4].map((dir) => renderStack(modelStack(m), { dir })));
  }
  const cell = Math.max(26, ...frames.flat().map((f) => Math.max(f.w, f.h)));
  writeFileSync(path.join(ROOT, `docs/design/${set.dir}-3d-sheet.png`), contactSheet(frames, { cols: 4, cellW: cell, cellH: cell }));
  console.log(`${set.dir}: ${frames.length}${sheetOnly ? " (sheet only)" : " .vox"}`);
}
