// LIVING.sav の家具配置ロジック（おかいもの松）。
// scene.ts（DESKTOP.sav）と同じ思想: クライアント（ドラッグのクランプ）と
// サーバー（保存時の検証）で共有する純粋ロジック。prisma依存禁止。
// 座標はシーン内の%（x: 0-100 左→右, y: 0-100 上→下）。家具は中心アンカー。

import type { PetSpotKind, ShopItem } from "@/lib/shop/content";

// ---------------------------------------------------------------------------
// 設置ゾーン
// ---------------------------------------------------------------------------
// LIVINGの見取り図: 上34%が壁（中央にまど）、下66%が床。
//  - wall : まどの上の高い位置（ポスター・かけじく・とけい）
//  - shelf: 壁のかざり棚（まどの左右に板を描く。トロフィー・ぼんさい等の小物）
//  - floor: 床（ソファ・こたつ・ラグ…。ペットの生活圏と同じ場所）

export type LivingZoneId = "wall" | "shelf" | "floor";

export const LIVING_ZONES: Record<LivingZoneId, { y: [number, number]; label: string }> = {
  wall: { y: [8, 18], label: "壁" },
  shelf: { y: [22, 26], label: "かざり棚" },
  floor: { y: [48, 86], label: "床" },
};

export const LIVING_X_MIN = 5;
export const LIVING_X_MAX = 95;

/** かざり棚の板（まどの左右）。x はこのどちらかのセグメントに吸着する */
export const SHELF_SEGMENTS: ReadonlyArray<[number, number]> = [
  [9, 36],
  [64, 91],
];

/** 棚板の描画位置（LivingScene側で棚アイテムの下に板を描く） */
export const SHELF_BOARD_Y = 27.5;

function clampShelfX(x: number): number {
  let best: { x: number; dist: number } | null = null;
  for (const [lo, hi] of SHELF_SEGMENTS) {
    const cx = Math.min(hi, Math.max(lo, x));
    const dist = Math.abs(cx - x);
    if (!best || dist < best.dist) best = { x: cx, dist };
  }
  return best!.x;
}

/** 座標を設置可能ゾーンへクランプする（家具のゾーンは1種類に固定） */
export function clampFurniture(
  item: Pick<ShopItem, "zone">,
  x: number,
  y: number
): { x: number; y: number } {
  const [lo, hi] = LIVING_ZONES[item.zone].y;
  const cy = Math.round(Math.min(hi, Math.max(lo, y)));
  const cx =
    item.zone === "shelf"
      ? Math.round(clampShelfX(x))
      : Math.round(Math.min(LIVING_X_MAX, Math.max(LIVING_X_MIN, x)));
  return { x: cx, y: cy };
}

/** 「かう」直後・収納から出すときの初期配置。ゾーンごとの定位置 + 個数ぶんの小さなズレ */
const DEFAULT_POS: Record<LivingZoneId, { x: number; y: number }> = {
  wall: { x: 22, y: 13 },
  shelf: { x: 18, y: 24 },
  floor: { x: 72, y: 66 },
};

export function defaultLivingPosition(
  item: Pick<ShopItem, "zone">,
  index: number
): { x: number; y: number } {
  const base = DEFAULT_POS[item.zone];
  return clampFurniture(
    item,
    base.x + (index % 5) * 13,
    base.y + ((index * 7) % 3) * 7
  );
}

// ---------------------------------------------------------------------------
// 前後関係（3/4見下ろし: yが大きい=手前）
// ---------------------------------------------------------------------------

/** 家具のスプライトはほぼ正方形。シーン幅% → シーン高さ% のおおよその換算
 *  （aspect 16/8〜16/6 の中間をとる。厳密でなくても前後関係の破綻は起きにくい） */
export const FURN_ASPECT = 2.1;

/** 家具の接地線（下端）のy。前後ソートは接地線で行う */
export function furnitureBottomY(item: Pick<ShopItem, "size">, y: number): number {
  return y + (item.size * FURN_ASPECT) / 2;
}

// ---------------------------------------------------------------------------
// へやの進化（コレクションから決定的に導出。deskTier と対）
// ---------------------------------------------------------------------------

export type RoomTier = { tier: 0 | 1 | 2 | 3; name: string; hint: string };

export function roomTier(
  ownedCount: number,
  completedSeriesCount: number
): RoomTier {
  if (ownedCount >= 14 || completedSeriesCount >= 2)
    return { tier: 3, name: "ゆめのマイホーム", hint: "コレクターだけが知る眺め" };
  if (ownedCount >= 7 || completedSeriesCount >= 1)
    return { tier: 2, name: "なかまとくらす2LDK", hint: "家具7個 or シリーズコンプで進化した" };
  if (ownedCount >= 3)
    return { tier: 1, name: "ひとりぐらしのへや", hint: "家具3個で進化した" };
  return { tier: 0, name: "まっさらルーム", hint: "家具をそろえると へやが育つ" };
}

/** へやの進化で まどが立派になる（LivingSceneのまど幅% とカーテンの有無） */
export const ROOM_WINDOW: Record<RoomTier["tier"], { width: number; curtain: boolean }> = {
  0: { width: 15, curtain: false },
  1: { width: 19, curtain: false },
  2: { width: 23, curtain: true },
  3: { width: 27, curtain: true },
};

// ---------------------------------------------------------------------------
// ペット×家具（日替わり・決定的。deskVisitorIndex と同じハッシュ方針）
// ---------------------------------------------------------------------------

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** きょう家具を使っている子の割当。
 *  petSpot持ちの配置済み家具ごとに約1/2の日で「使う子」が決まる。
 *  1匹は同時に1つの家具しか使わない（先着順）。
 *  返り値: itemId → ペット配列のindex */
export function furnitureLodgers(
  dateISO: string,
  userId: string,
  petCount: number,
  placedItemIds: string[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (petCount === 0) return result;
  const taken = new Set<number>();
  // 家具側もハッシュ順に回して「いつも同じ家具が優先される」偏りを避ける
  const ordered = [...placedItemIds].sort(
    (a, b) => hashStr(`${dateISO}:${a}`) - hashStr(`${dateISO}:${b}`)
  );
  for (const itemId of ordered) {
    if (taken.size >= petCount) break;
    const h = hashStr(`${dateISO}:${userId}:lodge:${itemId}`);
    if (h % 2 !== 0) continue; // きょうは誰も使わない日
    let idx = (h >>> 3) % petCount;
    while (taken.has(idx)) idx = (idx + 1) % petCount;
    taken.add(idx);
    result.set(itemId, idx);
  }
  return result;
}

/** 家具を使っているペットの描画アンカー。
 *  返り値は「ペットのスプライト下端」を置くシーン座標と表示倍率。
 *  behind=true なら家具より奥（zを家具-1）に描く */
export function petAnchorFor(
  kind: PetSpotKind,
  item: Pick<ShopItem, "size" | "zone">,
  x: number,
  y: number
): { x: number; y: number; scale: number; behind: boolean } {
  const h = item.size * FURN_ASPECT; // 家具のおおよその高さ%
  switch (kind) {
    case "sleep": // うえで丸くなる（ラグ・こたつ・ハンモックの中央）
      return { x, y: y + h * 0.18, scale: 0.92, behind: false };
    case "sit": // 座面のうえ（ソファ・ざぶとん）
      return { x, y: y + h * 0.08, scale: 0.9, behind: false };
    case "top": // てっぺん（キャットタワー）
      return { x, y: y - h * 0.42, scale: 0.72, behind: false };
    case "watch": // 棚・壁のものは真下の床から見上げる。床のものは横から
      if (item.zone !== "floor") {
        return { x, y: 56, scale: 1, behind: false };
      }
      return { x: x - item.size * 0.62 - 3, y: y + h * 0.45, scale: 1, behind: false };
    case "front": // まえに陣取る（テレビ・れいぞうこ・きょうたい）
      return { x, y: y + h * 0.52 + 2, scale: 1, behind: false };
  }
}
