"use client";

// おさんぽのタイルエンジン（ファミコン風・内部320x180をCSSで拡大）。
// 世界の絵は src/lib/walk/world.ts。ここはループ・視差・境界遷移・イベント・ペット描画。
//
// - 進行方向: 背景が右→左に流れ、ペットは前傾＋2コマ歩行＋瞳右向きのwalk差分＋土ぼこり
// - ビオーム境界: 道標が流れてくる間に遠景・中景をクロスフェード（地面は列単位で自然に交代）
// - イベント: 猫・自販機・ベンチ等の前で立ち止まって ひとこと（onEventLine）
// - prefers-reduced-motion: スクロールと歩行を止めた静止画にする

import { useEffect, useRef } from "react";
import {
  W,
  H,
  PET_X,
  PET_FOOT_Y,
  BIOME_LEN,
  biomeAt,
  nextBoundary,
  drawSky,
  drawFar,
  drawMid,
  drawGround,
  drawProp,
  propsForSegment,
  hash,
  type BiomeId,
  type PropInstance,
} from "@/lib/walk/world";
import type { TimeBucket, WeatherBucket } from "@/lib/walk/mutter";

const BASE_SPEED = 26; // px/s（のんびり歩き）
const PET_SIZE = 48;
const EVENT_PAUSE_MS = 4800;

export function WalkCanvas(props: {
  walkSrc: string;
  normalSrc: string;
  time: TimeBucket;
  weather: WeatherBucket;
  /** デバッグ用の早回し（?speed=） */
  speedMul: number;
  onBiomeChange?: (b: BiomeId) => void;
  onEventLine?: (line: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // ループから常に最新のpropsを読むための ref（ループ自体は張り直さない）
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  // ペット画像（walk差分→無ければnormalにフォールバック）。切替中も前の画像で歩き続ける
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) imgRef.current = img;
    };
    img.onerror = () => {
      const fb = new Image();
      fb.onload = () => {
        if (alive) imgRef.current = fb;
      };
      fb.src = props.normalSrc;
    };
    img.src = props.walkSrc;
    return () => {
      alive = false;
    };
  }, [props.walkSrc, props.normalSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let sx = 40; // 草原の途中から歩き出す
    let last = performance.now();
    let raf = 0;
    let pausedUntil = 0;
    let lastBiome: BiomeId | null = null;
    let dustAcc = 0;
    const dust: { x: number; y: number; vx: number; life: number }[] = [];
    // プロップは区間単位で決定的生成してキャッシュ（イベント消化フラグも持つ）
    const segCache = new Map<number, PropInstance[]>();
    const segProps = (s: number): PropInstance[] => {
      let v = segCache.get(s);
      if (!v) {
        v = propsForSegment(s);
        segCache.set(s, v);
      }
      return v;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = propsRef.current;
      const paused = now < pausedUntil;
      const moving = !reduced && !paused;
      const frame = reduced ? 0 : Math.floor(now / 160);

      if (moving) sx += dt * BASE_SPEED * p.speedMul;

      // いまのビオームを通知（つぶやき辞書・AIの文脈に使う）
      const b = biomeAt(sx + PET_X);
      if (b !== lastBiome) {
        lastBiome = b;
        p.onBiomeChange?.(b);
      }

      // イベント: ペットの真横に来たプロップで立ち止まる
      if (moving) {
        const s0 = Math.floor(sx / BIOME_LEN);
        const s1 = Math.floor((sx + W) / BIOME_LEN);
        for (let s = s0; s <= s1; s++) {
          for (const pr of segProps(s)) {
            // プロップの少し手前で立ち止まる（対象が見える位置で「眺める」）
            const d = pr.worldX - (sx + PET_X);
            if (pr.event && !pr.done && d <= 40 && d > -40) {
              pr.done = true;
              pausedUntil = now + EVENT_PAUSE_MS;
              p.onEventLine?.(pr.event.lines[hash(pr.worldX) % pr.event.lines.length]);
            }
          }
        }
      }

      // 土ぼこり（歩行中だけ・進行方向の逆へ流れる）
      if (moving) {
        dustAcc += dt;
        if (dustAcc > 0.22) {
          dustAcc = 0;
          dust.push({
            x: PET_X - 14,
            y: PET_FOOT_Y - 2 - (hash(now | 0) % 4),
            vx: -24 - (hash((now | 0) * 3) % 12),
            life: 0.55,
          });
        }
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.life -= dt;
        d.x += d.vx * dt;
        if (d.life <= 0) dust.splice(i, 1);
      }

      // ===== 描画 =====
      drawSky(ctx, p.time, p.weather, frame, sx);

      // 遠景・中景: 現ビオーム→境界が画面内なら次ビオームをクロスフェード
      const base = biomeAt(sx);
      const nb = nextBoundary(sx);
      const fadeT = nb < sx + W ? Math.min(1, Math.max(0, (sx + W - nb) / W)) : 0;
      drawFar(ctx, base, sx * 0.25, p.time);
      drawMid(ctx, base, sx * 0.55, p.time, frame);
      if (fadeT > 0) {
        const nbio = biomeAt(nb);
        ctx.globalAlpha = fadeT;
        drawFar(ctx, nbio, sx * 0.25, p.time);
        drawMid(ctx, nbio, sx * 0.55, p.time, frame);
        ctx.globalAlpha = 1;
      }

      drawGround(ctx, sx, p.time);

      // プロップ（画面±64pxぶん）
      const ps0 = Math.floor((sx - 64) / BIOME_LEN);
      const ps1 = Math.floor((sx + W + 64) / BIOME_LEN);
      for (let s = ps0; s <= ps1; s++) {
        for (const pr of segProps(s)) drawProp(ctx, pr, sx);
      }

      // 土ぼこり
      for (const d of dust) {
        ctx.fillStyle = `rgba(120,104,78,${(0.55 * d.life) / 0.55})`;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
      }

      // ペット（影→本体。前傾＋2コマ歩行。立ち止まり中はゆっくり呼吸）
      const img = imgRef.current;
      if (img) {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(PET_X - 13, PET_FOOT_Y - 1, 26, 3);
        const step = moving ? frame % 2 : 0;
        const bob = moving ? step * 2 : frame % 8 < 4 ? 0 : 1;
        const lean = moving ? 0.09 + (step ? 0.03 : -0.03) : 0.02;
        ctx.save();
        ctx.translate(PET_X, PET_FOOT_Y - bob);
        ctx.rotate(lean);
        ctx.drawImage(img, -PET_SIZE / 2, -PET_SIZE, PET_SIZE, PET_SIZE);
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="absolute inset-0 h-full w-full"
      style={{ imageRendering: "pixelated" }}
      aria-hidden="true"
    />
  );
}
