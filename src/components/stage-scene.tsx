"use client";

// 舞台（地面の上に物とキャラを並べ、◀ ▶ と横スワイプで 8 方向に回す）。ホームの小島と、マイホームの箱庭（リビング）で使う。
// 何をどこに置くかは呼び出し側の StageLayout（島は src/lib/home/stage.ts、リビングは src/lib/home/living3d.ts）。
// 並べ方の計算は src/lib/stack/scene.ts。止めるとき（撮影など）は StackSprite と同じ: ?nospin / window.__STACK_STATIC__ / 動きを減らす設定。
// 止めているときは、回したときだけ描き直す（キャラは正面・ふつうの顔）。
//
// - キャラも決まった所に立ち、地面と一緒に回る。手前の物の陰に入ったとき（layout.occlusion）:
//   島は隠れた所を線の色のシルエットで透かす。リビングは透かさず、完全に隠れたときだけふちを 1 ドットの線で見せる
// - 部屋（layout.room）: 手前に回ってきた壁は描かない（壁に付いた窓・棚・ポスターも一緒に消える）。
//   向きごとに部屋がちょうど入る拡大率にし、回したときは短いアニメで寄り引きする
// - 寄る（layout.zoomable）: ＋ −・ピンチだけ。寄ったらドラッグで見回す（キャラをタップしても寄らない）
// - 歩き回る（item.wander）: 家具をよけて歩き、ときどき spot のある家具で休む（寝る・座る・てっぺん・前・横）。
//   occlusion が outline なら、今の向きで手前の家具の陰に入る所と、ほかの子のすぐそばを避けて行き先を選ぶ
// - 動かす（item.movable）: 指で引きずると onDrag に床の座標を渡す（保存は呼び出し側）
// - 外から: control で笑わせる・立ち止まらせる・画面の位置を聞く

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from "react";
import {
  parseVox,
  bake,
  renderStack,
  modelStack,
  project,
  unproject,
  depthOrder,
  hitTest,
  hiddenMask,
  turnDir,
  faceOf,
  spotPose,
  STACK_STYLE,
  type Stack,
  type Frame,
  type Model,
  type Palette,
  type Placed,
  type Expr,
  type Step,
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
import { genVox } from "@/lib/home/room3d";

const stacks = new Map<string, Promise<Stack>>();
function loadStack(src: string): Promise<Stack> {
  let p = stacks.get(src);
  if (!p) {
    if (src.startsWith("gen:")) {
      const g = genVox(src);
      p = g ? Promise.resolve(bake(g[0], g[1])) : Promise.reject(new Error(src));
    } else
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

/** 読み込んだ絵（id ごと）。並べ方（位置など）は毎コマ layout から読む */
type Loaded = { id: string; stack?: Stack; model?: Model };
/** 歩き回るキャラの今の様子 */
type Walker = {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  face: number;
  until: number;
  mode: "idle" | "walk" | "go" | "rest";
  walks: number;
  /** 休んでいる・休みに行く家具の id */
  spot?: string;
  sleep: boolean;
  /** 外から止められている（ごはん・おせわ中）。この間はこちらを向く */
  holdUntil: number;
};

export type StageControl = {
  /** そのキャラを笑わせて跳ねさせる */
  smile: (id: string) => void;
  /** そのキャラをしばらく立ち止まらせ、こちらを向かせる */
  hold: (id: string, ms: number) => void;
  /** そのキャラの足元の、枠の中での画面の位置（px）と絵の高さ。いなければ null */
  screenOf: (id: string) => { x: number; y: number; h: number } | null;
};
export type StageDrag = {
  id: string;
  phase: "start" | "move" | "end";
  /** 指の下の床の点（部屋の座標） */
  floor: { x: number; y: number };
  clientX: number;
  clientY: number;
};

const LOOK = [0, 1, 0, STACK_STYLE.dirs - 1];
/** 陰に入ったキャラのシルエットの濃さ（0〜255。中と輪郭） */
const SILHOUETTE = { fill: 100, edge: 235 };
/** occlusion: outline のとき、体（線でない所）の見えている割合がこれ以下なら「完全に隠れた」とみなす */
const HIDDEN_VISIBLE_MAX = 0.03;
/** 行き先を選ぶとき、体のこれ以上が手前の物に隠れる所は避ける */
const AVOID_HIDDEN = 0.35;
/** 行き先を選ぶとき、ほかの子とこれ以上離れていればよしとする（ボクセル） */
const SPREAD = 16;
/** 寄れる段の数 */
const ZOOM_MAX = 3;
/** 歩く速さ（ボクセル / 秒） */
const WALK_SPEED = 7;
/** 回したとき・寄ったときの拡大率のアニメの長さ（ms） */
const SCALE_ANIM = 260;

export function StageScene(props: {
  layout: StageLayout;
  className?: string;
  children?: ReactNode;
  /** キャラをタップしたとき */
  onActorTap?: (id: string) => void;
  /** 動かせる物（movable）を指で引きずったとき */
  onDrag?: (d: StageDrag) => void;
  /** 外から動かす（笑わせる・立ち止まらせる・画面の位置を聞く） */
  ref?: Ref<StageControl>;
}) {
  const { layout, className, children, onActorTap, onDrag, ref } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<{ ground: Stack; items: Map<string, Loaded> } | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, themeServer);
  // 毎コマ最新の並べ方・呼び出し先を読む（家具を動かしても絵を読み直さない）
  const layoutRef = useRef(layout);
  const cbRef = useRef({ onActorTap, onDrag });
  useEffect(() => {
    layoutRef.current = layout;
    cbRef.current = { onActorTap, onDrag };
  });
  const hasDrag = !!onDrag;
  const dirRef = useRef(0);
  const redrawRef = useRef<() => void>(() => {});
  const refitRef = useRef<() => void>(() => {});
  const tapRef = useRef<(x: number, y: number) => void>(() => {});
  const zoomRef = useRef(0);
  const [zoomed, setZoomed] = useState(false);
  const camRef = useRef({ x: 0, y: 0 });
  const zoomByRef = useRef<(delta: number) => void>(() => {});
  const panByRef = useRef<(dx: number, dy: number) => void>(() => {});
  const grabRef = useRef<(clientX: number, clientY: number) => string | null>(() => null);
  const dragToRef = useRef<(clientX: number, clientY: number) => { x: number; y: number }>(() => ({ x: 0, y: 0 }));
  const walkersRef = useRef(new Map<string, Walker>());
  // 指の動き（横スワイプで回す・寄っているときはドラッグで見回す・2 本指でピンチ・家具を引きずる）
  const pointers = useRef(new Map<number, { x: number; y: number; x0: number; y0: number }>());
  const pinch = useRef<{ dist: number } | null>(null);
  const dragged = useRef(false);
  const grabbing = useRef<string | null>(null);
  // 絵の読み込みは「どの絵を使うか」が変わったときだけ
  const srcKey = JSON.stringify([layout.ground, layout.items.map((i) => [i.id, i.src, !!i.actor])]);

  useEffect(() => {
    let alive = true;
    const [ground, list] = JSON.parse(srcKey) as [string, [string, string, boolean][]];
    Promise.all([
      loadStack(ground),
      Promise.all(
        list.map(async ([id, src, actor]): Promise<Loaded> =>
          actor ? { id, model: await loadStackModel(src, false) } : { id, stack: await loadStack(src) },
        ),
      ),
    ])
      .then(([g, items]) => alive && setScene({ ground: g, items: new Map(items.map((l) => [l.id, l])) }))
      .catch(() => {
        // 読めなければ空の舞台のまま（札とボタンは出ている）
      });
    return () => {
      alive = false;
    };
  }, [srcKey]);

  const controlRef = useRef<StageControl | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      smile: (id) => controlRef.current?.smile(id),
      hold: (id, ms) => controlRef.current?.hold(id, ms),
      screenOf: (id) => controlRef.current?.screenOf(id) ?? null,
    }),
    [],
  );
  useEffect(() => {
    const cv = canvasRef.current,
      box = boxRef.current;
    if (!scene || !cv || !box) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const line = resolveColor("var(--line, #12235f)");
    let L = layoutRef.current;
    let pitch = L.pitch;
    const byId = () => new Map(L.items.map((i) => [i.id, i]));
    let items = byId();
    // キャラの色: .vox の色に差し替えをかぶせ、CSS 変数は今のきせかえパレットで解く
    const pals = new Map<string, Palette>();
    for (const l of scene.items.values())
      if (l.model) {
        const pal = l.model.palette.slice();
        for (const [i, c] of Object.entries(items.get(l.id)?.palette ?? {})) pal[Number(i)] = resolveColor(c);
        pals.set(l.id, pal);
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
          img.data.set(new Uint8Array(f.px.buffer, f.px.byteOffset, f.px.byteLength));
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
      ox = 0,
      oy = 0,
      placed: Placed<string>[] = [],
      last = performance.now(),
      anim: { from: number; to: number; t0: number } | null = null;
    const smileUntil = new Map<string, number>();
    const t0 = performance.now();
    const dims = (id: string) => scene.items.get(id)?.stack;

    // ---- 歩き回るキャラ（歩く → 家具で休む → また歩く） ----
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const walkers = walkersRef.current;
    const obstacles = () =>
      L.items
        .filter((i) => !i.layer && !i.actor && !i.attach && dims(i.id))
        .map((i) => ({ x: i.x, y: i.y, r: Math.max(dims(i.id)!.w, dims(i.id)!.d) / 2 + 3 }));
    const clear = (x0: number, y0: number, x1: number, y1: number) =>
      obstacles().every((o) => {
        const vx = x1 - x0,
          vy = y1 - y0,
          len = vx * vx + vy * vy || 1,
          t = Math.max(0, Math.min(1, ((o.x - x0) * vx + (o.y - y0) * vy) / len));
        return Math.hypot(x0 + vx * t - o.x, y0 + vy * t - o.y) > o.r;
      });
    const poseAt = (spotId: string) => {
      const it = items.get(spotId),
        st = dims(spotId);
      if (!it?.spot || !st) return null;
      return spotPose(it.spot, { x: it.x, y: it.y, w: st.w, d: st.d, h: st.h, flat: it.layer === "floor", onWall: !!it.attach });
    };
    const syncWalkers = () => {
      for (const it of L.items) {
        if (!it.wander || !L.walk || walkers.has(it.id)) continue;
        walkers.set(it.id, {
          x: it.x,
          y: it.y,
          z: 0,
          tx: it.x,
          ty: it.y,
          face: 0,
          until: performance.now() + rnd(400, 2500),
          mode: "idle",
          walks: Math.floor(rnd(1, 3)),
          sleep: false,
          holdUntil: 0,
        });
      }
      for (const [id, w] of walkers) {
        if (!items.get(id)?.wander) walkers.delete(id);
        // 休んでいた家具が無くなった（しまった）ら、床に降りる
        else if (w.spot && !items.has(w.spot)) Object.assign(w, { z: 0, sleep: false, spot: undefined, mode: "idle", until: 0 });
      }
    };
    const moveTo = (w: Walker, tx: number, ty: number, mode: Walker["mode"]) => {
      w.tx = tx;
      w.ty = ty;
      w.mode = mode;
      w.face = faceOf(tx - w.x, ty - w.y);
    };
    const avoid = () => L.occlusion === "outline";
    // 今の向きで、その子が (x, y, z) に立ったとき、体のどれだけが手前の物に隠れるか（0〜1）。
    // 前の絵（placed）のその子の絵の大きさで見積もる。まだ描いていなければ 0
    const hiddenAt = (id: string, x: number, y: number, z = 0, depthBias = 0) => {
      const self = placed.find((q) => q.item === id);
      if (!self) return 0;
      const dir = dirRef.current;
      const p = project({ x, y, z: L.groundZ + z }, dir, { pitch });
      const back = {
        ...self,
        x0: Math.round(ox + p.x - self.frame.pivotX),
        y0: Math.round(oy + p.y - self.frame.pivotY),
      };
      const depth = p.depth + depthBias;
      const front = placed.filter((q) => {
        const it = items.get(q.item);
        if (!it || it.actor || it.layer || q.item === id) return false;
        const pos = posOf(q.item);
        return project(pos, dir, { pitch }).depth > depth;
      });
      if (!front.length) return 0;
      const { mask } = hiddenMask(back, front);
      let body = 0,
        hid = 0;
      for (let i = 0; i < mask.length; i++)
        if (self.frame.solid[i]) {
          body++;
          if (mask[i]) hid++;
        }
      return body ? hid / body : 0;
    };
    // ほかの子（今いる所と行き先）からの近さ
    const crowd = (id: string, x: number, y: number) => {
      let m = Infinity;
      for (const [k, o] of walkers) {
        if (k === id) continue;
        m = Math.min(m, Math.hypot(o.x - x, o.y - y), Math.hypot(o.tx - x, o.ty - y));
      }
      return m;
    };
    const pickWalk = (id: string, w: Walker) => {
      const A = L.walk!;
      // 候補をいくつか引き、陰に入らない所のうち、ほかの子から十分離れた所（なければ一番離れた所）へ
      let best: { x: number; y: number; d: number } | null = null;
      for (let i = 0; i < 16; i++) {
        const tx = rnd(A.x0, A.x1),
          ty = rnd(A.y0, A.y1);
        if (Math.hypot(tx - w.x, ty - w.y) <= 8 || !clear(w.x, w.y, tx, ty)) continue;
        if (!avoid()) return moveTo(w, tx, ty, "walk");
        if (hiddenAt(id, tx, ty) > AVOID_HIDDEN) continue;
        const d = crowd(id, tx, ty);
        if (d >= SPREAD) return moveTo(w, tx, ty, "walk");
        if (!best || d > best.d) best = { x: tx, y: ty, d };
      }
      if (best) return moveTo(w, best.x, best.y, "walk");
      w.until = performance.now() + 800;
    };
    const pickRest = (id: string, w: Walker) => {
      // その子のお気に入り（きょう使う家具）→ 空いている家具 → なければその場で休む
      const taken = new Set([...walkers.entries()].filter(([k, o]) => k !== id && o.spot).map(([, o]) => o.spot));
      const home = items.get(id)?.home;
      // 今の向きで、休む姿が手前の家具の陰に入る家具は選ばない（回せばまた選ばれる）
      const visible = (spotId: string) => {
        if (!avoid()) return true;
        const p = poseAt(spotId);
        return !!p && hiddenAt(id, p.x, p.y, p.z, 0.5) <= AVOID_HIDDEN;
      };
      const free = L.items.filter((i) => i.spot && !taken.has(i.id) && dims(i.id) && visible(i.id));
      const spot =
        home && free.some((i) => i.id === home) ? home : free.length ? free[Math.floor(rnd(0, free.length))].id : null;
      const pose = spot ? poseAt(spot) : null;
      if (!spot || !pose) {
        w.mode = "idle";
        w.walks = Math.floor(rnd(2, 4));
        w.until = performance.now() + rnd(2000, 4000);
        return;
      }
      w.spot = spot;
      moveTo(w, pose.approach.x, pose.approach.y, "go");
    };
    const stepWalkers = (now: number, dt: number) => {
      for (const [id, w] of walkers) {
        if ((smileUntil.get(id) ?? 0) > now || w.holdUntil > now) continue;
        if (w.mode === "idle" || w.mode === "rest") {
          if (now < w.until) continue;
          if (w.mode === "rest") {
            // 休み終わり: 家具から降りて、また歩く
            const pose = w.spot ? poseAt(w.spot) : null;
            if (pose) Object.assign(w, { x: pose.approach.x, y: pose.approach.y });
            Object.assign(w, { z: 0, sleep: false, spot: undefined, mode: "idle", walks: Math.floor(rnd(2, 4)), until: now + 400 });
            continue;
          }
          if (w.walks > 0) pickWalk(id, w);
          else pickRest(id, w);
          continue;
        }
        const dx = w.tx - w.x,
          dy = w.ty - w.y,
          d = Math.hypot(dx, dy),
          step = WALK_SPEED * dt;
        if (d > step) {
          w.x += (dx / d) * step;
          w.y += (dy / d) * step;
          continue;
        }
        w.x = w.tx;
        w.y = w.ty;
        if (w.mode === "walk") {
          w.walks--;
          w.mode = "idle";
          w.until = now + rnd(800, 2600);
        } else {
          // 家具に着いた: その家具のくつろぎ方で休む
          const pose = w.spot ? poseAt(w.spot) : null;
          if (pose) Object.assign(w, { x: pose.x, y: pose.y, z: pose.z, face: pose.face, sleep: pose.sleep });
          w.mode = "rest";
          w.until = now + rnd(9000, 16000);
        }
      }
    };
    const posOf = (id: string) => {
      const w = walkers.get(id);
      const it = items.get(id);
      return w ? { x: w.x, y: w.y, z: w.z } : { x: it?.x ?? 0, y: it?.y ?? 0, z: it?.z ?? 0 };
    };

    // ---- 拡大率 ----
    const targetScale = () => {
      const r = box.getBoundingClientRect();
      // 実際の画素比で刻む（Android の 2.625 倍なども、1 ドットが画面の画素の整数個になる）
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      let base: number;
      if (L.room) {
        // この向きで部屋（床と壁）がちょうど入る拡大率
        const a = (dirRef.current * Math.PI * 2) / STACK_STYLE.dirs;
        const pw = Math.abs(L.room.w * Math.cos(a)) + Math.abs(L.room.d * Math.sin(a)) + 8;
        const ph = (Math.abs(L.room.w * Math.sin(a)) + Math.abs(L.room.d * Math.cos(a))) * pitch + L.room.h + 8;
        base = Math.min(r.width / pw, (r.height * 0.94) / ph);
      } else base = r.width / (L.fitWidth ?? 84);
      // 画面の実際の画素で刻む（Retina なら 2.33 倍なども使え、ドットはそろったまま）
      base = Math.max(L.minScale ?? 3, Math.min(6, Math.floor(base * dpr) / dpr));
      return Math.min(10, base + zoomRef.current);
    };
    const applyScale = (s: number) => {
      const r = box.getBoundingClientRect();
      px = s;
      cw = Math.ceil(r.width / px);
      ch = Math.ceil(r.height / px);
      if (cv.width !== cw) cv.width = cw;
      if (cv.height !== ch) cv.height = ch;
      cv.style.width = `${cw * px}px`;
      cv.style.height = `${ch * px}px`;
    };
    const fit = (animate = false) => {
      const r = box.getBoundingClientRect();
      pitch = L.portraitPitch && r.height > r.width ? L.portraitPitch : L.pitch;
      const to = targetScale();
      if (animate && !still && to !== px) anim = { from: px, to, t0: performance.now() };
      else {
        anim = null;
        applyScale(to);
      }
    };

    const camLive = { ...camRef.current };
    const draw = (now: number) => {
      L = layoutRef.current;
      items = byId();
      syncWalkers();
      const t = (now - t0) / 1000,
        dir = dirRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / SCALE_ANIM),
          e = 1 - (1 - k) ** 3;
        applyScale(anim.from + (anim.to - anim.from) * e);
        if (k >= 1) {
          applyScale(anim.to);
          anim = null;
        }
      }
      if (!still) stepWalkers(now, dt);
      // カメラ: 寄っているときは見ている床の点、引いているときは部屋の真ん中。少しずつ寄せる
      const goal = zoomRef.current ? camRef.current : { x: 0, y: 0 };
      const ease = still ? 1 : Math.min(1, dt * 6);
      camLive.x += (goal.x - camLive.x) * ease;
      camLive.y += (goal.y - camLive.y) * ease;
      const cp = project(camLive, dir, { pitch });
      ox = Math.round(cw / 2 - cp.x);
      oy = Math.round(ch * L.centerY - cp.y);
      ctx.clearRect(0, 0, cw, ch);
      const gf = renderStack(scene.ground, { dir, pitch, line });
      ctx.drawImage(imageOf(gf), Math.round(ox - gf.pivotX), Math.round(oy - gf.pivotY));
      placed = [];

      const drawOne = (it: StageItem, push: boolean) => {
        const l = scene.items.get(it.id);
        if (!l) return;
        const pos = posOf(it.id);
        const w = walkers.get(it.id);
        let st = l.stack;
        let d = dir + (w ? w.face : (it.face ?? 0));
        let z = L.groundZ + pos.z;
        if (l.model) {
          const smiling = !still && (smileUntil.get(it.id) ?? 0) > now;
          const held = !!w && w.holdUntil > now;
          const expr: Expr = still ? "n" : smiling ? "s" : w?.sleep ? "b" : t % 3.1 > 2.95 ? "b" : "n";
          const moving = !!w && !still && (w.mode === "walk" || w.mode === "go") && !smiling && !held;
          st = modelStack(l.model, (moving ? Math.floor(t / 0.13) % 4 : -1) as Step, expr, pals.get(it.id));
          // 笑うとき・止められているときは、こちらを向く
          if (smiling || held) d = 0;
          else if (it.look && !w && !still) d += LOOK[Math.floor(t / 1.4) % LOOK.length];
          if (smiling) z += Math.abs(Math.sin((((smileUntil.get(it.id) ?? 0) - now) / 1200) * Math.PI * 2)) * 6;
        }
        if (!st) return;
        const f = renderStack(st, { dir: turnDir(d, 0), pitch, line });
        const p = project({ x: pos.x, y: pos.y, z }, dir, { pitch });
        const x0 = Math.round(ox + p.x - f.pivotX),
          y0 = Math.round(oy + p.y - f.pivotY);
        ctx.drawImage(imageOf(f), x0, y0);
        if (push) placed.push({ item: it.id, x0, y0, frame: f });
      };
      // 床に敷くもの → 奥の壁（手前に来た壁は描かない）と、その壁に付いた物 → 影 → ふつうの物とキャラを奥から
      const at = (it: StageItem) => ({ it, ...posOf(it.id) });
      for (const { it } of depthOrder(L.items.filter((i) => i.layer === "floor").map(at), dir, { pitch })) drawOne(it, true);
      const walls = L.items.filter((i) => i.layer === "wall" && project(i, dir, { pitch }).depth <= 0.5);
      for (const { it } of depthOrder(walls.map(at), dir, { pitch })) {
        drawOne(it, false);
        for (const a of L.items.filter((i) => i.attach === it.id)) drawOne(a, !!a.movable);
      }
      ctx.fillStyle = "rgba(18,35,95,.18)";
      for (const it of L.items) {
        if (!it.shadow) continue;
        const pos = posOf(it.id);
        if (pos.z > 2) continue; // 家具の上にいるときは床に影を落とさない
        const p = project({ x: pos.x, y: pos.y, z: L.groundZ }, dir, { pitch });
        for (let yy = -2; yy <= 2; yy++) {
          const sw = Math.round(it.shadow * Math.sqrt(1 - (yy / 2.6) ** 2));
          ctx.fillRect(Math.round(ox + p.x - sw), Math.round(oy + p.y + yy), 2 * sw + 1, 1);
        }
      }
      // 家具の上でくつろぐ子は、その家具より手前に描く（同じ奥行きなら後ろに並べる）
      const rest = L.items
        .filter((i) => !i.layer && !i.attach)
        .map((i) => {
          const a = at(i);
          return { ...a, y: a.y + (walkers.get(i.id)?.mode === "rest" ? 0.5 : 0) };
        });
      for (const { it } of depthOrder(rest, dir, { pitch })) drawOne(it, true);
      // キャラが手前の物に隠れたとき（どの向きでも居場所が分かるように）
      placed.forEach((pl, i) => {
        if (!items.get(pl.item)?.actor) return;
        const { mask, count } = hiddenMask(pl, placed.slice(i + 1));
        if (!count) return;
        if (L.occlusion !== "outline") return drawSilhouette(pl, mask);
        // リビング: 透かさない。体がほとんど見えないときだけ、ふちを線で見せる
        let body = 0,
          shown = 0;
        for (let k = 0; k < mask.length; k++)
          if (pl.frame.solid[k]) {
            body++;
            if (!mask[k]) shown++;
          }
        if (body && shown / body <= HIDDEN_VISIBLE_MAX) drawOutline(pl);
      });
    };
    const ghost = document.createElement("canvas");
    const drawSilhouette = (pl: Placed<string>, mask: Uint8Array) => {
      const { frame: f, x0, y0 } = pl;
      ghost.width = f.w;
      ghost.height = f.h;
      const g = ghost.getContext("2d");
      if (!g) return;
      const img = g.createImageData(f.w, f.h);
      // 輪郭は濃く、中は薄く（形が読めて、手前の物の絵も透けて見える）
      for (let i = 0; i < mask.length; i++) if (mask[i]) img.data[i * 4 + 3] = f.solid[i] ? SILHOUETTE.fill : SILHOUETTE.edge;
      g.putImageData(img, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = line;
      g.fillRect(0, 0, f.w, f.h);
      ctx.drawImage(ghost, x0, y0);
    };
    // ふちだけ（絵の線の輪 = 体のまわりの 1 ドット）を線の色で
    const drawOutline = (pl: Placed<string>) => {
      const { frame: f, x0, y0 } = pl;
      ghost.width = f.w;
      ghost.height = f.h;
      const g = ghost.getContext("2d");
      if (!g) return;
      const img = g.createImageData(f.w, f.h);
      for (let i = 0; i < f.solid.length; i++) if (!f.solid[i] && f.px[i] >>> 24) img.data[i * 4 + 3] = SILHOUETTE.edge;
      g.putImageData(img, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = line;
      g.fillRect(0, 0, f.w, f.h);
      ctx.drawImage(ghost, x0, y0);
    };
    const redraw = () => draw(performance.now());

    fit();
    syncWalkers();
    const ro = new ResizeObserver(() => {
      fit();
      redraw();
    });
    ro.observe(box);
    redrawRef.current = redraw;
    // 回したら、その向きでちょうど入る拡大率へなめらかに寄り引きする
    refitRef.current = () => {
      if (L.room) fit(true);
    };
    const actorAt = (x: number, y: number) =>
      hitTest(
        placed.filter((p) => items.get(p.item)?.actor),
        x / px,
        y / px,
      );
    tapRef.current = (x, y) => {
      // キャラは陰に入っていても（シルエットの上でも）タップできる
      const hit = actorAt(x, y);
      if (hit && !still) smileUntil.set(hit, performance.now() + 1200);
      if (hit) cbRef.current.onActorTap?.(hit);
      if (still) redraw();
    };
    zoomByRef.current = (delta) => {
      const z = Math.max(0, Math.min(ZOOM_MAX, zoomRef.current + delta));
      if (z === zoomRef.current) return;
      if (z > 0 && zoomRef.current === 0) camRef.current = { x: camLive.x, y: camLive.y };
      zoomRef.current = z;
      setZoomed(z > 0);
      fit(true);
      if (still) redraw();
    };
    panByRef.current = (dx, dy) => {
      // 画面の動き（px）→ 床の上の動き。指と同じ向きに部屋が動く
      const a = unproject(-dx / px, -dy / px, dirRef.current, { pitch });
      const o = unproject(0, 0, dirRef.current, { pitch });
      const A = L.walk ?? { x0: -40, x1: 40, y0: -40, y1: 40 };
      camRef.current = {
        x: Math.max(A.x0 - 8, Math.min(A.x1 + 8, camRef.current.x + a.x - o.x)),
        y: Math.max(A.y0 - 8, Math.min(A.y1 + 8, camRef.current.y + a.y - o.y)),
      };
      camLive.x = camRef.current.x;
      camLive.y = camRef.current.y;
      if (still) redraw();
    };
    // 家具をつかむ: 指の下の動かせる物（キャラの上ならつかまない）
    grabRef.current = (clientX, clientY) => {
      const r = cv.getBoundingClientRect();
      const x = clientX - r.left,
        y = clientY - r.top;
      if (actorAt(x, y)) return null;
      return hitTest(
        placed.filter((p) => items.get(p.item)?.movable),
        x / px,
        y / px,
      );
    };
    // スマホ: 縦のスクロールはページに渡している（touch-action: pan-y）ので、家具の上から始まる指だけは
    // スクロールを止めて、引きずって動かせるようにする（pointer イベントではスクロールを止められない）
    const onTouchStart = (e: TouchEvent) => {
      if (!hasDrag || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (grabRef.current(t.clientX, t.clientY)) e.preventDefault();
    };
    cv.addEventListener("touchstart", onTouchStart, { passive: false });
    dragToRef.current = (clientX, clientY) => {
      const r = cv.getBoundingClientRect();
      return unproject((clientX - r.left) / px - ox, (clientY - r.top) / px - oy, dirRef.current, { pitch, z: L.groundZ });
    };
    controlRef.current = {
        smile: (id) => {
          smileUntil.set(id, performance.now() + 1200);
          if (still) redraw();
        },
        hold: (id, ms) => {
          const w = walkers.get(id);
          if (w) w.holdUntil = performance.now() + ms;
        },
        screenOf: (id) => {
          if (!items.has(id)) return null;
          const pos = posOf(id);
          const p = project({ x: pos.x, y: pos.y, z: L.groundZ + pos.z }, dirRef.current, { pitch });
          const pl = placed.find((q) => q.item === id);
          return { x: (ox + p.x) * px, y: (oy + p.y) * px, h: (pl?.frame.h ?? 16) * px };
        },
      };
    let raf = 0;
    if (still) redraw();
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
      refitRef.current = () => {};
      tapRef.current = () => {};
      zoomByRef.current = () => {};
      panByRef.current = () => {};
      grabRef.current = () => null;
      cv.removeEventListener("touchstart", onTouchStart);
      controlRef.current = null;
    };
  }, [scene, theme, hasDrag]);

  // 並べ方が変わったら（家具を動かした・増えた）、止めているときも描き直す
  useEffect(() => {
    redrawRef.current();
  }, [layout]);

  const turn = (delta: number) => {
    dirRef.current = turnDir(dirRef.current, delta);
    refitRef.current();
    redrawRef.current();
  };
  const zoomBy = (delta: number) => {
    zoomByRef.current(delta);
  };
  const btn =
    "grid h-9 w-9 place-items-center rounded-[9px] border-[2.5px] border-line8 bg-win text-[15px] font-bold text-ink shadow-[0_3px_0_var(--line)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--line)]";
  const endGrab = (e: React.PointerEvent) => {
    const id = grabbing.current;
    if (!id) return false;
    grabbing.current = null;
    cbRef.current.onDrag?.({ id, phase: "end", floor: dragToRef.current(e.clientX, e.clientY), clientX: e.clientX, clientY: e.clientY });
    return true;
  };

  return (
    <div
      ref={boxRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        background: "linear-gradient(color-mix(in srgb, var(--sky8) 28%, var(--surface)), var(--surface))",
      }}
    >
      <canvas
        ref={canvasRef}
        data-stage-scene
        className="absolute left-0 top-0 block"
        // 寄っているときは指で部屋を見回すので、ページのスクロールに渡さない
        style={{ imageRendering: "pixelated", touchAction: zoomed ? "none" : "pan-y" }}
        onPointerDown={(e) => {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
          dragged.current = false;
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
            grabbing.current = null;
            return;
          }
          // 動かせる家具の上から始まったら、引きずって動かす
          const g = hasDrag ? grabRef.current(e.clientX, e.clientY) : null;
          if (!g) return;
          grabbing.current = g;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // capture できなくても、キャンバスの上の動きで追える
          }
          cbRef.current.onDrag?.({ id: g, phase: "start", floor: dragToRef.current(e.clientX, e.clientY), clientX: e.clientX, clientY: e.clientY });
        }}
        onPointerMove={(e) => {
          const p = pointers.current.get(e.pointerId);
          if (!p) return;
          const dx = e.clientX - p.x,
            dy = e.clientY - p.y;
          p.x = e.clientX;
          p.y = e.clientY;
          if (grabbing.current) {
            dragged.current = true;
            cbRef.current.onDrag?.({ id: grabbing.current, phase: "move", floor: dragToRef.current(e.clientX, e.clientY), clientX: e.clientX, clientY: e.clientY });
            return;
          }
          if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (dist > pinch.current.dist * 1.25) {
              zoomByRef.current(1);
              pinch.current.dist = dist;
            } else if (dist < pinch.current.dist * 0.8) {
              zoomByRef.current(-1);
              pinch.current.dist = dist;
            }
            dragged.current = true;
            return;
          }
          if (zoomed && pointers.current.size === 1) {
            if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 6) dragged.current = true;
            if (dragged.current) panByRef.current(dx, dy);
          }
        }}
        onPointerUp={(e) => {
          const p = pointers.current.get(e.pointerId);
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          if (endGrab(e)) return;
          if (!p || dragged.current) return;
          if (Math.abs(e.clientX - p.x0) > 30) {
            turn(e.clientX > p.x0 ? -1 : 1);
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          tapRef.current(e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = null;
          endGrab(e);
        }}
      />
      {children}
      <div className="absolute right-2.5 top-2.5 z-[2] flex gap-1.5">
        {layout.zoomable && (
          <>
            <button type="button" aria-label="引く" onClick={() => zoomBy(-1)} className={btn}>
              −
            </button>
            <button type="button" aria-label="寄る" onClick={() => zoomBy(1)} className={btn}>
              ＋
            </button>
          </>
        )}
        {[
          [-1, "◀", "左に回す"],
          [1, "▶", "右に回す"],
        ].map(([d, mark, label]) => (
          <button key={label} type="button" aria-label={String(label)} onClick={() => turn(Number(d))} className={btn}>
            {mark}
          </button>
        ))}
      </div>
    </div>
  );
}
