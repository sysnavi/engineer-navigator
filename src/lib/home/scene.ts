// DESKTOP.sav / LIVING.sav のシーン定義（Issue #12 松）。
// クライアント（ドラッグ時のクランプ）とサーバー（保存時の検証）で共有する純粋ロジック。
// 座標はシーン内の%（x: 0-100 左→右, y: 0-100 上→下）。アイテムは中心アンカー。

import type { Gadget, GadgetCategory } from "@/lib/dungeon/content";

// ---------------------------------------------------------------------------
// 設置ゾーン
// ---------------------------------------------------------------------------

export type ZoneId = "wall" | "desk" | "floor";

/** 各ゾーンの y 範囲（%）。3/4見下ろしビュー: 上部の細い壁 + 大きな床、y=奥行き。
 *  デスクは床の上に「天板の上面が見える」形で描かれ、deskゾーン=天板の上 */
export const ZONES: Record<ZoneId, { y: [number, number]; label: string }> = {
  wall: { y: [7, 28], label: "壁" },
  desk: { y: [37, 54], label: "デスクの上" },
  floor: { y: [62, 90], label: "床" },
};

/** デスクの描画ジオメトリ（%）。正面からの見下ろしパース（ユーザー参考画像準拠）:
 *  天板は左右対称の台形（奥の辺が広い）・脚4本（奥2本は短く見える）。
 *  スプライトは正面向きのまま（ビルボード）で、家具の面だけパースで描く。
 *  縮尺ルール: キャラ（幅10%≒70px）を「ものさし」に、デスク前幅=キャラ約2.5匹ぶん */
export const DESK_GEOM = {
  centerX: 50,
  topWidth: 58, // 奥の辺（広い）
  bottomWidth: 44, // 手前の辺（狭い）= キャラ2.5匹ぶん
  plateTop: 35, // 天板の上面ここから
  plateBottom: 56, // 天板の上面ここまで（= 前縁の始まり）
  edgeBottom: 62, // 前縁（厚み）ここまで
  legBottom: 72, // 前脚ここまで
  rearLegBottom: 66, // 奥脚ここまで（短い=奥行き）
};

/** ガジェットのカテゴリ別サイズ（シーン幅に対する%）。
 *  「モニタとマウスが同じ大きさ」のミニチュア感を排除する縮尺の核。
 *  キャラ=10% を基準: モニタ≒1匹ぶん・マウスは手のひら・ラックは1匹より大きい */
export const GADGET_SIZE: Record<GadgetCategory, number> = {
  kb: 10,
  pt: 4.5,
  dp: 13,
  au: 7,
  dk: 9,
  pc: 12,
  tl: 7,
  rt: 11,
};

/** キャラ（ペット）のシーン幅に対する% — 縮尺の基準になる「ものさし」 */
export const PET_SIZE = 10;

/** 壁に掛けられるカテゴリ（チェアが壁に貼り付く事故だけは構造で防ぐ）。
 *  デスクと床は全カテゴリ可（床置きキーボードはエンジニアのあるある）。 */
const WALL_OK: ReadonlySet<GadgetCategory> = new Set(["dp", "au", "tl", "rt"]);

export function allowedZones(category: GadgetCategory): ZoneId[] {
  return WALL_OK.has(category) ? ["wall", "desk", "floor"] : ["desk", "floor"];
}

export const X_MIN = 5;
export const X_MAX = 95;

/** 座標を設置可能ゾーンへクランプする（yは最も近い許可ゾーンへ吸着） */
export function clampToZones(
  category: GadgetCategory,
  x: number,
  y: number
): { x: number; y: number } {
  const cx = Math.round(Math.min(X_MAX, Math.max(X_MIN, x)));
  const zones = allowedZones(category);
  let best: { y: number; dist: number } | null = null;
  for (const z of zones) {
    const [lo, hi] = ZONES[z].y;
    const cy = Math.min(hi, Math.max(lo, y));
    const dist = Math.abs(cy - y);
    if (!best || dist < best.dist) best = { y: cy, dist };
  }
  return { x: cx, y: Math.round(best!.y) };
}

/** 「▶ 飾る」の初期配置。カテゴリごとの定位置 + 所持順の小さなズレ */
const DEFAULT_POS: Record<GadgetCategory, { x: number; y: number }> = {
  dp: { x: 50, y: 39 }, // ディスプレイはデスク中央奥
  kb: { x: 46, y: 50 }, // キーボードは手前
  pt: { x: 63, y: 51 }, // マウスはその右
  au: { x: 26, y: 42 }, // オーディオは左
  dk: { x: 76, y: 74 }, // チェア系は床
  pc: { x: 20, y: 78 }, // PC・サーバは床の左
  tl: { x: 78, y: 40 }, // 工具はデスク右
  rt: { x: 36, y: 15 }, // レトロは壁に飾りたい
};

export function defaultPosition(
  category: GadgetCategory,
  index: number
): { x: number; y: number } {
  const base = DEFAULT_POS[category];
  return clampToZones(category, base.x + (index % 5) * 6 - 12, base.y + ((index * 7) % 3) * 4);
}

// ---------------------------------------------------------------------------
// デスクの進化（コレクションから決定的に導出。保存不要）
// ---------------------------------------------------------------------------

export type DeskTier = { tier: 0 | 1 | 2 | 3; name: string; hint: string };

export function deskTier(owned: Gadget[]): DeskTier {
  const hasUR = owned.some((g) => g.rarity === "UR");
  const hasSSR = owned.some((g) => g.rarity === "SSR");
  if (hasUR)
    return { tier: 3, name: "伝説のバトルステーション", hint: "UR所持者だけの輝き" };
  if (hasSSR || owned.length >= 8)
    return { tier: 2, name: "電動昇降デスク", hint: "SSR入手 or 8個集めると進化" };
  if (owned.length >= 4)
    return { tier: 1, name: "ウッドワイドデスク", hint: "ガジェット4個で進化した" };
  return { tier: 0, name: "スターターデスク", hint: "ガジェットを集めると進化する" };
}

// ---------------------------------------------------------------------------
// きせかえ（壁紙・床）
// ---------------------------------------------------------------------------

export type ThemeDef = { id: string; name: string; css: string };

export const WALLPAPERS: ThemeDef[] = [
  { id: "cream", name: "クリーム", css: "var(--quote-bg)" },
  {
    id: "graph",
    name: "方眼",
    // サイズは各レイヤーの shorthand（0 0 / 26px 26px）で持つ。
    // 別プロパティで backgroundSize を当てるとグラデ系テーマまで縞になる
    css: "linear-gradient(var(--grid) 1.5px, transparent 1.5px) 0 0 / 26px 26px, linear-gradient(90deg, var(--grid) 1.5px, transparent 1.5px) 0 0 / 26px 26px, var(--win-bg)",
  },
  {
    id: "sunset",
    name: "ゆうやけ",
    css: "linear-gradient(180deg, #ffd9a0 0%, #ffb3c8 70%, #e9a0e8 100%)",
  },
  {
    id: "night",
    name: "よふかし",
    css: "linear-gradient(180deg, #1a2352 0%, #35357a 80%, #4a3d8f 100%)",
  },
];

export const FLOORS: ThemeDef[] = [
  {
    id: "wood",
    name: "フローリング",
    css: "repeating-linear-gradient(90deg, #e8c890 0 46px, #d9b578 46px 48px)",
  },
  {
    id: "tile",
    name: "タイル",
    css: "repeating-conic-gradient(#e8eef6 0% 25%, #d7e2f0 0% 50%) 0 0 / 44px 44px",
  },
  {
    id: "carpet",
    name: "カーペット",
    css: "radial-gradient(circle at 4px 4px, rgba(255,255,255,0.35) 1.5px, transparent 1.5px) 0 0 / 12px 12px, #b7c8e8",
  },
  {
    id: "tatami",
    name: "たたみ",
    css: "repeating-linear-gradient(0deg, #cfe0a8 0 42px, #bfd394 42px 44px)",
  },
];

export function themeCss(list: ThemeDef[], id: string, fallback: string): string {
  return (list.find((t) => t.id === id) ?? list.find((t) => t.id === fallback)!).css;
}

// ---------------------------------------------------------------------------
// ペットのデスク来訪（1日ごとに決定的。乱数不使用）
// ---------------------------------------------------------------------------

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** きょうデスクに遊びに来ているペットの index を返す（来ていない日は null）。
 *  約1/3の日に、飼っているうちの1匹がキーボードのうえでくつろぐ。 */
export function deskVisitorIndex(
  dateISO: string,
  userId: string,
  petCount: number
): number | null {
  if (petCount === 0) return null;
  const h = hashStr(`${dateISO}:${userId}:desk-visit`);
  if (h % 3 !== 0) return null;
  return (h >>> 3) % petCount;
}
