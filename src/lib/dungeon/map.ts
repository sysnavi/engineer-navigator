// 迷路（一人称探索の階）。純関数・乱数は注入。
//
// 【設計】
//  - 1階 = N×N の格子（外周は壁・奇数マスが通路の候補）。再帰的バックトラッカーで迷路を掘り、
//    行き止まりを数か所つないで回遊できるようにする（一本道だとウィザードリィ感が出ない）。
//  - 入口は (1,1)。階段は入口から最も遠いマス（BFS）。
//  - イベント（遭遇/宝箱/罠/休憩/ボス）はマスに事前配置し、踏んだ時に session.ts が解決する。
//    解決したら events から消す（階段だけは残る）。罠は見えない、それ以外は見える。
//  - 大きさは 11×11。イベント同士は 3 マス以上離す（一歩ごとに何かが起きる密度にしない）。
//    歩くこと自体は止まらない（フレーバーの一言はたまにしか出ない・session.ts）。

import type { Rng } from "./battle";

export type CellKind = "ENCOUNTER" | "TREASURE" | "TRAP" | "REST" | "BOSS" | "STAIRS";

export type Facing = 0 | 1 | 2 | 3; // N / E / S / W

export type FloorMap = {
  n: number;
  /** 行ごとの "#"(壁) / "."(通路) */
  cells: string[];
  x: number;
  y: number;
  facing: Facing;
  /** 歩いた場所と隣接（"x,y"）。オートマップに描くのはここだけ */
  seen: string[];
  /** 未解決のイベント（"x,y" → 種類） */
  events: Record<string, CellKind>;
  stairs: [number, number];
};

export const MAP_SIZE = 11;
/** イベント同士の最小間隔（マンハッタン距離）。入口からもこれだけ離す */
export const EVENT_SPACING = 3;
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const cellKey = (x: number, y: number) => `${x},${y}`;

export function isOpen(map: Pick<FloorMap, "n" | "cells">, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.n || y >= map.n) return false;
  return map.cells[y][x] === ".";
}

export function findEvent(map: FloorMap, x: number, y: number): CellKind | undefined {
  return map.events[cellKey(x, y)];
}

/** 自分のマスと隣接4マスを「見た」ことにする */
export function markSeen(map: FloorMap, x: number, y: number): FloorMap {
  const seen = new Set(map.seen);
  seen.add(cellKey(x, y));
  for (const [dx, dy] of DIRS) seen.add(cellKey(x + dx, y + dy));
  return { ...map, seen: [...seen] };
}

/** 入口からの距離（BFS）。壁は -1 */
export function distances(map: Pick<FloorMap, "n" | "cells">, sx = 1, sy = 1): number[][] {
  const d = Array.from({ length: map.n }, () => Array<number>(map.n).fill(-1));
  const q: [number, number][] = [[sx, sy]];
  d[sy][sx] = 0;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (isOpen(map, nx, ny) && d[ny][nx] < 0) {
        d[ny][nx] = d[y][x] + 1;
        q.push([nx, ny]);
      }
    }
  }
  return d;
}

export function generateFloor(params: {
  rng: Rng;
  /** ボスを階段の手前に置く */
  boss: boolean;
  /** 初回の潜行: 入口の隣に宝箱を確定で置く（「持ち帰る楽しさ」を必ず1回は体験させる） */
  firstDive: boolean;
  n?: number;
}): FloorMap {
  const { rng } = params;
  const n = params.n ?? MAP_SIZE;
  const g: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(1));

  // 迷路を掘る
  const stack: [number, number][] = [[1, 1]];
  g[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = (
      [
        [0, -2],
        [2, 0],
        [0, 2],
        [-2, 0],
      ] as const
    ).filter(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx > 0 && ny > 0 && nx < n - 1 && ny < n - 1 && g[ny][nx] === 1;
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [dx, dy] = options[Math.floor(rng() * options.length)];
    g[y + dy / 2][x + dx / 2] = 0;
    g[y + dy][x + dx] = 0;
    stack.push([x + dx, y + dy]);
  }
  // 行き止まりを少し減らして回遊できるように
  const loops = Math.max(2, Math.floor(n / 3));
  for (let i = 0, tries = 0; i < loops && tries < 40; tries++) {
    const x = 1 + Math.floor(rng() * (n - 2));
    const y = 1 + Math.floor(rng() * (n - 2));
    if (
      g[y][x] === 1 &&
      ((g[y][x - 1] === 0 && g[y][x + 1] === 0) || (g[y - 1][x] === 0 && g[y + 1][x] === 0))
    ) {
      g[y][x] = 0;
      i++;
    }
  }

  const cells = g.map((row) => row.map((c) => (c === 1 ? "#" : ".")).join(""));
  const base = { n, cells };
  const dist = distances(base);

  // 階段 = 最遠
  let far: [number, number] = [1, 1];
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      if (dist[y][x] > dist[far[1]][far[0]]) far = [x, y];
    }
  }

  const events: Record<string, CellKind> = {};
  events[cellKey(far[0], far[1])] = "STAIRS";

  const open: [number, number][] = [];
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      if (isOpen(base, x, y) && dist[y][x] >= EVENT_SPACING && !events[cellKey(x, y)]) {
        open.push([x, y]);
      }
    }
  }
  const placed: [number, number][] = [far];
  const farEnough = ([x, y]: [number, number]) =>
    placed.every(([px, py]) => Math.abs(x - px) + Math.abs(y - py) >= EVENT_SPACING);
  /** 置いたイベントから十分離れたマスを選ぶ。無ければどこでも（小さな迷路の保険） */
  const take = (): [number, number] | undefined => {
    const pool = open.filter(farEnough);
    const from = pool.length ? pool : open;
    if (!from.length) return undefined;
    const c = from[Math.floor(rng() * from.length)];
    open.splice(open.indexOf(c), 1);
    placed.push(c);
    return c;
  };
  const place = (kind: CellKind) => {
    const c = take();
    if (c) events[cellKey(c[0], c[1])] = kind;
  };

  if (params.boss) {
    // 階段の手前（入口側）に置く: 階段に隣接する通路のうち、入口に近い方
    const around = DIRS.map(([dx, dy]) => [far[0] + dx, far[1] + dy] as [number, number])
      .filter(([x, y]) => isOpen(base, x, y))
      .sort((a, b) => dist[a[1]][a[0]] - dist[b[1]][b[0]]);
    const spot = around[0];
    if (spot) {
      events[cellKey(spot[0], spot[1])] = "BOSS";
      placed.push(spot);
      const i = open.findIndex(([x, y]) => x === spot[0] && y === spot[1]);
      if (i >= 0) open.splice(i, 1);
    }
  }
  place("ENCOUNTER");
  place("ENCOUNTER");
  place("TREASURE");
  if (rng() < 0.5) place("TRAP");
  place("REST");

  if (params.firstDive) {
    // 入口の隣（最初の一歩）に宝箱
    const next = DIRS.map(([dx, dy]) => [1 + dx, 1 + dy] as [number, number]).find(([x, y]) =>
      isOpen(base, x, y)
    );
    if (next) events[cellKey(next[0], next[1])] = "TREASURE";
  }

  const start: FloorMap = {
    n,
    cells,
    x: 1,
    y: 1,
    facing: isOpen(base, 2, 1) ? 1 : 2,
    seen: [],
    events,
    stairs: far,
  };
  return markSeen(start, 1, 1);
}
