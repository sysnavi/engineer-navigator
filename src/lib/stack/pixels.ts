// 拡大して書き出したドット絵の PNG（ペット・ダンジョンの敵）を、文字マップ → 立体のボクセルに起こす（純ロジック）。
// 手描きの PNG を受け取って .vox の叩き台を作るための変換。仕上げは .vox を MagicaVoxel で直す。
//
//   1. 1 ドットの大きさ（同じ色が続く長さの最大公約数）を見つけて、1 ドット = 1 文字の文字マップに戻す
//   2. 色を番号に割り振る: 黒っぽい色 = 線（4）、一番多い色 = 体（1）、小さい白 = 目の光（5）、ほかは 8 番から順に
//   3. charMapToVox で押し出す。外周の黒ふちは捨て（線は描画側が引き直す）、中の黒（目・口）と白は正面にだけ塗る

import { charMapToVox } from "./charmap";
import { COLOR, rgbToHex, type Palette, type RGB, type Vox } from "./vox";

export type CharMapImage = {
  rows: string[];
  /** 文字 → 色 */
  colors: Record<string, RGB>;
  /** 元の絵の 1 ドットの大きさ（px） */
  dot: number;
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
// 線（k）と空き（.）以外に使う文字
const CHARS = "abcdefghijlmnopqrstuvwxyzABCDEFGHIJLMNOPQRSTUVWXYZ0123456789";

/** 0xAABBGGRR のピクセル → 文字マップ。半透明は不透明（alpha 128 以上）かどうかで分ける */
export function pixelsToCharMap(px: Uint32Array, w: number, h: number, o: { dot?: number } = {}): CharMapImage {
  const at = (x: number, y: number) => {
    const p = px[y * w + x];
    return p >>> 24 < 128 ? 0 : (p | 0xff000000) >>> 0;
  };
  let dot = o.dot ?? 0;
  if (!dot) {
    for (let y = 0; y < h; y++) {
      let run = 1;
      for (let x = 1; x <= w; x++)
        if (x < w && at(x, y) === at(x - 1, y)) run++;
        else {
          dot = gcd(dot, run);
          run = 1;
        }
    }
    for (let x = 0; x < w; x++) {
      let run = 1;
      for (let y = 1; y <= h; y++)
        if (y < h && at(x, y) === at(x, y - 1)) run++;
        else {
          dot = gcd(dot, run);
          run = 1;
        }
    }
  }
  const W = Math.floor(w / dot),
    H = Math.floor(h / dot);
  const charOf = new Map<number, string>();
  let n = 0;
  const colors: Record<string, RGB> = {};
  const rows: string[] = [];
  for (let r = 0; r < H; r++) {
    let row = "";
    for (let c = 0; c < W; c++) {
      const p = at(c * dot + (dot >> 1), r * dot + (dot >> 1));
      if (!p) {
        row += ".";
        continue;
      }
      const rgb: RGB = [p & 255, (p >> 8) & 255, (p >> 16) & 255];
      let ch = charOf.get(p);
      if (!ch) {
        // 黒っぽい色（線）はすべて k にまとめる
        ch = isDark(rgb) ? "k" : CHARS[n++];
        if (!ch) throw new Error(`色が多すぎる（${CHARS.length} 色まで）`);
        charOf.set(p, ch);
        if (!colors[ch]) colors[ch] = rgb;
      }
      row += ch;
    }
    rows.push(row);
  }
  // 上下左右の空きだけの行・列は落とす
  const used = (s: string) => /[^.]/.test(s);
  while (rows.length && !used(rows[0])) rows.shift();
  while (rows.length && !used(rows[rows.length - 1])) rows.pop();
  let left = Infinity,
    right = -1;
  for (const s of rows) {
    const m = s.search(/[^.]/);
    if (m >= 0) {
      left = Math.min(left, m);
      right = Math.max(right, s.length - 1 - [...s].reverse().join("").search(/[^.]/));
    }
  }
  return { rows: rows.map((s) => s.slice(left, right + 1)), colors, dot };
}
const isDark = ([r, g, b]: RGB) => Math.max(r, g, b) < 60;
/** 線だけの絵の中を埋める色（淡い灰青） */
const HOLLOW_BODY = "#e4e8f4";
const isWhite = ([r, g, b]: RGB) => Math.min(r, g, b) > 225;

/** 文字マップ → ボクセルと色。色の番号の約束は vox.ts（4 = 線、5 = 目の光、1 = 体、8 番から体のほかの色） */
export function charMapImageToVox(img: CharMapImage): { vox: Vox; palette: Palette } {
  const count = new Map<string, number>();
  let total = 0;
  for (const s of img.rows)
    for (const ch of s) {
      if (ch === "." || ch === "k") continue;
      count.set(ch, (count.get(ch) ?? 0) + 1);
      total++;
    }
  const byCount = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([ch]) => ch);
  // 線の色だけでできた絵（点線で輪郭を描いた中身の無いおばけなど）。そのままでは押し出す体が無いので、
  // 点線の内側を淡い体（HOLLOW_BODY）で埋め、点線・目・口は正面の塗りにする
  if (!byCount.length) {
    const H = img.rows.length,
      W = img.rows[0].length,
      dot = (x: number, r: number) => r >= 0 && r < H && x >= 0 && x < W && img.rows[r][x] === "k";
    const near = (x: number, r: number) => {
      for (let dr = -1; dr <= 1; dr++) for (let dx = -1; dx <= 1; dx++) if (dot(x + dx, r + dr)) return true;
      return false;
    };
    // 点線を 1 ドット太らせて閉じ、外から塗りつぶして届かない所が体
    const out = new Uint8Array((W + 2) * (H + 2)),
      q: [number, number][] = [[-1, -1]];
    while (q.length) {
      const [x, r] = q.pop() as [number, number];
      const i = (r + 1) * (W + 2) + (x + 1);
      if (x < -1 || r < -1 || x > W || r > H || out[i] || near(x, r)) continue;
      out[i] = 1;
      q.push([x + 1, r], [x - 1, r], [x, r + 1], [x, r - 1]);
    }
    const rows = img.rows.map((s, r) =>
      [...s].map((ch, x) => (ch === "k" ? "k" : out[(r + 1) * (W + 2) + (x + 1)] ? "." : "a")).join(""),
    );
    const vox = charMapToVox(rows, { colors: { a: COLOR.body, k: COLOR.line }, outline: "\u0000", facePaint: ["k"], fill: COLOR.body });
    return { vox, palette: [null, HOLLOW_BODY, null, null, img.colors.k ? rgbToHex(img.colors.k) : "#1a1a24"] };
  }
  const colors: Record<string, number> = { k: COLOR.line };
  const palette: Palette = [null, null, null, null, img.colors.k ? rgbToHex(img.colors.k) : "#1a1a24"];
  const facePaint: string[] = [];
  let next = 8;
  for (const ch of byCount) {
    const rgb = img.colors[ch];
    if (ch === byCount[0]) {
      colors[ch] = COLOR.body;
      palette[COLOR.body] = rgbToHex(rgb);
    } else if (isWhite(rgb) && (count.get(ch) ?? 0) <= total * 0.15 && palette[COLOR.eyeLight] === undefined) {
      // 小さい白（目の光・歯など）は顔の塗りとして正面にだけ付ける
      colors[ch] = COLOR.eyeLight;
      palette[COLOR.eyeLight] = rgbToHex(rgb);
      facePaint.push(ch);
    } else {
      colors[ch] = next;
      palette[next++] = rgbToHex(rgb);
    }
  }
  for (let i = 0; i < palette.length; i++) if (palette[i] === undefined) palette[i] = null;
  const vox = charMapToVox(img.rows, { colors, outline: "k", facePaint });
  return { vox, palette };
}
