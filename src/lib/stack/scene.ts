// 場面（地面の上に物を並べて、まとめて回す）の純ロジック。描画は呼び出し側（canvas）。
// 座標はボクセル単位で、地面の中心が (0, 0)。x は右、y は手前、z は上。
// 回す向きは renderStack と同じ（dir は 0 = 正面、時計回りに dirs 段）なので、物の向きと置き場所の向きがそろう。

import { STACK_STYLE } from "./style";
import type { Frame } from "./render";

export type ScenePos = { x: number; y: number; z?: number };

/** 場面の点 → 画面の点（地面の中心が原点）。depth が大きいほど手前 */
export function project(
  p: ScenePos,
  dir: number,
  o: { dirs?: number; pitch?: number } = {},
) {
  const dirs = o.dirs ?? STACK_STYLE.dirs,
    k = o.pitch ?? STACK_STYLE.pitch;
  const a = (dir * Math.PI * 2) / dirs,
    c = Math.cos(a),
    s = Math.sin(a);
  const rx = p.x * c - p.y * s,
    ry = p.x * s + p.y * c;
  return { x: rx, y: ry * k - (p.z ?? 0), depth: ry };
}

/** 向きを delta 段まわす（0..dirs-1 に収める） */
export function turnDir(dir: number, delta: number, dirs = STACK_STYLE.dirs) {
  return (((dir + delta) % dirs) + dirs) % dirs;
}

/** 奥から手前の順に並べる（後ろに描くものほど先） */
export function depthOrder<T extends ScenePos>(
  items: T[],
  dir: number,
  o: { dirs?: number; pitch?: number } = {},
) {
  return items
    .map((it, i) => ({ it, i, d: project(it, dir, o).depth }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((e) => e.it);
}

/** 画面に置いた絵（左上 x0,y0 に Frame を置いた）の、点 (x, y) が絵の上か。線は含めない */
export type Placed<T> = { item: T; x0: number; y0: number; frame: Frame };
export function hitTest<T>(
  placed: Placed<T>[],
  x: number,
  y: number,
): T | null {
  for (let i = placed.length - 1; i >= 0; i--) {
    const { item, x0, y0, frame: f } = placed[i];
    const fx = Math.floor(x - x0),
      fy = Math.floor(y - y0);
    if (fx < 0 || fy < 0 || fx >= f.w || fy >= f.h) continue;
    if (f.solid[fy * f.w + fx]) return item;
  }
  return null;
}

/**
 * 手前の絵に隠れた所（線も含めて不透明どうしが重なる画素）。back の Frame と同じ大きさの 0/1。
 * 主役が家の陰に入った向きで、隠れた所だけ透かして描くのに使う
 */
export function hiddenMask<T>(back: Placed<T>, front: Placed<T>[]) {
  const { frame: b, x0, y0 } = back;
  const mask = new Uint8Array(b.w * b.h);
  let count = 0;
  for (const { frame: f, x0: fx0, y0: fy0 } of front) {
    const left = Math.max(x0, fx0),
      right = Math.min(x0 + b.w, fx0 + f.w),
      top = Math.max(y0, fy0),
      bottom = Math.min(y0 + b.h, fy0 + f.h);
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++) {
        const i = (y - y0) * b.w + (x - x0);
        if (mask[i] || !(b.px[i] >>> 24)) continue;
        if (f.px[(y - fy0) * f.w + (x - fx0)] >>> 24) {
          mask[i] = 1;
          count++;
        }
      }
  }
  return { mask, count };
}

/** 画面の点（地面の中心が原点・画面の画素）→ 高さ z の面の上の点（project の逆） */
export function unproject(
  sx: number,
  sy: number,
  dir: number,
  o: { dirs?: number; pitch?: number; z?: number } = {},
) {
  const dirs = o.dirs ?? STACK_STYLE.dirs,
    k = o.pitch ?? STACK_STYLE.pitch;
  const a = (dir * Math.PI * 2) / dirs,
    c = Math.cos(a),
    s = Math.sin(a);
  const rx = sx,
    ry = (sy + (o.z ?? 0)) / k;
  return { x: rx * c + ry * s, y: -rx * s + ry * c };
}

/** 床の上の進む向き（mx, my）→ キャラの向き（0 = 手前 +y 向き。時計回りに dirs 段。描くときは場面の向きに足す） */
export function faceOf(mx: number, my: number, dirs = STACK_STYLE.dirs) {
  return turnDir(Math.round(Math.atan2(-mx, my) / ((Math.PI * 2) / dirs)), 0, dirs);
}

/** 家具でくつろぐキャラの居場所（家具の足元の中心 x, y と大きさ w・d・h から）。z は床からの高さ */
export type SpotKind = "sleep" | "sit" | "top" | "watch" | "front";
export function spotPose(
  kind: SpotKind,
  f: { x: number; y: number; w: number; d: number; h: number; flat?: boolean; onWall?: boolean },
): { x: number; y: number; z: number; face: number; sleep: boolean; approach: { x: number; y: number } } {
  // 壁・棚のものは、その前の床から見上げる
  if (f.onWall) {
    const p = { x: f.x, y: f.y + 12 };
    return { ...p, z: 0, face: 4, sleep: false, approach: p };
  }
  const before = { x: f.x, y: f.y + f.d / 2 + 5 };
  switch (kind) {
    case "sleep":
      return { x: f.x, y: f.y + 0.5, z: f.flat ? 1 : Math.round(f.h * 0.6), face: 0, sleep: true, approach: before };
    case "sit":
      return { x: f.x, y: f.y + f.d * 0.15, z: Math.round(f.h * 0.42), face: 0, sleep: false, approach: before };
    case "top":
      return { x: f.x, y: f.y + 0.5, z: f.h - 1, face: 0, sleep: false, approach: before };
    case "front":
      return { ...before, z: 0, face: 4, sleep: false, approach: before };
    case "watch": {
      const p = { x: f.x - f.w / 2 - 6, y: f.y + 2 };
      return { ...p, z: 0, face: faceOf(1, 0), sleep: false, approach: p };
    }
  }
}
