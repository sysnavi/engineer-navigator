"use client";

// おさんぽのタイルエンジン（ファミコン風・内部320x180をCSSで拡大）。
// 世界の絵は src/lib/walk/world.ts（9ビオーム・巡回順はセッションごとにシャッフル）。
// ここはループ・視差・境界遷移・イベント・ペット描画。
//
// - 進行方向: 背景が右→左に流れ、ペットは前傾＋2コマ歩行＋瞳右向きのwalk差分＋土ぼこり
// - ビオーム境界: 道標が流れてくる間に遠景・中景をクロスフェード（地面は列単位で自然に交代）
// - イベント: 猫・自販機・ベンチ等の前で立ち止まって ひとこと（onEventLine）
// - prefers-reduced-motion: スクロールと歩行を止めた静止画にする

import { useEffect, useRef } from "react";
import {
  W,
  H,
  HORIZON,
  PATH_TOP,
  PET_X,
  PET_FOOT_Y,
  BIOME_LEN,
  INDOOR_BIOMES,
  FORCED_WEATHER,
  AMBIENT_EVENTS,
  biomeAt,
  nextBoundary,
  findSegOf,
  setUnlockedBiomes,
  drawSky,
  drawFar,
  drawMid,
  drawGround,
  drawProp,
  drawWeather,
  propsForSegment,
  hash,
  type BiomeId,
  type PropInstance,
} from "@/lib/walk/world";
import type { TimeBucket, WeatherBucket } from "@/lib/walk/mutter";

const BASE_SPEED = 14; // px/s（のんびり歩き。散歩なので急がない）
const PET_SIZE = 48;
const EVENT_PAUSE_MS = 4800;

// ペットPNGはドット絵（例: 1ドット=24px・横16ドット）だが、そのまま48x48に
// 押し込むとドットが非整数・非正方形につぶれて汚くなる。読み込み時に一度だけ
// 「1ドット=整数px・正方形・アスペクト維持」のオフスクリーンへ焼き直しておく。
function prerenderPet(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  // ドット格子の検出: w,h の公約数のうち、全ブロックが単色になる最大サイズ
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const pcx = probe.getContext("2d");
  let dot = 1;
  if (pcx) {
    pcx.drawImage(img, 0, 0);
    const d = pcx.getImageData(0, 0, w, h).data;
    const uniform = (bs: number): boolean => {
      for (let by = 0; by < h; by += bs) {
        for (let bx = 0; bx < w; bx += bs) {
          const i0 = (by * w + bx) * 4;
          for (let y = by; y < by + bs; y++) {
            for (let x = bx; x < bx + bs; x++) {
              const i = (y * w + x) * 4;
              if (
                Math.abs(d[i] - d[i0]) > 6 ||
                Math.abs(d[i + 1] - d[i0 + 1]) > 6 ||
                Math.abs(d[i + 2] - d[i0 + 2]) > 6 ||
                Math.abs(d[i + 3] - d[i0 + 3]) > 6
              )
                return false;
            }
          }
        }
      }
      return true;
    };
    for (let bs = 48; bs >= 2; bs--) {
      if (w % bs === 0 && h % bs === 0 && uniform(bs)) {
        dot = bs;
        break;
      }
    }
  }
  const out = document.createElement("canvas");
  const ocx = out.getContext("2d");
  if (dot >= 4) {
    // ドット絵: 1ドットを整数pxの正方形に（種族ごとの縦横比もそのまま生きる）
    const n = Math.min(8, Math.max(1, Math.round((PET_SIZE * dot) / h)));
    out.width = (w / dot) * n;
    out.height = (h / dot) * n;
  } else {
    // 格子が見つからない絵（AA入り等）: アスペクト維持で高さだけ合わせる
    out.width = Math.max(1, Math.round((w * PET_SIZE) / h));
    out.height = PET_SIZE;
  }
  if (ocx) {
    ocx.imageSmoothingEnabled = false;
    ocx.drawImage(img, 0, 0, out.width, out.height);
  }
  return out;
}

// 環境イベント（流れ星・犬・ホタル…）の発火間隔。最初は早め、以降はゆったり
const AMBIENT_FIRST_MS = 45000;
const AMBIENT_GAP_MS = 100000;

/** 画面演出（環境イベント・イベント反応の生き物） */
type Fx = { kind: string; born: number };

const RAINBOW = ["#ff6b6b", "#ffb347", "#ffd84d", "#6fbf73", "#5dade2", "#8d84c9"];

/** fx をひとつ描く。false を返したら寿命切れ（呼び出し側が捨てる） */
function drawFx(ctx: CanvasRenderingContext2D, f: Fx, now: number, frame: number): boolean {
  const age = (now - f.born) / 1000;

  if (f.kind === "ryuusei" || f.kind === "eisei") {
    const slow = f.kind === "eisei";
    const dur = slow ? 2.6 : 1.4;
    if (age > dur) return false;
    const x = -20 + age * (slow ? 140 : 260);
    const y = 16 + age * (slow ? 8 : 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
    for (let t = 1; t <= 4; t++) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 - t * 0.1})`;
      ctx.fillRect(Math.round(x) - t * 5, Math.round(y) - t * (slow ? 0 : 1), 4, 1);
    }
    return true;
  }
  if (f.kind === "niji") {
    const dur = 5;
    if (age > dur) return false;
    const a = Math.min(1, age) * (age > dur - 1 ? dur - age : 1) * 0.55;
    const cx = W / 2;
    const cy = HORIZON + 46;
    ctx.globalAlpha = a;
    RAINBOW.forEach((c, i) => {
      const r = 118 - i * 4;
      ctx.fillStyle = c;
      for (let x = cx - r; x <= cx + r; x += 3) {
        const dy = Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx)));
        const y = cy - dy;
        if (y < HORIZON + 8) ctx.fillRect(Math.round(x), Math.round(y), 3, 4);
      }
    });
    ctx.globalAlpha = 1;
    return true;
  }
  if (f.kind === "inu") {
    if (age > 6.5) return false;
    const x = W + 20 - age * 66;
    const y = PET_FOOT_Y - 9;
    const step = frame % 2;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(Math.round(x) - 1, PET_FOOT_Y - 1, 16, 2);
    ctx.fillStyle = "#8a5a34";
    ctx.fillRect(Math.round(x), y, 13, 5); // 胴
    ctx.fillRect(Math.round(x) - 4, y - 3, 6, 5); // 顔（進行方向＝左）
    ctx.fillRect(Math.round(x) - 4, y - 5, 2, 3); // 耳
    ctx.fillRect(Math.round(x) + 12, y - 2 + (step ? 1 : 0), 3, 2); // しっぽ
    ctx.fillStyle = "#6e4426";
    ctx.fillRect(Math.round(x) + 1 + step, y + 5, 2, 4);
    ctx.fillRect(Math.round(x) + 9 - step, y + 5, 2, 4);
    ctx.fillStyle = "#12235f";
    ctx.fillRect(Math.round(x) - 3, y - 2, 1, 1); // 目
    return true;
  }
  if (f.kind === "tori") {
    if (age > 7) return false;
    ctx.fillStyle = "#3a4462";
    for (let i = 0; i < 5; i++) {
      const x = W + 30 - age * 58 + i * 15;
      const y = 26 + (i % 2) * 5 + Math.sin(age * 3 + i) * 3;
      const flap = (frame + i) % 2;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - flap, 2, 1);
      ctx.fillRect(Math.round(x) + 2, Math.round(y) - flap, 2, 1);
    }
    return true;
  }
  if (f.kind === "hotaru") {
    if (age > 8) return false;
    for (let i = 0; i < 6; i++) {
      const x = 50 + i * 44 + Math.sin(age * 0.9 + i * 2) * 10;
      const y = PATH_TOP - 16 + Math.cos(age * 1.3 + i) * 9;
      if (Math.floor(age * 3 + i) % 3 === 2) continue; // 明滅
      ctx.fillStyle = "rgba(220,255,140,0.25)";
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4);
      ctx.fillStyle = "#d8ff7a";
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    return true;
  }
  if (f.kind === "chou") {
    if (age > 8) return false;
    const colors = ["#ffffff", "#ffd84d", "#f7b2cd"];
    for (let i = 0; i < 3; i++) {
      const x = PET_X + 16 + Math.sin(age * 1.4 + i * 2.1) * 30;
      const y = PATH_TOP - 22 + Math.cos(age * 1.9 + i) * 10;
      const open = (frame + i) % 2 === 0;
      ctx.fillStyle = colors[i];
      ctx.fillRect(Math.round(x) - (open ? 2 : 1), Math.round(y), open ? 2 : 1, 2);
      ctx.fillRect(Math.round(x) + 1, Math.round(y), open ? 2 : 1, 2);
    }
    return true;
  }
  if (f.kind === "trig-koumori") {
    if (age > 2) return false;
    ctx.fillStyle = "#3a3454";
    for (let i = 0; i < 4; i++) {
      const x = PET_X + 30 + (i - 1.5) * age * 46;
      const y = PATH_TOP - 26 - age * 46 + (i % 2) * 6;
      const flap = (frame + i) % 2;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - flap, 2, 1);
      ctx.fillRect(Math.round(x) + 2, Math.round(y) - flap, 2, 1);
    }
    return true;
  }
  if (f.kind === "trig-hato") {
    if (age > 2.5) return false;
    ctx.fillStyle = "#9aa2b5";
    for (let i = 0; i < 3; i++) {
      const x = PET_X + 26 + age * 50 + i * 8;
      const y = PATH_TOP - 8 - age * 40 - i * 5;
      const flap = (frame + i) % 2;
      ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - flap, 2, 1);
      ctx.fillRect(Math.round(x) + 3, Math.round(y) - flap, 2, 1);
    }
    return true;
  }
  if (f.kind === "trig-batta") {
    if (age > 1.6) return false;
    const x = PET_X + 28 + age * 70;
    const y = PATH_TOP - 3 - Math.abs(Math.sin(age * 7)) * 13;
    ctx.fillStyle = "#5f9e4a";
    ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
    return true;
  }
  if (f.kind === "trig-gyogun") {
    if (age > 5) return false;
    const colors = ["#ff9a3e", "#ffd75e", "#6fd8c9"];
    for (let i = 0; i < 8; i++) {
      const ang = age * 1.8 + i * 0.785;
      const x = PET_X + Math.cos(ang) * 34;
      const y = PET_FOOT_Y - 26 + Math.sin(ang) * 13;
      ctx.fillStyle = colors[i % 3];
      ctx.fillRect(Math.round(x), Math.round(y), 5, 2);
      ctx.fillRect(Math.round(x) + (Math.cos(ang + 1.6) > 0 ? -2 : 5), Math.round(y), 2, 3);
    }
    return true;
  }
  if (f.kind === "trig-kanketsusen") {
    if (age > 2.4) return false;
    const hgt = Math.sin(Math.min(1, age / 0.5) * Math.PI * 0.5) * 46;
    const x = PET_X + 30;
    ctx.fillStyle = "rgba(223,230,242,0.85)";
    ctx.fillRect(x, Math.round(PATH_TOP - hgt), 5, Math.round(hgt));
    ctx.fillStyle = "rgba(223,230,242,0.55)";
    ctx.fillRect(x - 3, Math.round(PATH_TOP - hgt * 0.7), 3, Math.round(hgt * 0.7));
    ctx.fillRect(x + 5, Math.round(PATH_TOP - hgt * 0.8), 3, Math.round(hgt * 0.8));
    return true;
  }
  // 視覚なしイベント（夕焼け・雷宿り・朝もや）は即おわり
  return false;
}

export function WalkCanvas(props: {
  walkSrc: string;
  normalSrc: string;
  time: TimeBucket;
  weather: WeatherBucket;
  /** デバッグ用の早回し（?speed=） */
  speedMul: number;
  /** カギアイテムで解放済みの特別ビオーム（巡回に混ざる） */
  unlocked?: BiomeId[];
  /** この行き先から歩き始める（「きょうは どこいく？」） */
  startBiome?: BiomeId | null;
  onBiomeChange?: (b: BiomeId) => void;
  /** イベント発生。item はカギアイテムのid（拾ったらサーバーで付与） */
  onEvent?: (line: string, item?: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // ループから常に最新のpropsを読むための ref（ループ自体は張り直さない）
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  // ペット画像（walk差分→無ければnormalにフォールバック）。切替中も前の画像で歩き続ける。
  // 読み込んだら prerenderPet でドット整数化した絵に焼き直して持つ
  const imgRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) imgRef.current = prerenderPet(img);
    };
    img.onerror = () => {
      const fb = new Image();
      fb.onload = () => {
        if (alive) imgRef.current = prerenderPet(fb);
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

    // 解放済みビオームを巡回に混ぜてから位置を決める
    setUnlockedBiomes(propsRef.current.unlocked ?? []);

    let sx = 40; // 最初のビオームの途中から歩き出す
    // ?biome= デバッグ / 行き先選択: 指定ビオームから歩き始める
    const wantBiome =
      (new URLSearchParams(window.location.search).get("biome") as BiomeId | null) ??
      propsRef.current.startBiome ??
      null;
    if (wantBiome) {
      const seg = findSegOf(wantBiome);
      if (seg != null) sx = seg * BIOME_LEN + 40;
    }
    let last = performance.now();
    let raf = 0;
    let pausedUntil = 0;
    let lastBiome: BiomeId | null = null;
    let dustAcc = 0;
    let nextAmbientAt = performance.now() + AMBIENT_FIRST_MS + Math.random() * 30000;
    const fx: Fx[] = [];
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
              p.onEvent?.(
                pr.event.lines[hash(pr.worldX) % pr.event.lines.length],
                pr.event.item
              );
              // 生き物イベントは動きで応える（コウモリ散開・ハト飛び立ち・バッタ跳ね・魚群）
              if (["koumori", "hato", "batta", "gyogun", "kanketsusen"].includes(pr.event.id)) {
                fx.push({ kind: `trig-${pr.event.id}`, born: now });
              }
            }
          }
        }
      }

      // 環境イベント（流れ星・虹・犬・鳥・ホタル・ちょうちょ…）
      if (moving && now > nextAmbientAt) {
        nextAmbientAt = now + AMBIENT_GAP_MS + Math.random() * 80000;
        const cands = AMBIENT_EVENTS.filter(
          (ev) =>
            ev.biomes.includes(b) &&
            (!ev.time || ev.time.includes(p.time)) &&
            (!ev.weather || ev.weather.includes(p.weather))
        );
        if (cands.length > 0) {
          const ev = cands[hash(now | 0) % cands.length];
          p.onEvent?.(ev.lines[hash((now | 0) * 7) % ev.lines.length]);
          if (ev.pause) pausedUntil = now + EVENT_PAUSE_MS;
          fx.push({ kind: ev.id, born: now });
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
      const nowSec = reduced ? 0 : now / 1000;
      // 空も遠景・中景と同じく境界でクロスフェード（レア・特別ビオームは空ごと変わる）
      const base = biomeAt(sx);
      const nb = nextBoundary(sx);
      const fadeT = nb < sx + W ? Math.min(1, Math.max(0, (sx + W - nb) / W)) : 0;
      const nbio = fadeT > 0 ? biomeAt(nb) : base;

      drawSky(ctx, p.time, p.weather, frame, sx, base);
      if (fadeT > 0) {
        ctx.globalAlpha = fadeT;
        drawSky(ctx, p.time, p.weather, frame, sx, nbio);
        ctx.globalAlpha = 1;
      }
      drawFar(ctx, base, sx * 0.25, p.time);
      drawMid(ctx, base, sx * 0.55, p.time, frame, nowSec);
      if (fadeT > 0) {
        ctx.globalAlpha = fadeT;
        drawFar(ctx, nbio, sx * 0.25, p.time);
        drawMid(ctx, nbio, sx * 0.55, p.time, frame, nowSec);
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

      // ペット（影→本体。前傾＋2コマ歩行。立ち止まり中はゆっくり呼吸）。
      // 前傾は rotate だとドット格子が壊れてギザつくので、横スライスを1pxずつ
      // ずらすシアーで表現する（ピクセルは常に格子に乗ったまま）
      const spr = imgRef.current;
      if (spr) {
        const sw = spr.width;
        const sh = spr.height;
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(PET_X - (sw >> 2), PET_FOOT_Y - 1, sw >> 1, 3);
        const step = moving ? frame % 2 : 0;
        const bob = moving ? step * 2 : frame % 8 < 4 ? 0 : 1;
        const lean = moving ? 0.09 + (step ? 0.03 : -0.03) : 0.02;
        const top = PET_FOOT_Y - bob - sh;
        const SLICE = 4;
        for (let y = 0; y < sh; y += SLICE) {
          const rows = Math.min(SLICE, sh - y);
          // 足元0・上ほど進行方向へ（rotateと同じ向きの前傾）
          const off = Math.round(lean * (sh - y - rows / 2));
          ctx.drawImage(spr, 0, y, sw, rows, PET_X - (sw >> 1) + off, top + y, sw, rows);
        }
      }

      // 環境イベントの演出（流れ星・虹・生き物たち）
      for (let i = fx.length - 1; i >= 0; i--) {
        if (!drawFx(ctx, fx[i], now, frame)) fx.splice(i, 1);
      }

      // 天気（雨・雪・霧の粒。世界の一番手前＝吹き出しの奥）。屋内では降らせない。
      // 雪山は天気に関係なく常に雪（FORCED_WEATHER）
      const wb = FORCED_WEATHER[b] ?? p.weather;
      if (!INDOOR_BIOMES.has(b)) drawWeather(ctx, wb, reduced ? 0 : now);
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
