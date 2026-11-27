"use client";

// スプライトスタッキングのキャラを1体表示する部品（.vox を読み、8方向に回る疑似3Dで描く）。
// 描画の中身は src/lib/stack/（純ロジック）。ここは「読み込み・コマ送り・canvas への転写」だけ。
//
//   <StackSprite src="/aliens/vox/alien-01.vox" size={96} action="turn" fallback="/aliens/alien-01-normal.png" />
//
// 止めたいとき（Bot の撮影・比較用のスクショ・動きを減らす設定）:
//   - ページの URL に ?nospin を付ける
//   - window.__STACK_STATIC__ = true（Playwright の addInitScript から）
//   - OS の「視差効果を減らす」（prefers-reduced-motion）
// 止めているときは dir（既定 0 = 正面）の向きで、ふつうの顔のまま動かない。

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import {
  parseVox,
  prepareModel,
  modelStack,
  renderStack,
  frameBounds,
  STACK_STYLE,
  type Model,
  type Expr,
  type Step,
  type Frame,
} from "@/lib/stack";

export type StackAction = "idle" | "turn" | "smile" | "walk";

declare global {
  interface Window {
    __STACK_STATIC__?: boolean;
  }
}

const models = new Map<string, Promise<Model>>();
export function loadStackModel(src: string, legs: boolean): Promise<Model> {
  const key = `${src}|${legs}`;
  let p = models.get(key);
  if (!p) {
    p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`${src}: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const { vox, palette } = parseVox(buf);
        return prepareModel(vox, palette, { legs });
      });
    p.catch(() => models.delete(key));
    models.set(key, p);
  }
  return p;
}

function isStatic() {
  if (typeof window === "undefined") return true;
  if (window.__STACK_STATIC__) return true;
  if (new URLSearchParams(window.location.search).has("nospin")) return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** 時刻 t（秒）でのコマ。action ごとの動き */
function pose(action: StackAction, t: number, baseDir: number): { dir: number; step: Step; expr: Expr } {
  const blink = t % 3.2 > 3.05;
  switch (action) {
    case "turn":
      return { dir: (baseDir + Math.floor(t / 0.32)) % STACK_STYLE.dirs, step: -1, expr: blink ? "b" : "n" };
    case "smile": {
      const ph = (t % 1.6) / 1.6;
      return { dir: baseDir, step: -1, expr: ph > 0.4 && ph < 0.85 ? "s" : blink ? "b" : "n" };
    }
    case "walk":
      return { dir: baseDir, step: (Math.floor(t / 0.13) % 4) as Step, expr: blink ? "b" : "n" };
    default:
      return { dir: baseDir, step: -1, expr: blink ? "b" : "n" };
  }
}

export function StackSprite(props: {
  src: string;
  /** 表示の大きさ（px の正方形）。中で整数倍に拡大してドットをくっきりさせる */
  size: number;
  action?: StackAction;
  /** 向き（0 = 正面、時計回りに 1〜7） */
  dir?: number;
  /** 足があるキャラ（2番の色の足を前後に振って歩く）。無ければ縮み伸びで歩く */
  legs?: boolean;
  /** 読み込むまで出しておく2Dの絵 */
  fallback?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { src, size, action = "idle", dir = 0, legs = false, fallback } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<Model | null>(null);

  useEffect(() => {
    let alive = true;
    loadStackModel(src, legs)
      .then((m) => alive && setModel(m))
      .catch(() => {
        // 読めなければ fallback の2Dのまま
      });
    return () => {
      alive = false;
    };
  }, [src, legs]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!model || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    // 拡大率と足元の位置は「正面・ふつう」の絵で決め、どの向きでも同じにする（向きを変えても跳ねない）
    const ref = renderStack(modelStack(model), { dir: 0 });
    const b = frameBounds(ref) ?? { x0: 0, y0: 0, x1: ref.w - 1, y1: ref.h - 1 };
    const scale = Math.max(1, Math.floor(size / Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1)));
    const baseY = size - (b.y1 - ref.pivotY + 1) * scale; // 足元の中心が来る高さ
    let last = "";
    const draw = (f: Frame, key: string) => {
      if (key === last) return;
      last = key;
      cv.width = f.w;
      cv.height = f.h;
      const img = ctx.createImageData(f.w, f.h);
      img.data.set(new Uint8Array(f.px.buffer, f.px.byteOffset, f.px.byteLength));
      ctx.putImageData(img, 0, 0);
      cv.style.width = `${f.w * scale}px`;
      cv.style.height = `${f.h * scale}px`;
      cv.style.left = `${Math.round(size / 2 - f.pivotX * scale)}px`;
      cv.style.top = `${Math.round(baseY - f.pivotY * scale)}px`;
    };
    const frameAt = (t: number) => {
      const p = pose(action, t, dir);
      const f = renderStack(modelStack(model, p.step, p.expr), { dir: p.dir });
      draw(f, `${p.dir}|${p.step}|${p.expr}`);
    };
    if (isStatic()) {
      draw(renderStack(modelStack(model), { dir }), "static");
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      frameAt((now - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [model, size, action, dir]);

  return (
    <div
      className={props.className}
      style={{ width: size, height: size, position: "relative", ...props.style }}
      aria-hidden="true"
    >
      {!model && fallback && (
        <Image
          src={fallback}
          alt=""
          width={size}
          height={size}
          style={{ imageRendering: "pixelated", position: "absolute", inset: 0 }}
          unoptimized
          priority
        />
      )}
      <canvas
        ref={canvasRef}
        data-stack-sprite={src}
        style={{ position: "absolute", imageRendering: "pixelated", visibility: model ? "visible" : "hidden" }}
      />
    </div>
  );
}
