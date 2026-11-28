// マイホームのリビングを 3D の箱庭で見せるときの並べ方（純ロジック）。描画は StageScene、画面は living-scene.tsx。
//
// データ（DB）は 2D の LIVING.sav と共通。家具の位置は今までどおり「横 x%・段（壁 / 棚 / 床）・縦 y%」で持ち、
// 3D ではそれを部屋の座標に読み替える（toRoom）。指で動かした位置は % に戻して保存する（fromRoom）。
//   床の家具: x% → 部屋の左右、y%（床の段の上〜下）→ 部屋の奥〜手前
//   壁の家具: 奥の壁（wall-back）の左右と高さ
//   棚の家具: 奥の壁のかざり棚の上
// 部屋の広さは「へやの広さ 3 段」（拡張キット）に対応: 96×64 / 112×72 / 128×80。
// 家具の向きは持たない（正面向きの絵のまま押し出す）。方針: docs/design/myhome-3d-plan.md

import type { StageItem, StageLayout } from "./stage";
import { LIVING_X_MAX, LIVING_X_MIN, LIVING_ZONES, SHELF_SEGMENTS, clampFurniture } from "./living";
import { ROOM_FLOOR_H, ROOM_WALL_H } from "./room3d";
import { shopItemById, type ShopItem } from "@/lib/shop/content";
import { petVoxSrc } from "@/lib/stack/assets";

/** へやの広さ 3 段（拡張なし・拡張 1・拡張 2）→ 床の大きさ（ボクセル） */
export const LIVING_ROOM_SIZES = [
  { w: 96, d: 64 },
  { w: 112, d: 72 },
  { w: 128, d: 80 },
] as const;

export type RoomSize = { w: number; d: number };
export const livingRoomSize = (level: number): RoomSize =>
  LIVING_ROOM_SIZES[Math.max(0, Math.min(LIVING_ROOM_SIZES.length - 1, level))];

export const furnitureVoxSrc = (itemId: string) => `/stack/furniture/${itemId}.vox`;

// 床の家具が置ける範囲（壁ぎわに少し余白）
const floorX = (s: RoomSize) => [-s.w / 2 + 8, s.w / 2 - 8] as const;
const floorY = (s: RoomSize) => [-s.d / 2 + 8, s.d / 2 - 6] as const;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const unlerp = (a: number, b: number, v: number) => (v - a) / (b - a);
const xT = (x: number) => unlerp(LIVING_X_MIN, LIVING_X_MAX, x);

/** 壁の家具の高さ（足元の z）: 壁の段の上ほど高い */
const WALL_Z: [number, number] = [16, 11];
/** かざり棚の板の高さと、棚の家具の足元の z */
export const SHELF_Z = 10;

/** % の位置 → 部屋の座標（足元の中心）。壁・棚の家具は奥の壁に付く */
export function toRoom(zone: ShopItem["zone"], x: number, y: number, s: RoomSize) {
  const [x0, x1] = floorX(s);
  const rx = Math.round(lerp(x0, x1, xT(x)));
  if (zone === "floor") {
    const [lo, hi] = LIVING_ZONES.floor.y;
    const [y0, y1] = floorY(s);
    return { x: rx, y: Math.round(lerp(y0, y1, unlerp(lo, hi, y))), z: 0 };
  }
  if (zone === "wall") {
    const [lo, hi] = LIVING_ZONES.wall.y;
    return { x: rx, y: -s.d / 2 + 0.5, z: Math.round(lerp(WALL_Z[0], WALL_Z[1], unlerp(lo, hi, y))) };
  }
  return { x: rx, y: -s.d / 2 + 2, z: SHELF_Z + 2 };
}

/** 部屋の座標 → % の位置（保存用。段ごとの範囲にクランプ）。壁・棚は左右だけ動かす（高さは今の y% のまま） */
export function fromRoom(item: Pick<ShopItem, "zone">, rx: number, ry: number, s: RoomSize, curY: number) {
  const [x0, x1] = floorX(s);
  const x = lerp(LIVING_X_MIN, LIVING_X_MAX, unlerp(x0, x1, rx));
  if (item.zone !== "floor") return clampFurniture(item, x, curY);
  const [lo, hi] = LIVING_ZONES.floor.y;
  const [y0, y1] = floorY(s);
  return clampFurniture(item, x, lerp(lo, hi, unlerp(y0, y1, ry)));
}

export type LivingInput = {
  level: number;
  wallpaperId: string;
  floorId: string;
  window: { width: number; curtain: boolean };
  furniture: { itemId: string; x: number; y: number }[];
  pets: { id: string; speciesId: string }[];
  /** itemId → petId（きょうその家具を使っている子。休むときはそこへ行く） */
  lodgers: Record<string, string>;
};

export const furnId = (itemId: string) => `furn:${itemId}`;
export const petId = (id: string) => `pet:${id}`;

/** リビングの箱庭の並べ方 */
export function livingLayout(input: LivingInput): StageLayout {
  const s = livingRoomSize(input.level);
  const hw = s.w / 2,
    hd = s.d / 2;
  const wall = (id: string, len: number, x: number, y: number, face: number): StageItem => ({
    id,
    src: `gen:wall:${input.wallpaperId}:${len}`,
    x,
    y,
    face,
    layer: "wall",
  });
  // 窓（2D の窓の幅は壁の % → 奥の壁の長さに対して同じ割合）
  const winW = Math.max(10, Math.round((s.w * input.window.width) / 100 / 2) * 2);
  // かざり棚の板（2D の棚の範囲と同じ左右の位置）
  const [fx0, fx1] = floorX(s);
  const shelves: StageItem[] = SHELF_SEGMENTS.map(([lo, hi], i) => {
    const a = lerp(fx0, fx1, xT(lo - 3)),
      b = lerp(fx0, fx1, xT(hi + 3));
    return {
      id: `shelf-${i}`,
      src: `gen:shelf:${Math.round(b - a)}`,
      x: Math.round((a + b) / 2),
      y: -hd + 2,
      z: SHELF_Z,
      attach: "wall-back",
    };
  });
  const homeOf = new Map(Object.entries(input.lodgers).map(([itemId, pid]) => [pid, furnId(itemId)]));
  const items: StageItem[] = [
    wall("wall-back", s.w, 0, -hd - 1, 0),
    wall("wall-front", s.w, 0, hd + 1, 4),
    wall("wall-left", s.d, -hw - 1, 0, 2),
    wall("wall-right", s.d, hw + 1, 0, 6),
    {
      id: "window",
      src: `gen:window:${winW}:${input.window.curtain ? 1 : 0}`,
      x: 0,
      y: -hd + 0.5,
      z: 9,
      attach: "wall-back",
    },
    ...shelves,
  ];
  for (const f of input.furniture) {
    const def = shopItemById(f.itemId);
    if (!def || def.expand) continue;
    const p = toRoom(def.zone, f.x, f.y, s);
    items.push({
      id: furnId(f.itemId),
      src: furnitureVoxSrc(f.itemId),
      x: p.x,
      y: p.y,
      z: p.z || undefined,
      layer: def.flat ? "floor" : undefined,
      attach: def.zone === "floor" ? undefined : "wall-back",
      spot: def.petSpot?.kind,
      movable: true,
    });
  }
  input.pets.forEach((p, i) => {
    items.push({
      id: petId(p.id),
      src: petVoxSrc(p.speciesId),
      // 最初は部屋の手前側に散らばって立つ（そこから歩き出す）
      x: Math.round(lerp(-hw + 14, hw - 14, ((i * 37) % 100) / 100)),
      y: Math.round(lerp(0, hd - 8, ((i * 53) % 100) / 100)),
      shadow: 6,
      actor: true,
      wander: true,
      home: homeOf.get(p.id),
    });
  });
  return {
    ground: `gen:floor:${input.floorId}:${s.w}x${s.d}`,
    groundZ: ROOM_FLOOR_H,
    pitch: 0.55,
    // 縦長の画面では少し上から見下ろして、床を縦に広く使う
    portraitPitch: 0.7,
    centerY: 0.6,
    minScale: 2,
    zoomable: true,
    room: { w: s.w, d: s.d, h: ROOM_WALL_H },
    walk: { x0: -hw + 7, x1: hw - 7, y0: -hd + 10, y1: hd - 5 },
    items,
  };
}
