// 2Dのドット絵（文字マップ：1文字=1ドット）を、ふっくらした立体のボクセルに起こす（純ロジック）。
// 既存のキャラ（宇宙人・NPC・アバター…）を3Dの叩き台にするための変換。仕上げは .vox を MagicaVoxel で直す。
//
//   1. 外周の黒ふち（外の空きに接し、かつ色のついたドットに接する線ドット）は捨てる。線は描画側が引き直す
//      触角の棒のように線だけでできた細い部分は残す
//   2. 残った形の「ふちからの距離」で厚みを決める。真ん中ほど厚い、まくらのような形
//   3. 目・口・ほっぺなどの塗りは正面の面にだけ付け、中は体の色で埋める

import { Vox } from "./vox";

export type CharMapOpts = {
  /** 文字 → 色の番号（'.' など載っていない文字は空き） */
  colors: Record<string, number>;
  /** 外周の黒ふちに使っている文字 */
  outline: string;
  /** 顔の塗りとして正面だけに付ける文字（中は fill の色） */
  facePaint?: string[];
  /** 顔の塗りの奥を埋める色の番号。省略時はまわりのドットで一番多い色（卵の白い殻なら白で埋まる） */
  fill?: number;
  /** 厚みの最大（片側のボクセル数）。省略時は形の大きさから決める */
  maxHalf?: number;
};

export function charMapToVox(rows: string[], o: CharMapOpts): Vox {
  const H = rows.length,
    W = Math.max(...rows.map((r) => r.length));
  const at = (x: number, r: number) => (r >= 0 && r < H && x >= 0 && x < W ? (rows[r][x] ?? ".") : ".");
  const filled = (x: number, r: number) => o.colors[at(x, r)] !== undefined || at(x, r) === o.outline;
  const isLine = (x: number, r: number) => at(x, r) === o.outline;
  const colored = (x: number, r: number) => filled(x, r) && !isLine(x, r);

  // 外の空き（外周から塗りつぶしで届く '.'）
  const outside = new Uint8Array(W * H);
  const q: [number, number][] = [];
  for (let x = 0; x < W; x++) q.push([x, 0], [x, H - 1]);
  for (let r = 0; r < H; r++) q.push([0, r], [W - 1, r]);
  while (q.length) {
    const [x, r] = q.pop() as [number, number];
    if (x < 0 || r < 0 || x >= W || r >= H || outside[r * W + x] || filled(x, r)) continue;
    outside[r * W + x] = 1;
    q.push([x + 1, r], [x - 1, r], [x, r + 1], [x, r - 1]);
  }
  const isOut = (x: number, r: number) => x < 0 || r < 0 || x >= W || r >= H || !!outside[r * W + x];

  // 残すドット: 色のついたドットと、外周の黒ふちではない線ドット
  const keep = new Uint8Array(W * H);
  for (let r = 0; r < H; r++)
    for (let x = 0; x < W; x++) {
      if (!filled(x, r)) continue;
      if (!isLine(x, r)) {
        keep[r * W + x] = 1;
        continue;
      }
      const touchesOut = isOut(x + 1, r) || isOut(x - 1, r) || isOut(x, r + 1) || isOut(x, r - 1);
      let touchesColor = false;
      for (let dr = -1; dr <= 1; dr++) for (let dx = -1; dx <= 1; dx++) if (colored(x + dx, r + dr)) touchesColor = true;
      if (!(touchesOut && touchesColor)) keep[r * W + x] = 1;
    }

  // 線だけでできた細い部分（触角の棒など）と、それにつながる黒ふちは残してつなげる（玉や頭から浮かないように）
  const thin = (x: number, r: number) => keep[r * W + x] === 1 && isLine(x, r) && !hasColorNear(x, r);
  const add: number[] = [];
  for (let r = 0; r < H; r++)
    for (let x = 0; x < W; x++) {
      if (keep[r * W + x] || !isLine(x, r)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dr]) => x + dx >= 0 && x + dx < W && r + dr >= 0 && r + dr < H && thin(x + dx, r + dr)))
        add.push(r * W + x);
    }
  const bridge = new Set(add);
  for (const i of add) keep[i] = 1;

  // ふちからの距離（4近傍の段数）
  const dist = new Float32Array(W * H);
  for (let i = 0; i < dist.length; i++) dist[i] = keep[i] ? 1e9 : 0;
  for (let pass = 0; pass < 2; pass++) {
    const rs = pass ? [...Array(H).keys()].reverse() : [...Array(H).keys()];
    const xs = pass ? [...Array(W).keys()].reverse() : [...Array(W).keys()];
    for (const r of rs)
      for (const x of xs) {
        const i = r * W + x;
        if (!keep[i]) continue;
        const nb = (xx: number, rr: number) => (xx < 0 || rr < 0 || xx >= W || rr >= H ? 0 : dist[rr * W + xx]);
        dist[i] = Math.min(dist[i], nb(x - 1, r) + 1, nb(x + 1, r) + 1, nb(x, r - 1) + 1, nb(x, r + 1) + 1);
      }
  }
  let dMax = 1;
  for (let i = 0; i < dist.length; i++) if (keep[i]) dMax = Math.max(dMax, dist[i]);
  const T = o.maxHalf ?? Math.max(1, Math.min(7, Math.round(dMax * 0.75)));
  const D = Math.max(1, dMax);
  const half = (d: number) => {
    const t = Math.min(d, D) / D;
    return Math.round(T * Math.sqrt(1 - (1 - t) ** 2)); // 円の4分の1：ふちは薄く、真ん中は厚い
  };

  const depth = 2 * T + 3,
    cy = T + 1;
  const v = new Vox(W, depth, H);
  const face = new Set(o.facePaint ?? []);
  const fillAt = (x: number, r: number) => {
    if (o.fill !== undefined) return o.fill;
    const n = new Map<number, number>();
    for (let rad = 1; rad <= 3 && !n.size; rad++)
      for (let dr = -rad; dr <= rad; dr++)
        for (let dx = -rad; dx <= rad; dx++) {
          const ch = at(x + dx, r + dr);
          if (!colored(x + dx, r + dr) || face.has(ch)) continue;
          const c = o.colors[ch];
          n.set(c, (n.get(c) ?? 0) + 1);
        }
    let best = 1,
      cnt = -1;
    for (const [c, k] of n) if (k > cnt) [best, cnt] = [c, k];
    return best;
  };
  for (let r = 0; r < H; r++)
    for (let x = 0; x < W; x++) {
      const i = r * W + x;
      if (!keep[i]) continue;
      const ch = at(x, r),
        z = H - 1 - r;
      const col = isLine(x, r) ? (o.colors[o.outline] ?? 4) : o.colors[ch];
      const t = bridge.has(i) || (isLine(x, r) && !hasColorNear(x, r)) ? 0 : half(dist[i]);
      const paintFront = face.has(ch) || (isLine(x, r) && t > 0);
      const back = paintFront ? fillAt(x, r) : col;
      for (let y = cy - t; y <= cy + t; y++) v.set(x, y, z, back);
      if (paintFront) v.set(x, cy + t, z, col, 1);
    }
  return v;

  function hasColorNear(x: number, r: number) {
    for (let dr = -1; dr <= 1; dr++) for (let dx = -1; dx <= 1; dx++) if (colored(x + dx, r + dr)) return true;
    return false;
  }
}
