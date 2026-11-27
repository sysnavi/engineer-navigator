// ボクセルモデル（スプライトスタッキングの原本）。DOM に触らない純ロジック。
// 座標: x = 左→右、y = 奥→手前（y が大きいほど手前＝顔の側）、z = 下→上。
// 色は「色の番号」で持ち、実際の色はパレット（番号 → #rrggbb）で決める。
//
// 色の番号の約束（.vox を MagicaVoxel で直すときも同じ）:
//   0 = 空き / 1 = 体 / 2 = 足・サブ色 / 3 = 飾り（触角の玉など）
//   4 = 線（目・口） / 5 = 目の光 / 6 = ほっぺ / 7 = 笑顔の口・口の中
// 4〜7 は「顔の塗り」として陰影をかけない。

export const COLOR = {
  body: 1,
  sub: 2,
  accent: 3,
  line: 4,
  eyeLight: 5,
  cheek: 6,
  mouth: 7,
} as const;

export const isFacePaint = (c: number) => c >= COLOR.line && c <= COLOR.mouth;

export class Vox {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** 色の番号（0 = 空き） */
  readonly c: Uint8Array;
  /** 1 = 陰影をかけない（顔の塗りなど） */
  readonly f: Uint8Array;

  constructor(w: number, d: number, h: number) {
    this.w = w;
    this.d = d;
    this.h = h;
    this.c = new Uint8Array(w * d * h);
    this.f = new Uint8Array(w * d * h);
  }

  idx(x: number, y: number, z: number) {
    return x + y * this.w + z * this.w * this.d;
  }
  inside(x: number, y: number, z: number) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.d && z < this.h;
  }
  get(x: number, y: number, z: number) {
    return this.inside(x, y, z) ? this.c[this.idx(x, y, z)] : 0;
  }
  set(x: number, y: number, z: number, c: number, flat = 0) {
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
    if (!this.inside(x, y, z)) return;
    const i = this.idx(x, y, z);
    this.c[i] = c;
    this.f[i] = c ? flat : 0;
  }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, flat = 0) {
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, z, c, flat);
  }
  /** 超楕円体（p=2 で楕円体、大きいほど角ばる） */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: number, p = 2) {
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const v =
            Math.abs((x + 0.5 - cx) / rx) ** p +
            Math.abs((y + 0.5 - cy) / ry) ** p +
            Math.abs((z + 0.5 - cz) / rz) ** p;
          if (v <= 1) this.set(x, y, z, c);
        }
  }
  /** (x,z) の列で一番手前の y（無ければ -1） */
  front(x: number, z: number) {
    for (let y = this.d - 1; y >= 0; y--) if (this.get(x, y, z)) return y;
    return -1;
  }
  /** 正面の一番外側（と、その1つ奥）を塗る。顔のパーツ用 */
  paint(x: number, z: number, c: number, flat = 1) {
    const y = this.front(x, z);
    if (y < 0) return;
    this.set(x, y, z, c, flat);
    if (this.get(x, y - 1, z)) this.set(x, y - 1, z, c, flat);
  }
  /** 外に面しているか（6方向のどれかが空き） */
  surface(x: number, y: number, z: number) {
    return (
      !!this.get(x, y, z) &&
      (!this.get(x + 1, y, z) ||
        !this.get(x - 1, y, z) ||
        !this.get(x, y + 1, z) ||
        !this.get(x, y - 1, z) ||
        !this.get(x, y, z + 1) ||
        !this.get(x, y, z - 1))
    );
  }
  clone() {
    const v = new Vox(this.w, this.d, this.h);
    v.c.set(this.c);
    v.f.set(this.f);
    return v;
  }
  count() {
    let n = 0;
    for (let i = 0; i < this.c.length; i++) if (this.c[i]) n++;
    return n;
  }
}

// ---- 色 ----
export type RGB = [number, number, number];
export const hexToRgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
export const mixRgb = (c: RGB, t: RGB, a: number): RGB => [
  Math.round(c[0] + (t[0] - c[0]) * a),
  Math.round(c[1] + (t[1] - c[1]) * a),
  Math.round(c[2] + (t[2] - c[2]) * a),
];
/** ImageData を Uint32Array で見たときの1ピクセル（リトルエンディアン: 0xAABBGGRR） */
export const packRgba = ([r, g, b]: RGB, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

/** パレット: 添字 = 色の番号。0 は使わない */
export type Palette = (string | null)[];
