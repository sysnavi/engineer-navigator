import { describe, expect, it } from "vitest";
import { fromRoom, livingLayout, livingRoomSize, toRoom, LIVING_ROOM_SIZES } from "./living3d";
import { genVox, WALL_3D, FLOOR_3D } from "./room3d";
import { WALLPAPERS, FLOORS } from "./scene";
import { MAX_EXPANSION_LEVEL } from "./living";

describe("3D の箱庭（リビング）", () => {
  it("へやの広さ 3 段に、床の大きさが 1 つずつ対応する", () => {
    expect(LIVING_ROOM_SIZES).toHaveLength(MAX_EXPANSION_LEVEL + 1);
    expect(livingRoomSize(0)).toEqual({ w: 96, d: 64 });
    expect(livingRoomSize(2)).toEqual({ w: 128, d: 80 });
    expect(livingRoomSize(9)).toEqual({ w: 128, d: 80 });
  });

  it("床の家具: % → 部屋 → % で元に戻る（指で動かして保存しても 2D と同じ場所）", () => {
    for (const level of [0, 1, 2]) {
      const s = livingRoomSize(level);
      for (const [x, y] of [
        [5, 48],
        [50, 66],
        [95, 86],
        [30, 70],
      ]) {
        const p = toRoom("floor", x, y, s);
        expect(Math.abs(p.x)).toBeLessThan(s.w / 2);
        expect(Math.abs(p.y)).toBeLessThan(s.d / 2);
        const back = fromRoom({ zone: "floor" }, p.x, p.y, s, y);
        expect(Math.abs(back.x - x)).toBeLessThanOrEqual(1);
        expect(Math.abs(back.y - y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("壁・棚の家具は奥の壁に付き、動かしても高さ（y%）は変わらない", () => {
    const s = livingRoomSize(0);
    const w = toRoom("wall", 40, 10, s);
    expect(w.y).toBeLessThan(-s.d / 2 + 1);
    expect(w.z).toBeGreaterThan(0);
    expect(fromRoom({ zone: "wall" }, 0, 20, s, 12).y).toBe(12);
    const sh = toRoom("shelf", 20, 24, s);
    expect(sh.z).toBeGreaterThan(0);
  });

  it("並べ方: 壁 4 面・窓・棚・家具・ペットがそろい、家具は動かせて、ペットは歩き回る", () => {
    const L = livingLayout({
      level: 1,
      wallpaperId: "graph",
      floorId: "tatami",
      window: { width: 19, curtain: true },
      furniture: [
        { itemId: "sofa", x: 40, y: 60 },
        { itemId: "rug", x: 50, y: 70 },
        { itemId: "poster", x: 22, y: 13 },
      ],
      pets: [{ id: "p1", speciesId: "kiwi-slime" }],
      lodgers: { sofa: "p1" },
    });
    expect(L.items.filter((i) => i.layer === "wall")).toHaveLength(4);
    expect(L.items.find((i) => i.id === "window")?.src).toBe("gen:window:22:1");
    expect(L.items.find((i) => i.id === "furn:sofa")).toMatchObject({ movable: true, spot: "sit" });
    expect(L.items.find((i) => i.id === "furn:rug")).toMatchObject({ layer: "floor", spot: "sleep" });
    expect(L.items.find((i) => i.id === "furn:poster")).toMatchObject({ attach: "wall-back" });
    expect(L.items.find((i) => i.id === "pet:p1")).toMatchObject({ actor: true, wander: true, home: "furn:sofa" });
    expect(L.ground).toBe("gen:floor:tatami:112x72");
  });

  it("壁紙・床のきせかえは、どれも 3D の模様がある（足したら room3d.ts にも足す）", () => {
    for (const t of WALLPAPERS) expect(WALL_3D[t.id], t.id).toBeTruthy();
    for (const t of FLOORS) expect(FLOOR_3D[t.id], t.id).toBeTruthy();
    for (const t of WALLPAPERS) expect(genVox(`gen:wall:${t.id}:96`)![0].count(), t.id).toBeGreaterThan(0);
    for (const t of FLOORS) expect(genVox(`gen:floor:${t.id}:96x64`)![0].count(), t.id).toBeGreaterThan(0);
    expect(genVox("gen:window:20:1")![0].count()).toBeGreaterThan(0);
    expect(genVox("gen:shelf:30")![0].count()).toBeGreaterThan(0);
    expect(genVox("gen:nope:1")).toBeNull();
  });
});
