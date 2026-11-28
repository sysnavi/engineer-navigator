// ドット絵の PNG（ペット・ダンジョンの敵）から 3D の叩き台（.vox）を起こす。変換は src/lib/stack/pixels.ts。
//   npx tsx scripts/gen-png-vox.ts                 → まだ .vox が無いペット・敵だけ起こし、一覧シートを作り直す
//   npx tsx scripts/gen-png-vox.ts pets            → ペットだけ（enemies で敵だけ）
//   npx tsx scripts/gen-png-vox.ts kiwi-slime      → その 1 体だけ（ペットの種族 ID か敵の ID）
//   npx tsx scripts/gen-png-vox.ts --force <id>    → 起こし直す（MagicaVoxel の手直しが上書きされるので注意）
//
// 置き場所: ペットは PNG の隣 public/pets/<id>/model.vox、敵は public/dungeon/vox/<id>.vox。
// 一度作ったあとは .vox が原本（MagicaVoxel で直す）。新しいペットの PNG が届いたら、
// public/pets/<id>/normal.png を置いて species.ts に 1 件足し、このスクリプトを実行するだけ。
// 一覧: docs/design/pets-3d-sheet.png・enemies-3d-sheet.png（正面・斜め・横・うしろ）

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { contactSheet, decodePng } from "./lib/png";
import {
  charMapImageToVox,
  modelStack,
  parseVox,
  pixelsToCharMap,
  prepareModel,
  renderStack,
  writeVox,
  type Frame,
} from "../src/lib/stack";
import { PET_SPECIES } from "../src/lib/pets/species";
import { petVoxSrc, enemyVoxSrc } from "../src/lib/stack/assets";

const ROOT = path.resolve(__dirname, "..");
const PUB = path.join(ROOT, "public");
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.find((a) => !a.startsWith("--"));

type Job = { group: "pets" | "enemies"; id: string; png: string; vox: string };
const jobs: Job[] = [
  ...PET_SPECIES.filter((s) => s.sprites.normal.startsWith("/pets/")).map((s) => ({
    group: "pets" as const,
    id: s.id,
    png: s.sprites.normal,
    vox: petVoxSrc(s.id),
  })),
  ...readdirSync(path.join(PUB, "dungeon"))
    .filter((f) => f.startsWith("mon-") && f.endsWith(".png"))
    .sort()
    .map((f) => {
      const id = f.replace(/\.png$/, "");
      return { group: "enemies" as const, id, png: `/dungeon/${f}`, vox: enemyVoxSrc(id) };
    }),
];

const picked = jobs.filter((j) => !only || j.group === only || j.id === only);
if (!picked.length) throw new Error(`見つからない: ${only}`);

for (const j of picked) {
  const file = path.join(PUB, j.vox);
  if (existsSync(file) && !force) continue;
  const { px, w, h } = decodePng(readFileSync(path.join(PUB, j.png)));
  const img = pixelsToCharMap(px, w, h);
  const { vox, palette } = charMapImageToVox(img);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, writeVox(vox, palette));
  console.log(`${j.vox}  ← ${j.png}（1 ドット ${img.dot}px・${img.rows[0].length}×${img.rows.length}）`);
}

// 一覧シート（そのグループの全員。今の .vox から描く）
for (const group of ["pets", "enemies"] as const) {
  if (!picked.some((j) => j.group === group)) continue;
  const frames: Frame[][] = [];
  for (const j of jobs.filter((x) => x.group === group)) {
    const file = path.join(PUB, j.vox);
    if (!existsSync(file)) continue;
    const { vox, palette } = parseVox(readFileSync(file));
    const m = prepareModel(vox, palette, { legs: false });
    frames.push([0, 1, 2, 4].map((dir) => renderStack(modelStack(m), { dir })));
  }
  const cell = Math.max(26, ...frames.flat().map((f) => Math.max(f.w, f.h)));
  writeFileSync(path.join(ROOT, `docs/design/${group}-3d-sheet.png`), contactSheet(frames, { cols: 4, cellW: cell, cellH: cell }));
  console.log(`${group}: ${frames.length} 体の一覧 → docs/design/${group}-3d-sheet.png`);
}
