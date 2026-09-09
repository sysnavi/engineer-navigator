"use client";

// 迷路の一人称ビュー（ウィザードリィ風）。
//
// canvas 240×180 に描いてドット拡大する。CSS 3D より軽く WKWebView でも安定する。
// 壁の縁を細い青線でなぞってワイヤーフレームの感触に。奥ほど暗く、たいまつは揺れる。
// 描くのは「見えているもの」だけ: サーバーが渡す objects（罠は含まれない）と壁の配置。
// オートマップは右上に seen のマスだけ。
//
// 移植元の試作: https://claude.ai/code/artifact/ad1da3f1-3354-417f-b586-299db45efe9c

import { useEffect, useRef } from "react";
import { DIRS, type CellKind, type Facing } from "@/lib/dungeon/map";

export type ViewMap = {
  n: number;
  cells: string[];
  x: number;
  y: number;
  seen: string[];
  objects: { x: number; y: number; kind: CellKind }[];
};

const W = 240;
const H = 180;
const HZ = 92; // 地平線
const SC = [1, 0.64, 0.42, 0.27, 0.17, 0.11];
const BR = [1, 0.82, 0.64, 0.48, 0.34, 0.24];
const WALL: [number, number, number] = [46, 68, 140];
const SIDE: [number, number, number] = [34, 52, 110];
const EDGE = "rgba(125,190,240,";

const spriteCache = new Map<string, HTMLImageElement>();
function sprite(name: string): HTMLImageElement {
  let im = spriteCache.get(name);
  if (!im) {
    im = new Image();
    im.src = `/dungeon/${name}.png`;
    spriteCache.set(name, im);
  }
  return im;
}

function frame(k: number) {
  const s = SC[Math.min(k, SC.length - 1)];
  return {
    x0: W / 2 - (W / 2) * s,
    x1: W / 2 + (W / 2) * s,
    y0: HZ - H * 0.52 * s,
    y1: HZ + H * 0.48 * s,
  };
}

export function FirstPersonView(props: {
  map: ViewMap;
  facing: Facing;
  /** 戦闘中の敵（中央手前に大きく描く） */
  foe: { sprite: string; boss: boolean } | null;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const flick = useRef(1);
  const { map, facing, foe } = props;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const isWall = (x: number, y: number) =>
      x < 0 || y < 0 || x >= map.n || y >= map.n || map.cells[y][x] !== ".";
    const objAt = (x: number, y: number) => map.objects.find((o) => o.x === x && o.y === y);
    const cellAt = (k: number, side: number): [number, number] => {
      const [dx, dy] = DIRS[facing];
      const [rx, ry] = DIRS[(facing + 1) % 4];
      return [map.x + dx * k + rx * side, map.y + dy * k + ry * side];
    };
    const col = (base: [number, number, number], k: number, mul = 1) => {
      const b = BR[Math.min(k, BR.length - 1)] * flick.current * mul;
      return `rgb(${Math.round(base[0] * b)},${Math.round(base[1] * b)},${Math.round(base[2] * b)})`;
    };
    const quad = (pts: [number, number][], fill: string, k: number) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = EDGE + (0.55 * BR[Math.min(k, 5)]).toFixed(2) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawObject = (kind: CellKind, k: number) => {
      const fr = frame(k);
      const bk = frame(k + 1);
      const w = (fr.x1 - fr.x0) * 0.42;
      const cx = W / 2;
      const floorY = (fr.y1 + bk.y1) / 2;
      if (kind === "ENCOUNTER" || kind === "BOSS") {
        // 何かいる（正体は踏んでから）: 影のシルエットと目
        const s = kind === "BOSS" ? w * 1.2 : w * 0.85;
        ctx.fillStyle = `rgba(6,10,28,${(0.85 * BR[Math.min(k, 5)]).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(cx, floorY - s * 0.45, s * 0.42, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = kind === "BOSS" ? "#f24e9c" : "#ffd84d";
        const e = Math.max(1, Math.round(s * 0.07));
        ctx.fillRect(cx - s * 0.16, floorY - s * 0.55, e, e);
        ctx.fillRect(cx + s * 0.16 - e, floorY - s * 0.55, e, e);
      } else if (kind === "TREASURE") {
        const s = w * 0.5;
        ctx.fillStyle = col([120, 78, 40], k);
        ctx.fillRect(cx - s / 2, floorY - s * 0.6, s, s * 0.6);
        ctx.fillStyle = col([255, 216, 77], k);
        ctx.fillRect(cx - s * 0.08, floorY - s * 0.42, s * 0.16, s * 0.16);
        ctx.strokeStyle = EDGE + "0.5)";
        ctx.strokeRect(cx - s / 2, floorY - s * 0.6, s, s * 0.6);
      } else if (kind === "STAIRS") {
        const s = w * 0.9;
        quad(
          [
            [cx - s / 2, floorY - s * 0.15],
            [cx + s / 2, floorY - s * 0.15],
            [cx + s * 0.36, floorY + s * 0.12],
            [cx - s * 0.36, floorY + s * 0.12],
          ],
          col([8, 12, 30], k),
          k
        );
        ctx.fillStyle = "rgba(255,216,77,0.7)";
        ctx.font = `${Math.max(6, Math.round(s * 0.28))}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("▼", cx, floorY - s * 0.2);
      } else if (kind === "REST") {
        const s = w * 0.35;
        ctx.fillStyle = col([255, 216, 77], k);
        ctx.beginPath();
        ctx.arc(cx, floorY - s * 0.6, s * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col([120, 78, 40], k);
        ctx.fillRect(cx - s * 0.08, floorY - s * 0.5, s * 0.16, s * 0.5);
      }
    };

    const drawMap = () => {
      const cs = 4;
      const ox = W - map.n * cs - 6;
      const oy = 6;
      const seen = new Set(map.seen);
      ctx.fillStyle = "rgba(6,10,28,0.85)";
      ctx.fillRect(ox - 3, oy - 3, map.n * cs + 6, map.n * cs + 6);
      ctx.strokeStyle = "rgba(125,190,240,0.5)";
      ctx.strokeRect(ox - 2.5, oy - 2.5, map.n * cs + 5, map.n * cs + 5);
      for (let y = 0; y < map.n; y++) {
        for (let x = 0; x < map.n; x++) {
          if (!seen.has(`${x},${y}`)) continue;
          const o = objAt(x, y);
          ctx.fillStyle = isWall(x, y)
            ? "#3a56a8"
            : o?.kind === "STAIRS"
              ? "#ffd84d"
              : o?.kind === "ENCOUNTER" || o?.kind === "BOSS"
                ? "#f24e9c"
                : "#cfe1ff";
          ctx.fillRect(ox + x * cs, oy + y * cs, cs, cs);
        }
      }
      ctx.fillStyle = "#ff5bb0";
      ctx.fillRect(ox + map.x * cs, oy + map.y * cs, cs, cs);
      ctx.fillStyle = "#fff";
      const [dx, dy] = DIRS[facing];
      ctx.fillRect(ox + map.x * cs + 1 + dx, oy + map.y * cs + 1 + dy, 2, 2);
    };

    const render = () => {
      ctx.imageSmoothingEnabled = false;
      const sky = ctx.createLinearGradient(0, 0, 0, HZ);
      sky.addColorStop(0, col([10, 16, 44], 0));
      sky.addColorStop(1, col([22, 34, 77], 0));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, HZ);
      const fl = ctx.createLinearGradient(0, HZ, 0, H);
      fl.addColorStop(0, col([26, 40, 88], 0));
      fl.addColorStop(1, col([43, 61, 121], 0));
      ctx.fillStyle = fl;
      ctx.fillRect(0, HZ, W, H - HZ);
      ctx.strokeStyle = "rgba(125,190,240,0.10)";
      for (let k = 1; k < 6; k++) {
        const f = frame(k);
        ctx.beginPath();
        ctx.moveTo(0, f.y1);
        ctx.lineTo(W, f.y1);
        ctx.stroke();
      }

      for (let k = 4; k >= 0; k--) {
        const fr = frame(k);
        const bk = frame(k + 1);
        const [cx, cy] = cellAt(k, 0);
        if (k > 0 && isWall(cx, cy)) continue;
        for (const side of [-1, 1]) {
          const [sx, sy] = cellAt(k, side);
          const X0 = side < 0 ? fr.x0 : fr.x1;
          const X1 = side < 0 ? bk.x0 : bk.x1;
          if (isWall(sx, sy)) {
            quad([[X0, fr.y0], [X1, bk.y0], [X1, bk.y1], [X0, fr.y1]], col(SIDE, k, 0.95), k);
          } else {
            const [ax, ay] = cellAt(k + 1, side);
            quad(
              [[X0, bk.y0], [X1, bk.y0], [X1, bk.y1], [X0, bk.y1]],
              col(WALL, k + 1, isWall(ax, ay) ? 1 : 0.55),
              k + 1
            );
          }
        }
        const [fx, fy] = cellAt(k + 1, 0);
        if (isWall(fx, fy)) {
          quad([[bk.x0, bk.y0], [bk.x1, bk.y0], [bk.x1, bk.y1], [bk.x0, bk.y1]], col(WALL, k + 1), k + 1);
          ctx.strokeStyle = "rgba(255,255,255," + (0.07 * BR[Math.min(k + 1, 5)]).toFixed(3) + ")";
          for (let i = 1; i < 4; i++) {
            const y = bk.y0 + ((bk.y1 - bk.y0) * i) / 4;
            ctx.beginPath();
            ctx.moveTo(bk.x0, y);
            ctx.lineTo(bk.x1, y);
            ctx.stroke();
          }
        }
        const o = objAt(cx, cy);
        if (o && k > 0) drawObject(o.kind, k);
      }

      // 戦闘中の敵: 目の前に大きく
      if (foe) {
        const im = sprite(foe.sprite);
        const fr = frame(1);
        const s = (fr.x1 - fr.x0) * (foe.boss ? 0.62 : 0.5);
        const draw = () => ctx.drawImage(im, W / 2 - s / 2, HZ + 22 - s, s, s);
        if (im.complete && im.naturalWidth > 0) draw();
        else im.onload = () => render();
      }

      const glow = ctx.createRadialGradient(W / 2, HZ + 10, 10, W / 2, HZ + 10, 150);
      glow.addColorStop(0, "rgba(255,216,77," + (0.1 * flick.current).toFixed(3) + ")");
      glow.addColorStop(1, "rgba(255,216,77,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(W / 2, HZ, 60, W / 2, HZ, 170);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      drawMap();
    };

    render();
    if (reduced) return;
    const t = setInterval(() => {
      flick.current = 0.97 + Math.random() * 0.06;
      render();
    }, 140);
    return () => clearInterval(t);
  }, [map, facing, foe]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      aria-label="迷宮の一人称ビュー"
      className={props.className}
      style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
    />
  );
}
