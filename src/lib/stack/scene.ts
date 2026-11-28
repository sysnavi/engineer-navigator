// 場面（地面の上に物を並べて、まとめて回す）の純ロジック。描画は呼び出し側（canvas）。
// 座標はボクセル単位で、地面の中心が (0, 0)。x は右、y は手前、z は上。
// 回す向きは renderStack と同じ（dir は 0 = 正面、時計回りに dirs 段）なので、物の向きと置き場所の向きがそろう。

import { STACK_STYLE } from "./style";
import type { Frame } from "./render";

/** follow: 回しても画面の同じ所に立つ（主役を島の手前に立たせ続けるとき。x, y は画面に対しての位置） */
export type ScenePos = { x: number; y: number; z?: number; follow?: boolean };

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

/** 置き場所の画面の点。follow のものは回しても動かない */
export const placeOf = (p: ScenePos, dir: number, o: { dirs?: number; pitch?: number } = {}) =>
  project(p, p.follow ? 0 : dir, o);

/** 奥から手前の順に並べる（後ろに描くものほど先） */
export function depthOrder<T extends ScenePos>(
  items: T[],
  dir: number,
  o: { dirs?: number; pitch?: number } = {},
) {
  return items
    .map((it, i) => ({ it, i, d: placeOf(it, dir, o).depth }))
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
