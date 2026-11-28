// スプライトスタッキングの描画（純ロジック。canvas を使わずピクセル配列で組み立てる）。
//   1. bake: ボクセル → z層ごとの輪切り画像。面の向きで4段のトゥーン陰影を焼き込む
//   2. rotSlice: 輪切り1枚を「回転 → 縦につぶす」。斜めは Scale2x で8倍にしてから回して戻す（ドット補正）
//   3. renderStack: 輪切りを1層 thick px ずつ上へ重ね、外周に1pxの線を引く。向き×傾き×厚みごとにキャッシュ
// できた Frame は ImageData にそのまま渡せる（Uint32 リトルエンディアン 0xAABBGGRR）。

import { Vox, hexToRgb, mixRgb, packRgba, type Palette, type RGB } from "./vox";
import { STACK_STYLE, SHADE_MIX } from "./style";

export type Stack = {
  w: number;
  d: number;
  h: number;
  /** 層の画像の大きさ（1px の透明ふち込み） */
  lw: number;
  ld: number;
  layers: (Uint32Array | null)[];
  /** renderStack の結果のキャッシュ */
  frames: Map<string, Frame>;
  /** rotSlice の結果のキャッシュ */
  rot: Map<string, (RotLayer | null)[]>;
};

export type Frame = {
  w: number;
  h: number;
  px: Uint32Array;
  /** 足元の中心（モデルの z=0 の面の中心）が画像のどこにあるか */
  pivotX: number;
  pivotY: number;
  /** 不透明（線を含まない）か。重なり判定用 */
  solid: Uint8Array;
};

type RotLayer = { px: Uint32Array; w: number; h: number };

const WHITE: RGB = [255, 255, 255];

function lightVec(): [number, number, number] {
  const [x, y, z] = STACK_STYLE.light;
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}

/** 周り半径2のボクセルの詰まり具合から面の向きを出し、4段で塗り分ける（段差ごとの横じまが出ない） */
export function shadeAt(v: Vox, x: number, y: number, z: number, col: RGB, L = lightVec()): RGB {
  const e = (a: number, b: number, c: number) => !v.get(a, b, c);
  if (!(e(x + 1, y, z) || e(x - 1, y, z) || e(x, y + 1, z) || e(x, y - 1, z) || e(x, y, z + 1) || e(x, y, z - 1)))
    return col;
  let nx = 0,
    ny = 0,
    nz = 0;
  for (let dz = -2; dz <= 2; dz++)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy && !dz) continue;
        if (v.get(x + dx, y + dy, z + dz)) {
          nx -= dx;
          ny -= dy;
          nz -= dz;
        }
      }
  const n = Math.hypot(nx, ny, nz);
  if (!n) return col;
  const d = (nx * L[0] + ny * L[1] + nz * L[2]) / n;
  const shadow = hexToRgb(SHADE_MIX.shadow);
  if (d > 0.72) return mixRgb(col, WHITE, SHADE_MIX.hi);
  if (d > 0.22) return col;
  if (d > -0.3) return mixRgb(col, shadow, SHADE_MIX.mid);
  return mixRgb(col, shadow, SHADE_MIX.low);
}

export function bake(v: Vox, pal: Palette): Stack {
  const P = pal.map((h) => (h ? hexToRgb(h) : null));
  const lw = v.w + 2,
    ld = v.d + 2,
    L = lightVec();
  const layers: (Uint32Array | null)[] = [];
  for (let z = 0; z < v.h; z++) {
    const px = new Uint32Array(lw * ld);
    let any = false;
    for (let y = 0; y < v.d; y++)
      for (let x = 0; x < v.w; x++) {
        const ci = v.get(x, y, z);
        if (!ci) continue;
        const base = P[ci] ?? [200, 200, 200];
        const col = v.f[v.idx(x, y, z)] ? base : shadeAt(v, x, y, z, base, L);
        px[x + 1 + (y + 1) * lw] = packRgba(col);
        any = true;
      }
    layers.push(any ? px : null);
  }
  return { w: v.w, d: v.d, h: v.h, lw, ld, layers, frames: new Map(), rot: new Map() };
}

/** Scale2x（EPX）：斜めの段差を保ったまま2倍にする */
export function scale2x(src: Uint32Array, w: number, h: number): Uint32Array {
  const W2 = w * 2,
    out = new Uint32Array(W2 * h * 2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = src[y * w + x],
        A = y > 0 ? src[(y - 1) * w + x] : P,
        B = x < w - 1 ? src[y * w + x + 1] : P;
      const C = x > 0 ? src[y * w + x - 1] : P,
        D = y < h - 1 ? src[(y + 1) * w + x] : P;
      const o = 2 * y * W2 + 2 * x;
      out[o] = C === A && C !== D && A !== B ? A : P;
      out[o + 1] = A === B && A !== C && B !== D ? B : P;
      out[o + W2] = D === C && D !== B && C !== A ? C : P;
      out[o + W2 + 1] = B === D && B !== A && D !== C ? D : P;
    }
  return out;
}

// 1ピクセルの中を手前（画面の下側）から順に調べる位置。縦につぶすと奥行き 1/k ぶんが1行に重なるため、
// 1点だけ拾うと一番手前（顔の面）を飛ばすことがある
const SUBS = [0.94, 0.81, 0.69, 0.56, 0.44, 0.31, 0.19, 0.06];

export function rotSlice(src: Uint32Array, lw: number, ld: number, ang: number, k: number, up: number): RotLayer {
  let s = src,
    sw = lw,
    sh = ld;
  for (let u = 1; u < up; u *= 2) {
    s = scale2x(s, sw, sh);
    sw *= 2;
    sh *= 2;
  }
  const R = Math.hypot(lw, ld) / 2 + 1;
  // 幅の偶奇を元の層とそろえ、正面・横（0°・90°…）で出力の画素の中心が元の画素の中心に乗るようにする。
  // ずれていると元の画素の「角」を拾い、ドット補正で丸めた角に当たって、2ドット以上の幅の顔パーツの左の列が消える
  const W = Math.ceil(2 * R) + ((Math.ceil(2 * R) - lw) & 1),
    H = Math.ceil(2 * R * k) | 1;
  const out = new Uint32Array(W * H);
  const cs = Math.cos(ang),
    sn = Math.sin(ang),
    hx = lw / 2,
    hy = ld / 2;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const U = i + 0.5 - W / 2;
      for (const sv of SUBS) {
        const V = (j + sv - H / 2) / k;
        const x = cs * U + sn * V + hx,
          y = -sn * U + cs * V + hy;
        const X = Math.floor(x * up + 1e-4),
          Y = Math.floor(y * up + 1e-4);
        if (X >= 0 && Y >= 0 && X < sw && Y < sh) {
          const p = s[Y * sw + X];
          if (p >>> 24) {
            out[j * W + i] = p;
            break;
          }
        }
      }
    }
  return { px: out, w: W, h: H };
}

export type RenderOpts = {
  /** 向き（0 = 正面、時計回りに dirs 段） */
  dir: number;
  dirs?: number;
  /** 縦のつぶし具合 */
  pitch?: number;
  /** 1層の厚み（px、整数） */
  thick?: number;
  /** 層と層のすき間（輪切り表示用） */
  spread?: number;
  /** 線の色。null で線なし */
  line?: string | null;
};

export function renderStack(st: Stack, o: RenderOpts): Frame {
  const dirs = o.dirs ?? STACK_STYLE.dirs,
    k = o.pitch ?? STACK_STYLE.pitch,
    thick = o.thick ?? STACK_STYLE.thick,
    step = 1 + (o.spread ?? 0),
    line = o.line === undefined ? STACK_STYLE.line : o.line;
  const dir = ((Math.round(o.dir) % dirs) + dirs) % dirs;
  const key = `${dirs}:${dir}|${k}|${thick}|${step}|${line}`;
  const hit = st.frames.get(key);
  if (hit) return hit;

  const up = STACK_STYLE.clean && st.lw * st.ld <= 66 * 66 ? 8 : 1;
  const rkey = `${dirs}:${dir}|${k}|${up}`;
  let rl = st.rot.get(rkey);
  if (!rl) {
    const ang = (dir * Math.PI * 2) / dirs;
    rl = st.layers.map((L) => (L ? rotSlice(L, st.lw, st.ld, ang, k, up) : null));
    st.rot.set(rkey, rl);
  }
  const r = Math.hypot(st.lw, st.ld) / 2 + 1;
  const top = Math.ceil(r * k + (st.h - 1) * step * thick + thick) + 2,
    bot = Math.ceil(r * k) + 2;
  const W = Math.ceil(2 * r) + 4,
    H = top + bot + 1,
    px = W >> 1;
  const out = new Uint32Array(W * H);
  const reps = step > 1.3 ? 1 : thick;
  for (let z = 0; z < st.h; z++) {
    const R = rl[z];
    if (!R) continue;
    const y0 = top - z * step * thick;
    for (let j = 0; j < reps; j++) {
      const ox = px - (R.w >> 1),
        oy = Math.round(y0 - j) - (R.h >> 1);
      for (let yy = 0; yy < R.h; yy++) {
        const ty = oy + yy;
        if (ty < 0 || ty >= H) continue;
        for (let xx = 0; xx < R.w; xx++) {
          const p = R.px[yy * R.w + xx];
          if (!(p >>> 24)) continue;
          const tx = ox + xx;
          if (tx >= 0 && tx < W) out[ty * W + tx] = p;
        }
      }
    }
  }
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < out.length; i++) if (out[i] >>> 24) solid[i] = 1;
  if (line) {
    const ink = packRgba(hexToRgb(line));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (solid[i]) continue;
        if ((x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W]))
          out[i] = ink;
      }
  }
  const frame: Frame = { w: W, h: H, px: out, pivotX: px, pivotY: top, solid };
  st.frames.set(key, frame);
  return frame;
}

/** 線まで含めて、絵がある範囲（上下左右の余白を除いた箱） */
export function frameBounds(f: Frame) {
  let x0 = f.w,
    y0 = f.h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++)
      if (f.px[y * f.w + x] >>> 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
