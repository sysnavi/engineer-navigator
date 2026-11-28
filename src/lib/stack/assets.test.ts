// 3D の原本（.vox）の抜けを防ぐガード。キャラの文字マップを足したら .vox も起こすこと
//   npx tsx scripts/gen-charmap-vox.ts（アバター・NPC） / npx tsx scripts/gen-alien-vox.ts（宇宙人） / npx tsx scripts/gen-stage-vox.ts（ホームの舞台）
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseVox } from "./vox-file";
import { AVATAR_SPRITES } from "@/components/pixel-avatar-data";
import { NPC_SPRITES } from "@/app/genba/npc-sprite-data";
import { ALIEN_COUNT } from "@/components/loading-alien";
import { HOME_STAGE } from "@/lib/home/stage";

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
  it("ホームの舞台（地面と小道具）", () => {
    for (const src of [HOME_STAGE.ground, ...HOME_STAGE.props.map((p) => p.src)]) expect(ok(src.replace(/^\//, "")), src).toBe(true);
  });
});
