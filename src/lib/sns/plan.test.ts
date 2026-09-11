import { describe, expect, it } from "vitest";
import { PET_SPECIES } from "@/lib/pets/species";
import { GADGETS } from "@/lib/dungeon/content";
import { SHOP_ITEMS } from "@/lib/shop/content";
import { WALK_ITEMS } from "@/lib/walk/items";
import { PALETTES } from "@/lib/palettes";
import { BIOME_JA } from "@/lib/walk/world";
import { LIVING_ZONES } from "@/lib/home/living";
import {
  BASE_BIOMES,
  LIVING_STOW_AREA,
  SNS_SCENE_IDS,
  dayIndexOf,
  jstDateKey,
  planDay,
  rngFor,
  sceneForDay,
} from "./plan";

const day = (i: number) => new Date(Date.UTC(2026, 8, 12) + i * 86400_000).toISOString().slice(0, 10);

describe("sns plan", () => {
  it("jstDateKey は JST で日付が変わる", () => {
    expect(jstDateKey(new Date("2026-09-10T14:59:00Z"))).toBe("2026-09-10");
    expect(jstDateKey(new Date("2026-09-10T15:00:00Z"))).toBe("2026-09-11");
    expect(dayIndexOf("2026-09-11")).toBe(dayIndexOf("2026-09-10")! + 1);
    expect(dayIndexOf("run-123")).toBeNull();
  });

  it("同じ seed なら同じ条件（撮り直しても同じ絵）", () => {
    expect(planDay("2026-09-12")).toEqual(planDay("2026-09-12"));
    expect(rngFor("a", "x").next()).toBe(rngFor("a", "x").next());
    expect(rngFor("a", "x").next()).not.toBe(rngFor("a", "y").next());
  });

  it("連続した日で同じシーン・同じパレットが続かず、どの9日間にも全シーンが出る", () => {
    const start = dayIndexOf("2026-09-12")!;
    const n = SNS_SCENE_IDS.length;
    for (let i = 0; i < 730; i++) {
      const d = start + i;
      expect(sceneForDay(d + 1), `day ${i}`).not.toBe(sceneForDay(d));
      expect(planDay(day(i + 1)).palette, `day ${i}`).not.toBe(planDay(day(i)).palette);
      const window = new Set(Array.from({ length: n }, (_, k) => sceneForDay(d + k)));
      expect(window.size).toBe(n);
    }
  });

  it("シーン×パレットの組み合わせは 45 日で一巡する（同じ見た目の日が長く空く）", () => {
    const combos = new Set(Array.from({ length: 45 }, (_, i) => `${planDay(day(i)).scene}/${planDay(day(i)).palette}`));
    expect(combos.size).toBe(SNS_SCENE_IDS.length * PALETTES.length);
  });

  it("日が変われば中身も変わる（シーン以外の条件も日替わり）", () => {
    const plans = Array.from({ length: 30 }, (_, i) => planDay(day(i)));
    const distinct = (f: (p: (typeof plans)[number]) => unknown) => new Set(plans.map((p) => JSON.stringify(f(p)))).size;
    expect(distinct((p) => p.pets)).toBeGreaterThan(20);
    expect(distinct((p) => p.furniture)).toBeGreaterThan(20);
    expect(distinct((p) => p.walk.biome)).toBeGreaterThan(4);
    expect(distinct((p) => p.walk.weather)).toBeGreaterThan(2);
    expect(distinct((p) => p.walk.time)).toBeGreaterThan(2);
  });

  it("条件はすべて実在するマスタの id（DBに置けない値を作らない）", () => {
    for (let i = 0; i < 120; i++) {
      const p = planDay(day(i));
      expect(PALETTES.some((x) => x.id === p.palette)).toBe(true);
      expect(p.pets.length).toBeGreaterThanOrEqual(1);
      for (const pet of p.pets) expect(PET_SPECIES.some((s) => s.id === pet.speciesId)).toBe(true);
      // 仲良し度は降順・重複なし（おさんぽで先頭に来る子が一意に決まる）
      for (let k = 1; k < p.pets.length; k++) expect(p.pets[k].affection).toBeLessThan(p.pets[k - 1].affection);
      for (const g of p.gadgets) expect(GADGETS.some((x) => x.id === g)).toBe(true);
      for (const f of p.furniture) {
        const item = SHOP_ITEMS.find((x) => x.id === f.itemId);
        expect(item, f.itemId).toBeTruthy();
        expect(item!.expand).toBeFalsy();
        // ゾーン内に置く・床の家具は右下の「しまう」箱に重ねない
        const [lo, hi] = LIVING_ZONES[item!.zone].y;
        expect(f.y).toBeGreaterThanOrEqual(lo);
        expect(f.y).toBeLessThanOrEqual(hi);
        if (item!.zone === "floor") expect(f.x >= LIVING_STOW_AREA.xMin && f.y >= LIVING_STOW_AREA.yMin).toBe(false);
      }
      for (const w of p.walk.items) expect(WALK_ITEMS.some((x) => x.id === w)).toBe(true);
      expect(BIOME_JA[p.walk.biome]).toBeTruthy();
      // 行き先は通常ビオームか、持っているカギで解放された行き先だけ（?biome= で辿り着ける）
      const unlocked = p.walk.items.map((id) => WALK_ITEMS.find((x) => x.id === id)!.unlocksBiome);
      expect(BASE_BIOMES.includes(p.walk.biome) || unlocked.includes(p.walk.biome)).toBe(true);
      if (p.scene === "visitor") {
        expect(p.visitorSpeciesId).not.toBeNull();
        expect(p.pets.some((x) => x.speciesId === p.visitorSpeciesId)).toBe(false);
      } else {
        expect(p.visitorSpeciesId).toBeNull();
      }
    }
  });

  it("シーン指定と任意 seed", () => {
    expect(planDay("2026-09-12", "walk").scene).toBe("walk");
    expect(planDay("2026-09-12", "nope").scene).toBe(planDay("2026-09-12").scene);
    expect(SNS_SCENE_IDS).toContain(planDay("run-34559157629").scene);
  });
});
