// おかいもの家具（src/lib/shop/content.ts の 12×12 の文字マップ）から、マイホームの箱庭の 3D（.vox）を起こす。
//   npx tsx scripts/gen-furniture-vox.ts          → public/stack/furniture/<id>.vox と一覧 docs/design/furniture-3d-sheet.png
//   npx tsx scripts/gen-furniture-vox.ts --sheet  → .vox は書き換えず、一覧だけ作り直す
// 一度作ったあとは .vox が原本（MagicaVoxel で直せる）。--sheet 以外で再実行すると手直しが上書きされるので注意。
// 部屋そのもの（床・壁・窓・棚）は .vox を持たず、src/lib/home/room3d.ts がその場で起こす。方針: docs/design/myhome-3d-plan.md
//
// 起こし方:
// - 大きさ: LIVING.sav の size（ペット = 10）どうしの比を保ち、ペット 16 ボクセルに対して 8 割（箱庭は狭いので）
// - 箱もの: 正面の絵を、幅の半分くらいの奥行きでまっすぐ押し出す。線（k）は正面だけ、奥は近くの色で埋める
// - 丸いもの（植物・ランプなど）: まくらのようにふっくら押し出す
// - 壁に掛けるもの: 厚み 1 の板。床に敷くもの（ラグ・ざぶとん）: 床に寝かせる
// - 形の手直し（PROFILE）: 正面の絵だけでは奥行きが決まらないものは、行と列ごとに「奥行きのどこにあるか」を書き足す

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { contactSheet } from "./lib/png";
import { Vox, bake, charMapToVox, parseVox, renderStack, writeVox, type Frame, type Palette } from "../src/lib/stack";
import { SHOP_ITEMS, type ShopItem } from "../src/lib/shop/content";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/stack/furniture");
const sheetOnly = process.argv.includes("--sheet");

// 色（shop-sprite.tsx の色表。CSS 変数は既定の色で焼く）
const SHOP_HEX: Record<string, string> = {
  k: "#12235f",
  w: "#ffffff",
  y: "#ffd84d",
  g: "#2e9e4f",
  n: "#b08050",
  r: "#e5484d",
  b: "#004aad",
  s: "#bfe0f8",
  p: "#f24e9c",
  o: "#e8a013",
  d: "#7d5a33",
  e: "#efe8d4",
  m: "#8a8a99",
  t: "#b8d489",
};

const trim = (rows: string[]) => {
  const used = rows.filter((r) => /[^.]/.test(r));
  let l = 99,
    r = -1;
  for (const s of used) {
    l = Math.min(l, s.search(/[^.]/));
    r = Math.max(r, s.length - 1 - [...s].reverse().join("").search(/[^.]/));
  }
  return used.map((s) => s.slice(l, r + 1));
};
/** 文字マップを s 倍に（端数は最近傍） */
const scaleRows = (rows: string[], s: number) => {
  const W = Math.round(rows[0].length * s),
    H = Math.round(rows.length * s);
  return Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => rows[Math.min(rows.length - 1, Math.floor(y / s))][Math.min(rows[0].length - 1, Math.floor(x / s))]).join(""),
  );
};
const scaleOf = (item: ShopItem, rows: string[]) => Math.max(1, (item.size * 1.6 * 0.8) / trim(rows)[0].length);

/** 丸いもの（ふっくら押し出す） */
const ROUND = new Set(["plant", "lamp", "bonsai", "bigplant", "flowervase", "trophy", "birdclock"]);

/**
 * 形の手直し: 絵の中の位置（fx = 左 0〜右 1、fi = 上 0〜下 1）と文字から、奥行きのどこにあるか（0 = 奥、1 = 手前）の区間を返す。
 * 奥行きの大きさは幅 × depth
 */
type Profile = { depth: number; at: (fx: number, fi: number, ch: string) => [number, number][] };
const LEGS: [number, number][] = [
  [0, 0.15],
  [0.85, 1],
];
const PROFILE: Record<string, Profile> = {
  // ソファ: ひじかけは前から後ろまで、背もたれは奥だけ、座面は全部、脚は前と後ろ
  sofa: {
    depth: 0.6,
    at: (fx, fi, ch) => {
      if (ch === "k") return LEGS;
      if (fx < 0.2 || fx > 0.8) return [[0, 1]];
      return fi < 0.55 ? [[0, 0.3]] : [[0, 1]];
    },
  },
  // ちゃぶだい: 天板は全部、脚は前と後ろ
  chabudai: { depth: 0.7, at: (_fx, fi) => (fi > 0.65 ? LEGS : [[0, 1]]) },
  // ハンモック: 柱は細く、布は真ん中の帯
  hammock: {
    depth: 0.5,
    at: (fx) =>
      fx < 0.25 || fx > 0.75
        ? [
            [0.1, 0.25],
            [0.75, 0.9],
          ]
        : [[0.2, 0.8]],
  },
  // キャットタワー: 柱は細く、段の板は広く
  cattower: { depth: 0.8, at: (_fx, _fi, ch) => (ch === "k" ? [[0.4, 0.6]] : [[0.05, 0.95]]) },
};

function furniture(item: ShopItem): [Vox, Palette] {
  const rows = scaleRows(trim(item.sprite), scaleOf(item, item.sprite));
  const colors: Record<string, number> = {};
  const pal: Palette = [null];
  for (const ch of new Set(rows.join("").replace(/\./g, ""))) {
    colors[ch] = pal.length;
    pal.push(SHOP_HEX[ch] ?? "#888888");
  }
  const H = rows.length,
    W = rows[0].length;
  if (item.flat) {
    // ラグ・ざぶとん: 床に寝かせる（絵の上下 → 奥行き）
    const v = new Vox(W, H, 1);
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== "." && v.set(x, y, 0, colors[ch])));
    return [v, pal];
  }
  if (ROUND.has(item.id))
    return [charMapToVox(rows, { colors, outline: "\u0000", maxHalf: Math.max(2, Math.round(W / 4)) }), pal];
  const prof = PROFILE[item.id];
  const D = item.zone === "wall" ? 1 : Math.max(3, Math.round(W * (prof?.depth ?? 0.5)));
  const v = new Vox(W, D, H);
  // 線（k）は正面だけ。奥は近くの k 以外の色で埋める（横から見て紺の板にならないように）
  const at = (x: number, i: number) => rows[i]?.[x] ?? ".";
  const behind = (x: number, i: number) => {
    for (let r = 1; r < Math.max(W, H); r++)
      for (const [dx, di] of [
        [0, -r],
        [-r, 0],
        [r, 0],
        [0, r],
      ]) {
        const c = at(x + dx, i + di);
        if (c !== "." && c !== "k") return c;
      }
    return "k";
  };
  rows.forEach((r, i) =>
    [...r].forEach((ch, x) => {
      if (ch === ".") return;
      const z = H - 1 - i;
      const ranges = prof ? prof.at((x + 0.5) / W, (i + 0.5) / H, ch) : [[0, 1] as [number, number]];
      for (const [a, b] of ranges) {
        const y0 = Math.round(a * (D - 1)),
          y1 = Math.round(b * (D - 1));
        for (let y = y0; y <= y1; y++) v.set(x, y, z, colors[y === y1 || ch !== "k" ? ch : behind(x, i)]);
        // 正面（一番手前）以外の線は近くの色で埋める
        if (ch === "k") for (let y = y0; y < y1; y++) v.set(x, y, z, colors[behind(x, i)]);
      }
    }),
  );
  return [v, pal];
}

mkdirSync(OUT, { recursive: true });
const rows: Frame[][] = [];
for (const item of SHOP_ITEMS.filter((i) => !i.expand)) {
  const file = path.join(OUT, `${item.id}.vox`);
  if (!sheetOnly || !existsSync(file)) {
    const [v, pal] = furniture(item);
    writeFileSync(file, writeVox(v, pal));
  }
  const { vox, palette } = parseVox(readFileSync(file));
  const st = bake(vox, palette);
  rows.push([0, 1, 2, 4].map((dir) => renderStack(st, { dir })));
}
const cell = Math.max(26, ...rows.flat().map((f) => Math.max(f.w, f.h)));
writeFileSync(path.join(ROOT, "docs/design/furniture-3d-sheet.png"), contactSheet(rows, { cols: 4, cellW: cell, cellH: cell, scale: 3 }));
console.log(`furniture: ${rows.length}${sheetOnly ? " (sheet only)" : " .vox"}`);
