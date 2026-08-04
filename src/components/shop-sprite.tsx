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
};

export function ShopSprite(props: { id: string; px?: number; label?: string }) {
  const item = shopItemById(props.id);
  if (!item) return null;
  const px = props.px ?? 4;
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
              background: COLORS[ch] ?? "transparent",
            }}
          />
        ))
      )}
    </span>
  );
}
