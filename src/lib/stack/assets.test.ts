// 3D の原本（.vox）の抜けを防ぐガード。キャラの文字マップを足したら .vox も起こすこと
//   npx tsx scripts/gen-charmap-vox.ts（アバター・NPC） / npx tsx scripts/gen-alien-vox.ts（宇宙人） / npx tsx scripts/gen-stage-vox.ts（ホームの舞台）
//   npx tsx scripts/gen-png-vox.ts（ペット・ダンジョンの敵。PNG から起こす） / npx tsx scripts/gen-furniture-vox.ts（おかいもの家具）
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseVox } from "./vox-file";
import { prepareModel, modelStack } from "./anim";
import { renderStack, frameBounds } from "./render";
import { AVATAR_FIT, AVATAR_SPRITES } from "@/components/pixel-avatar-data";
import { NPC_SPRITES } from "@/app/genba/npc-sprite-data";
import { ALIEN_COUNT } from "@/components/loading-alien";
import { HOME_STAGE } from "@/lib/home/stage";
import { PET_SPECIES } from "@/lib/pets/species";
import { MONSTERS } from "@/lib/dungeon/content";
import { petVoxSrc, enemyVoxSrc } from "./assets";
import { SHOP_ITEMS } from "@/lib/shop/content";
import { furnitureVoxSrc } from "@/lib/home/living3d";

const pub = (p: string) => path.join(process.cwd(), "public", p);
const ok = (p: string) => existsSync(pub(p)) && parseVox(readFileSync(pub(p))).vox.count() > 0;

describe("キャラの .vox がそろっている", () => {
  it("アバター（進化段階すべて）", () => {
    for (const id of Object.keys(AVATAR_SPRITES)) expect(ok(`stack/avatar/${id}.vox`), id).toBe(true);
  });
  it("げんばNPC", () => {
    for (const id of Object.keys(NPC_SPRITES)) expect(ok(`stack/npc/${id}.vox`), id).toBe(true);
  });
  it("宇宙人", () => {
    for (let i = 1; i <= ALIEN_COUNT; i++) expect(ok(`aliens/vox/alien-${String(i).padStart(2, "0")}.vox`), String(i)).toBe(true);
  });
  it("ペット（支給の PNG ごとに 1 つ）", () => {
    for (const s of PET_SPECIES) expect(ok(petVoxSrc(s.id).slice(1)), s.id).toBe(true);
  });
  it("おかいもの家具（マイホームの箱庭）", () => {
    for (const i of SHOP_ITEMS.filter((i) => !i.expand)) expect(ok(furnitureVoxSrc(i.id).slice(1)), i.id).toBe(true);
  });
  it("ダンジョンの敵", () => {
    for (const m of MONSTERS) expect(ok(enemyVoxSrc(m.sprite).slice(1)), m.sprite).toBe(true);
  });
  it("ホームの舞台（地面と小道具）", () => {
    for (const src of [HOME_STAGE.ground, ...HOME_STAGE.props.map((p) => p.src)]) expect(ok(src.replace(/^\//, "")), src).toBe(true);
  });
});

describe("アバターの顔（まばたき・笑顔は目を見つけて描き換える）", () => {
  const face = (id: string) => {
    const { vox, palette } = parseVox(readFileSync(pub(`stack/avatar/${id}.vox`)));
    return prepareModel(vox, palette, { legs: false }).face;
  };
  it("卵には目が無い（ひびや模様を目と取り違えない）", () => {
    for (const id of ["egg", "goldegg"]) expect(face(id).eyes, id).toBeNull();
  });
  it("卵以外は 2 ドット幅の目が左右に1つずつ見つかる（帽子・帯の線を目と取り違えない）", () => {
    for (const id of Object.keys(AVATAR_SPRITES).filter((s) => !s.endsWith("egg"))) {
      const eyes = face(id).eyes;
      if (!eyes) throw new Error(`${id}: 目が見つからない`);
      for (const e of eyes) expect(e.x1 - e.x0, id).toBe(1);
      expect(Math.abs(eyes[0].cx + eyes[1].cx - 19), id).toBeLessThan(1); // 左右対称
    }
  });
  it("どの段階も正面の絵が拡大率の基準（AVATAR_FIT）に収まる（枠からはみ出さない）", () => {
    for (const id of Object.keys(AVATAR_SPRITES)) {
      const { vox, palette } = parseVox(readFileSync(pub(`stack/avatar/${id}.vox`)));
      const b = frameBounds(renderStack(modelStack(prepareModel(vox, palette, { legs: false })), { dir: 0 }));
      if (!b) throw new Error(id);
      expect(Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1), id).toBeLessThanOrEqual(AVATAR_FIT);
    }
  });
});
