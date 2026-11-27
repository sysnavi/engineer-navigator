// .vox（またはコードで作ったボクセル）を「元の形」にして、歩き・まばたき・笑顔のコマを作る（純ロジック）。
// 足 = 2番の色で下のほうにあるボクセル（legs のキャラだけ）。足がなければ、歩くときは縮んだり伸びたりする。
// 目と口 = 顔の正面に出ている 4/5/7 番のかたまり（上の2つが目、その下が口）。目が1つのキャラは表情を変えない。

import { Vox, COLOR, isFacePaint, type Palette } from "./vox";
import { bake, type Stack } from "./render";

export type Expr = "n" | "b" | "s"; // ふつう / まばたき / 笑顔
/** -1 = 立ち、0〜3 = 歩きのコマ */
export type Step = -1 | 0 | 1 | 2 | 3;

type Comp = { cells: [number, number][]; x0: number; x1: number; z0: number; z1: number; cx: number; cz: number };
export type FaceInfo = { legTop: number; eyes: [Comp, Comp] | null; mouth: Comp | null };

export function analyze(v: Vox, legs = true): FaceInfo {
  let legTop = -1,
    front = 0;
  for (let z = 0; z < v.h; z++)
    for (let y = 0; y < v.d; y++)
      for (let x = 0; x < v.w; x++) {
        const c = v.get(x, y, z);
        if (!c) continue;
        if (legs && c === COLOR.sub && z < v.h * 0.4) legTop = Math.max(legTop, z);
        front = Math.max(front, y);
      }
  const cell = new Set<string>();
  for (let z = legTop + 1; z < v.h; z++)
    for (let x = 0; x < v.w; x++) {
      const y = v.front(x, z);
      if (y < 0) continue;
      const c = v.get(x, y, z);
      if ((c === COLOR.line || c === COLOR.eyeLight || c === COLOR.mouth) && y >= front - 3) cell.add(`${x},${z}`);
    }
  const comps: Comp[] = [],
    seen = new Set<string>();
  for (const k of cell) {
    if (seen.has(k)) continue;
    const cells: [number, number][] = [],
      q = [k];
    seen.add(k);
    while (q.length) {
      const cur = q.pop() as string;
      const [x, z] = cur.split(",").map(Number);
      cells.push([x, z]);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const n = `${x + dx},${z + dz}`;
          if (cell.has(n) && !seen.has(n)) {
            seen.add(n);
            q.push(n);
          }
        }
    }
    const xs = cells.map((c) => c[0]),
      zs = cells.map((c) => c[1]);
    comps.push({
      cells,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      z0: Math.min(...zs),
      z1: Math.max(...zs),
      cx: xs.reduce((a, b) => a + b, 0) / xs.length,
      cz: zs.reduce((a, b) => a + b, 0) / zs.length,
    });
  }
  comps.sort((a, b) => b.cz - a.cz);
  let eyes: [Comp, Comp] | null = null;
  for (let i = 0; i + 1 < comps.length && !eyes; i++)
    if (Math.abs(comps[i].cz - comps[i + 1].cz) <= 1.5 && Math.abs(comps[i].cx - comps[i + 1].cx) >= 3)
      eyes = [comps[i], comps[i + 1]];
  let mouth: Comp | null = null;
  if (eyes) {
    const e = eyes;
    mouth =
      comps.find(
        (c) => !e.includes(c) && c.cz < Math.min(e[0].cz, e[1].cz) && Math.abs(c.cx - v.w / 2) < v.w * 0.25
      ) ?? null;
  }
  return { legTop, eyes, mouth };
}

/** 顔の範囲（目・口・ほっぺ）を1枚の平らな面にそろえる。丸い面のままだと列ごとに高さがずれて目が崩れる */
export function flattenFace(v: Vox, A: FaceInfo): Vox {
  if (!A.eyes) return v;
  const [e0, e1] = A.eyes;
  const zLo = (A.mouth ? A.mouth.z0 : Math.min(e0.z0, e1.z0)) - 1,
    zHi = Math.max(e0.z1, e1.z1) + 1;
  let xLo = Math.min(e0.x0, e1.x0) - 1,
    xHi = Math.max(e0.x1, e1.x1) + 1;
  for (let z = zLo; z <= zHi; z++)
    for (let x = 0; x < v.w; x++) {
      const y = v.front(x, z);
      if (y >= 0 && v.get(x, y, z) === COLOR.cheek) {
        xLo = Math.min(xLo, x);
        xHi = Math.max(xHi, x);
      }
    }
  let yF = 0;
  for (let z = zLo; z <= zHi; z++) for (let x = xLo; x <= xHi; x++) yF = Math.max(yF, v.front(x, z));
  for (let z = zLo; z <= zHi; z++)
    for (let x = xLo; x <= xHi; x++) {
      const y = v.front(x, z);
      if (y < 0 || yF - y > 3) continue;
      const i = v.idx(x, y, z),
        c = v.c[i],
        f = v.f[i];
      for (let yy = y + 1; yy <= yF; yy++) v.set(x, yy, z, c, f);
    }
  return v;
}

function paintExpr(o: Vox, A: FaceInfo, expr: Expr, bob: number) {
  const cx = o.w / 2;
  if (A.eyes && expr !== "n") {
    for (const e of A.eyes) {
      for (const [x, z] of e.cells) o.paint(x, z + bob, COLOR.body, 0);
      const zm = e.z0 + ((e.z1 - e.z0) >> 1) + bob;
      if (expr === "b") {
        for (let x = e.x0; x <= e.x1; x++) o.paint(x, zm, COLOR.line);
      } else {
        const xs: number[] = [];
        for (let x = e.x0; x <= e.x1; x++) xs.push(x);
        while (xs.length < 3) {
          if (e.cx < cx) xs.unshift(xs[0] - 1);
          else xs.push(xs[xs.length - 1] + 1);
        }
        const m = (xs.length - 1) / 2;
        xs.forEach((x, i) => o.paint(x, Math.max(zm, zm + 1 - Math.round(Math.abs(i - m))), COLOR.line));
      }
    }
  }
  if (A.mouth && expr === "s") {
    const mo = A.mouth;
    for (const [x, z] of mo.cells) o.paint(x, z + bob, COLOR.mouth);
    o.paint(mo.x0 - 1, mo.z1 + 1 + bob, COLOR.line);
    o.paint(mo.x1 + 1, mo.z1 + 1 + bob, COLOR.line);
  }
  return o;
}

export function animate(v: Vox, A: FaceInfo, step: Step, expr: Expr, legs: boolean): Vox {
  if (!legs || A.legTop < 0) {
    // 足のないキャラ：表情を描いてから、高さ方向に縮める／伸ばす（ぽよん）
    const o = paintExpr(v.clone(), A, expr, 0);
    const sq = step === 0 || step === 2 ? 0.88 : step === 1 || step === 3 ? 1.08 : 1;
    if (sq === 1) return o;
    const r = new Vox(v.w, v.d, Math.ceil(v.h * sq)),
      L = v.w * v.d;
    for (let z = 0; z < r.h; z++) {
      const zs = Math.floor((z + 0.5) / sq);
      if (zs >= v.h) break;
      r.c.set(o.c.subarray(zs * L, zs * L + L), z * L);
      r.f.set(o.f.subarray(zs * L, zs * L + L), z * L);
    }
    return r;
  }
  const bob = step === 1 || step === 3 ? 1 : 0,
    sw = step === 0 ? 1 : step === 2 ? -1 : 0,
    cx = v.w / 2;
  const o = new Vox(v.w, v.d + 4, v.h + 1);
  for (let z = 0; z < v.h; z++)
    for (let y = 0; y < v.d; y++)
      for (let x = 0; x < v.w; x++) {
        const c = v.get(x, y, z);
        if (!c) continue;
        const fl = v.f[v.idx(x, y, z)];
        if (c === COLOR.sub && z <= A.legTop) {
          const dy = (x + 0.5 < cx ? 1 : -1) * 2 * sw;
          o.set(x, y + 2 + dy, z, c, fl);
          if (bob && z === A.legTop) o.set(x, y + 2 + dy, z + 1, c, fl);
        } else o.set(x, y + 2, z + bob, c, fl);
      }
  return paintExpr(o, A, expr, bob);
}

/** 表示用に整えたキャラ。コマ（Stack）は使うときに作ってキャッシュする */
export type Model = {
  vox: Vox;
  palette: Palette;
  legs: boolean;
  face: FaceInfo;
  stacks: Map<string, Stack>;
};

export function prepareModel(vox: Vox, palette: Palette, opts: { legs?: boolean; flatten?: boolean } = {}): Model {
  const legs = opts.legs ?? true;
  for (let i = 0; i < vox.c.length; i++) if (isFacePaint(vox.c[i])) vox.f[i] = 1;
  if (opts.flatten !== false) flattenFace(vox, analyze(vox, legs));
  return { vox, palette, legs, face: analyze(vox, legs), stacks: new Map() };
}

/** パレットを一部差し替えた色違い（1=体・2=サブ色など）を作るときは palette を渡す */
const palKeys = new WeakMap<Palette, string>();
const palKey = (p: Palette) => {
  let k = palKeys.get(p);
  if (k === undefined) {
    k = p.join(",");
    palKeys.set(p, k);
  }
  return k;
};

export function modelStack(m: Model, step: Step = -1, expr: Expr = "n", palette: Palette = m.palette): Stack {
  const key = `${step}|${expr}|${palKey(palette)}`;
  let st = m.stacks.get(key);
  if (!st) {
    st = bake(animate(m.vox, m.face, step, expr, m.legs), palette);
    m.stacks.set(key, st);
  }
  return st;
}
