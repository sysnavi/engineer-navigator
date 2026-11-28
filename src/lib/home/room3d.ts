// マイホームの箱庭の「部屋そのもの」（床・壁・窓・かざり棚）をプログラムで起こす（純ロジック）。
// 壁紙・床のきせかえ（scene.ts の WALLPAPERS / FLOORS）ごとに模様を変える。.vox のファイルは持たず、
// 描画部品（StageScene）が "gen:..." の src を見てここで起こす。家具は文字マップから起こした .vox（scripts/gen-furniture-vox.ts）。
//
//   gen:floor:<床のid>:<幅>x<奥行き>   床（厚み 2。上の面に模様）
//   gen:wall:<壁紙のid>:<長さ>         壁（厚み 2・高さ ROOM_WALL_H。x 方向に長い。y 方向の壁は face で回す）
//   gen:window:<幅>:<カーテン 0|1>      窓（壁に付ける。厚み 1）
//   gen:shelf:<長さ>                    かざり棚の板（壁に付ける）

import { Vox, type Palette } from "@/lib/stack/vox";

export const ROOM_WALL_H = 26;
export const ROOM_FLOOR_H = 2;

type WallSpec =
  | { kind: "plain"; base: string }
  | { kind: "grid"; base: string; line: string; step: number; line2?: string }
  | { kind: "dots"; base: string; dot: string; step: number }
  | { kind: "bands"; bands: string[] };

/** 壁紙（scene.ts の WALLPAPERS と同じ id）。CSS の模様をボクセルの粗さに合わせて大きめに */
export const WALL_3D: Record<string, WallSpec> = {
  cream: { kind: "plain", base: "#fff6e0" },
  graph: { kind: "grid", base: "#ffffff", line: "#cfe0f5", step: 5 },
  sunset: { kind: "bands", bands: ["#e9a0e8", "#ffb3c8", "#ffc4b4", "#ffd9a0"] },
  night: { kind: "bands", bands: ["#4a3d8f", "#3f3984", "#35357a", "#1a2352"] },
  cinema: { kind: "dots", base: "#2e2848", dot: "#9a94bb", step: 6 },
  gamecenter: { kind: "grid", base: "#16162a", line: "#3c8f8a", line2: "#8f5f97", step: 6 },
  shoji: { kind: "grid", base: "#f4ecd8", line: "#c9b896", step: 9 },
  botanical: { kind: "dots", base: "#e7f2dc", dot: "#8cc79a", step: 6 },
};

type FloorSpec =
  | { kind: "planks"; base: string; seam: string; len: number }
  | { kind: "checker"; a: string; b: string; step: number }
  | { kind: "dots"; base: string; dot: string; step: number }
  | { kind: "tatami"; base: string; seam: string; step: number }
  | { kind: "herring"; a: string; b: string; step: number };

/** 床（scene.ts の FLOORS と同じ id） */
export const FLOOR_3D: Record<string, FloorSpec> = {
  wood: { kind: "planks", base: "#e8c890", seam: "#d4ae78", len: 12 },
  tile: { kind: "checker", a: "#e8eef6", b: "#d7e2f0", step: 6 },
  carpet: { kind: "dots", base: "#b7c8e8", dot: "#d4e0f4", step: 3 },
  tatami: { kind: "tatami", base: "#cfe0a8", seam: "#bfd394", step: 11 },
  herringbone: { kind: "herring", a: "#e8c890", b: "#dbb87e", step: 4 },
};

const EDGE = "#b08050"; // 床のふち・幅木

function floorVox(id: string, W: number, D: number): [Vox, Palette] {
  const spec = FLOOR_3D[id] ?? FLOOR_3D.wood;
  const v = new Vox(W, D, ROOM_FLOOR_H);
  const pal: Palette = [null, EDGE];
  const col = new Map<string, number>();
  const c = (hex: string) => {
    let i = col.get(hex);
    if (i === undefined) {
      i = pal.length;
      pal.push(hex);
      col.set(hex, i);
    }
    return i;
  };
  for (let y = 0; y < D; y++)
    for (let x = 0; x < W; x++) {
      v.set(x, y, 0, 1);
      let hex: string;
      switch (spec.kind) {
        case "planks": {
          const row = Math.floor(y / 4);
          const seam = y % 4 === 0 || (x + (row % 3) * 5) % spec.len === 0;
          hex = seam ? spec.seam : spec.base;
          break;
        }
        case "checker":
          hex = (Math.floor(x / spec.step) + Math.floor(y / spec.step)) % 2 ? spec.b : spec.a;
          break;
        case "dots":
          hex = x % spec.step === 1 && y % spec.step === 1 ? spec.dot : spec.base;
          break;
        case "tatami":
          hex = x % spec.step === 0 || y % (spec.step * 2) === 0 ? spec.seam : spec.base;
          break;
        case "herring": {
          const k = Math.floor(x / spec.step) % 2 ? x + y : x - y;
          hex = Math.floor(((k % (spec.step * 2)) + spec.step * 2) / spec.step) % 2 ? spec.b : spec.a;
          break;
        }
      }
      v.set(x, y, 1, c(hex));
    }
  return [v, pal];
}

function wallVox(id: string, L: number): [Vox, Palette] {
  const spec = WALL_3D[id] ?? WALL_3D.cream;
  const H = ROOM_WALL_H;
  const v = new Vox(L, 2, H);
  const pal: Palette = [null, EDGE];
  const col = new Map<string, number>();
  const c = (hex: string) => {
    let i = col.get(hex);
    if (i === undefined) {
      i = pal.length;
      pal.push(hex);
      col.set(hex, i);
    }
    return i;
  };
  for (let x = 0; x < L; x++)
    for (let z = 0; z < H; z++) {
      let hex: string;
      if (z < 2) hex = EDGE;
      else
        switch (spec.kind) {
          case "plain":
            hex = spec.base;
            break;
          case "grid":
            hex =
              x % spec.step === 0
                ? spec.line
                : z % spec.step === 0
                  ? (spec.line2 ?? spec.line)
                  : spec.base;
            break;
          case "dots":
            hex = x % spec.step === 2 && z % spec.step === 3 ? spec.dot : spec.base;
            break;
          case "bands":
            hex = spec.bands[Math.min(spec.bands.length - 1, Math.floor(((z - 2) / (H - 2)) * spec.bands.length))];
            break;
        }
      v.set(x, 0, z, c(hex));
      v.set(x, 1, z, c(hex));
    }
  return [v, pal];
}

function windowVox(w: number, curtain: boolean): [Vox, Palette] {
  const cw = curtain ? 3 : 0;
  const W = w + cw * 2,
    H = 12;
  const v = new Vox(W, 1, H);
  for (let x = 0; x < w; x++)
    for (let z = 0; z < H; z++) {
      const frame = x === 0 || x === w - 1 || z === 0 || z === H - 1 || x === Math.floor(w / 2) || z === Math.floor(H / 2);
      v.set(cw + x, 0, z, frame ? 1 : 2);
    }
  if (curtain)
    for (const x0 of [0, W - cw])
      for (let x = 0; x < cw; x++) for (let z = 0; z < H + 1 && z < H; z++) v.set(x0 + x, 0, z, (x + z) % 2 ? 3 : 4);
  return [v, [null, "#ffffff", "#9fd0f2", "#e5484d", "#f2848b"]];
}

function shelfVox(L: number): [Vox, Palette] {
  const v = new Vox(L, 4, 2);
  v.box(0, 0, 0, L - 1, 3, 1, 1);
  return [v, [null, "#b08050"]];
}

/** "gen:..." の src → ボクセルと色。知らない src は null */
export function genVox(src: string): [Vox, Palette] | null {
  const [, kind, a, b] = src.split(":");
  if (kind === "floor") {
    const [w, d] = b.split("x").map(Number);
    return floorVox(a, w, d);
  }
  if (kind === "wall") return wallVox(a, Number(b));
  if (kind === "window") return windowVox(Number(a), b === "1");
  if (kind === "shelf") return shelfVox(Number(a));
  return null;
}
