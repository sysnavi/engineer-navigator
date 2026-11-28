"use client";

// 舞台（地面の上に物とキャラを並べ、◀ ▶ と横スワイプで 8 方向に回す）。ホームの小島で使う。
// 何をどこに置くかは呼び出し側の StageLayout（ホームは src/lib/home/stage.ts）。並べ方の計算は src/lib/stack/scene.ts。
// 止めるとき（Bot の撮影など）は StackSprite と同じ: ?nospin / window.__STACK_STATIC__ / 動きを減らす設定。
// 止めているときは、回したときだけ描き直す（キャラは正面・ふつうの顔）。

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  parseVox,
  bake,
  renderStack,
  modelStack,
  placeOf,
  depthOrder,
  hitTest,
  turnDir,
  STACK_STYLE,
  type Stack,
  type Frame,
  type Model,
  type Palette,
  type Placed,
  type Expr,
} from "@/lib/stack";
import {
  loadStackModel,
  isStatic,
  resolveColor,
  subscribeTheme,
  themeSnapshot,
  themeServer,
} from "@/components/stack-sprite";
import type { StageItem, StageLayout } from "@/lib/home/stage";

const stacks = new Map<string, Promise<Stack>>();
function loadStack(src: string): Promise<Stack> {
  let p = stacks.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`${src}: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const { vox, palette } = parseVox(buf);
        return bake(vox, palette);
      });
    p.catch(() => stacks.delete(src));
    stacks.set(src, p);
  }
  return p;
}

type Loaded = { item: StageItem; stack?: Stack; model?: Model };

/** 拡大率（整数）: 幅に合わせて 3〜6 倍 */
const scaleFor = (width: number) =>
  Math.min(6, Math.max(3, Math.floor(width / 84)));
const LOOK = [0, 1, 0, STACK_STYLE.dirs - 1];

export function StageScene(props: {
  layout: StageLayout;
  className?: string;
  children?: ReactNode;
}) {
  const { layout } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<{ ground: Stack; items: Loaded[] } | null>(
    null,
  );
  const theme = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    themeServer,
  );
  const dirRef = useRef(0);
  const redrawRef = useRef<() => void>(() => {});
  const tapRef = useRef<(x: number, y: number) => void>(() => {});
  const swipeFrom = useRef<number | null>(null);
  const layoutKey = JSON.stringify(layout);

  useEffect(() => {
    let alive = true;
    const L: StageLayout = JSON.parse(layoutKey);
    Promise.all([
      loadStack(L.ground),
      Promise.all(
        L.items.map(async (item): Promise<Loaded> =>
          item.actor
            ? { item, model: await loadStackModel(item.src, false) }
            : { item, stack: await loadStack(item.src) },
        ),
      ),
    ])
      .then(([ground, items]) => alive && setScene({ ground, items }))
      .catch(() => {
        // 読めなければ空の舞台のまま（札とボタンは出ている）
      });
    return () => {
      alive = false;
    };
  }, [layoutKey]);

  useEffect(() => {
    const cv = canvasRef.current,
      box = boxRef.current;
    if (!scene || !cv || !box) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const L: StageLayout = JSON.parse(layoutKey);
    const line = resolveColor("var(--line, #12235f)");
    const pitch = L.pitch;
    // キャラの色: .vox の色に差し替えをかぶせ、CSS 変数は今のきせかえパレットで解く
    const pals = new Map<Loaded, Palette>();
    for (const l of scene.items)
      if (l.model) {
        const pal = l.model.palette.slice();
        for (const [i, c] of Object.entries(l.item.palette ?? {}))
          pal[Number(i)] = resolveColor(c);
        pals.set(l, pal);
      }
    const images = new WeakMap<Frame, HTMLCanvasElement>();
    const imageOf = (f: Frame) => {
      let c = images.get(f);
      if (!c) {
        c = document.createElement("canvas");
        c.width = f.w;
        c.height = f.h;
        const g = c.getContext("2d");
        if (g) {
          const img = g.createImageData(f.w, f.h);
          img.data.set(
            new Uint8Array(f.px.buffer, f.px.byteOffset, f.px.byteLength),
          );
          g.putImageData(img, 0, 0);
        }
        images.set(f, c);
      }
      return c;
    };

    const still = isStatic();
    let px = 4,
      cw = 0,
      ch = 0,
      smileUntil = 0,
      placed: Placed<Loaded>[] = [];
    const t0 = performance.now();
    const fit = () => {
      const r = box.getBoundingClientRect();
      px = scaleFor(r.width);
      cw = Math.ceil(r.width / px);
      ch = Math.ceil(r.height / px);
      cv.width = cw;
      cv.height = ch;
      cv.style.width = `${cw * px}px`;
      cv.style.height = `${ch * px}px`;
    };
    const draw = (now: number) => {
      const t = (now - t0) / 1000,
        dir = dirRef.current;
      const ox = cw / 2,
        oy = ch * L.centerY;
      ctx.clearRect(0, 0, cw, ch);
      const gf = renderStack(scene.ground, { dir, pitch, line });
      ctx.drawImage(
        imageOf(gf),
        Math.round(ox - gf.pivotX),
        Math.round(oy - gf.pivotY),
      );
      // 影（足元のだ円）
      ctx.fillStyle = "rgba(18,35,95,.18)";
      for (const { item } of scene.items) {
        if (!item.shadow) continue;
        const p = placeOf({ ...item, z: L.groundZ }, dir, {
          pitch,
        });
        for (let yy = -2; yy <= 2; yy++) {
          const w = Math.round(item.shadow * Math.sqrt(1 - (yy / 2.6) ** 2));
          ctx.fillRect(
            Math.round(ox + p.x - w),
            Math.round(oy + p.y + yy),
            2 * w + 1,
            1,
          );
        }
      }
      const smiling = !still && smileUntil > now;
      const hop = smiling
        ? Math.abs(Math.sin(((smileUntil - now) / 1200) * Math.PI * 2)) * 6
        : 0;
      const order = depthOrder(
        scene.items.map((l) => ({ l, x: l.item.x, y: l.item.y, follow: l.item.follow })),
        dir,
        { pitch },
      );
      placed = [];
      for (const { l } of order) {
        const { item } = l;
        let st = l.stack;
        let d = (item.follow ? 0 : dir) + (item.face ?? 0);
        let z = L.groundZ;
        if (l.model) {
          const expr: Expr = still
            ? "n"
            : smiling
              ? "s"
              : t % 3.1 > 2.95
                ? "b"
                : "n";
          st = modelStack(l.model, -1, expr, pals.get(l));
          if (item.look && !still && !smiling)
            d += LOOK[Math.floor(t / 1.4) % LOOK.length];
          z += hop;
        }
        if (!st) continue;
        const f = renderStack(st, { dir: turnDir(d, 0), pitch, line });
        const p = placeOf({ ...item, z }, dir, { pitch });
        const x0 = Math.round(ox + p.x - f.pivotX),
          y0 = Math.round(oy + p.y - f.pivotY);
        ctx.drawImage(imageOf(f), x0, y0);
        placed.push({ item: l, x0, y0, frame: f });
      }
    };

    fit();
    const ro = new ResizeObserver(() => {
      fit();
      draw(performance.now());
    });
    ro.observe(box);
    redrawRef.current = () => draw(performance.now());
    tapRef.current = (x, y) => {
      const hit = hitTest(placed, x / px, y / px);
      if (hit?.item.actor && !still) smileUntil = performance.now() + 1200;
    };
    let raf = 0;
    if (still) draw(performance.now());
    else {
      const tick = (now: number) => {
        draw(now);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      redrawRef.current = () => {};
      tapRef.current = () => {};
    };
  }, [scene, theme, layoutKey]);

  const turn = (delta: number) => {
    dirRef.current = turnDir(dirRef.current, delta);
    redrawRef.current();
  };

  return (
    <div
      ref={boxRef}
      className={`relative overflow-hidden ${props.className ?? ""}`}
      style={{
        background:
          "linear-gradient(color-mix(in srgb, var(--sky8) 28%, var(--surface)), var(--surface))",
      }}
    >
      <canvas
        ref={canvasRef}
        data-stage-scene
        className="absolute left-0 top-0 block"
        style={{ imageRendering: "pixelated", touchAction: "pan-y" }}
        onPointerDown={(e) => {
          swipeFrom.current = e.clientX;
        }}
        onPointerUp={(e) => {
          const from = swipeFrom.current;
          swipeFrom.current = null;
          if (from !== null && Math.abs(e.clientX - from) > 30) {
            turn(e.clientX > from ? -1 : 1);
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          tapRef.current(e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerCancel={() => {
          swipeFrom.current = null;
        }}
      />
      {props.children}
      <div className="absolute right-2.5 top-2.5 z-[2] flex gap-1.5">
        {[
          [-1, "◀", "左に回す"],
          [1, "▶", "右に回す"],
        ].map(([d, mark, label]) => (
          <button
            key={label}
            type="button"
            aria-label={String(label)}
            onClick={() => turn(Number(d))}
            className="grid h-9 w-9 place-items-center rounded-[9px] border-[2.5px] border-line8 bg-win text-[15px] font-bold text-ink shadow-[0_3px_0_var(--line)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--line)]"
          >
            {mark}
          </button>
        ))}
      </div>
    </div>
  );
}
