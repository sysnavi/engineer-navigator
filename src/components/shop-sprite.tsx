// おかいもの家具のドット絵（pixel-avatar.tsx と同方式・SSR可）。
// マップは src/lib/shop/content.ts の ShopItem.sprite。

import { shopItemById } from "@/lib/shop/content";

const COLORS: Record<string, string> = {
  k: "var(--ink)",
  w: "#ffffff",
  y: "var(--lemon)", // ランプの灯り・トロフィー
  g: "var(--good, #2e9e4f)", // 植物・水草
  n: "#b08050", // 木・棚
  r: "var(--crit, #e5484d)", // ソファ・本・金魚
  b: "var(--royal)", // テレビ・本
  s: "var(--sky8, #bfe0f8)", // 水槽の水・画面の光
  p: "var(--pink-hot)", // ラグ
  o: "#e8a013", // 気泡・アクセント
  d: "#7d5a33", // こい木（ちゃぶだいの脚）
  e: "#efe8d4", // クリーム（かけじく・ブラウン管の筐体）
  m: "#8a8a99", // 金属グレー（筐体・ゲームき）
  t: "#b8d489", // わかば（葉のハイライト・たたみ）
};

/** 未所持コレクションのシルエット表示（？？？）。形だけ見せて欲しさを煽る */
export type SpriteVariant = "full" | "silhouette";

/** LIVING.savシーン用の可変幅スプライト（親要素の幅いっぱいに拡大。SVGなので
 *  非整数倍率でもセルの継ぎ目が出ない）。ドット絵マップは ShopSprite と共通 */
export function ShopSpriteFluid(props: { id: string; label?: string }) {
  const item = shopItemById(props.id);
  if (!item) return null;
  return (
    <svg
      viewBox="0 0 12 12"
      role={props.label ? "img" : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : true}
      shapeRendering="crispEdges"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {item.sprite.flatMap((row, y) =>
        row.split("").map((ch, x) => {
          const fill = COLORS[ch];
          if (fill === undefined) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}

export function ShopSprite(props: {
  id: string;
  px?: number;
  label?: string;
  variant?: SpriteVariant;
}) {
  const item = shopItemById(props.id);
  if (!item) return null;
  const px = props.px ?? 4;
  const silhouette = props.variant === "silhouette";
  return (
    <span
      role={props.label ? "img" : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : true}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(12, ${px}px)`,
        imageRendering: "pixelated",
      }}
    >
      {item.sprite.flatMap((row, y) =>
        row.split("").map((ch, x) => (
          <i
            key={`${x}-${y}`}
            style={{
              width: px,
              height: px,
              display: "block",
              background:
                COLORS[ch] === undefined
                  ? "transparent"
                  : silhouette
                    ? "var(--ink)"
                    : COLORS[ch],
              opacity: silhouette ? 0.22 : undefined,
            }}
          />
        ))
      )}
    </span>
  );
}
