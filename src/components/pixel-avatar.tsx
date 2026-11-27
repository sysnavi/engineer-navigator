// ピクセルアバター。3D（スプライトスタッキング・public/stack/avatar/<sprite>.vox）で描き、
// 読み込むまで（とサーバーレンダリング）は原本の文字マップを CSS グリッドで出す。
// 見た目は進化段階(stage)から決定的に決まる。色はパレットCSS変数のまま渡すので、
// きせかえパレットでも世界観が保たれる（3D でも表示時に今のパレットで色を解く）。

import { StackSprite, type StackAction } from "@/components/stack-sprite";
import { AVATAR_COLORS, AVATAR_SPRITES, AVATAR_VOX_PALETTE } from "@/components/pixel-avatar-data";

function Grid({ rows, px }: { rows: string[]; px: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${rows[0].length}, ${px}px)`,
        imageRendering: "pixelated",
      }}
    >
      {rows.flatMap((row, y) =>
        row.split("").map((ch, x) => (
          <i
            key={`${x}-${y}`}
            style={{ width: px, height: px, display: "block", background: AVATAR_COLORS[ch] ?? "transparent" }}
          />
        ))
      )}
    </div>
  );
}

// accent: 遺伝子カラーのオーラ枠（継承2世代目以降の血統表現）。CSS変数を渡す
// action: 3D の動き（既定は正面でまばたきだけ。"look" でゆっくり左右を見る）
export function PixelAvatar(props: { sprite: string; px?: number; accent?: string; action?: StackAction }) {
  const sprite = AVATAR_SPRITES[props.sprite] ? props.sprite : "egg";
  const rows = AVATAR_SPRITES[sprite];
  const px = props.px ?? 6;
  return (
    <div
      aria-hidden="true"
      style={props.accent ? { boxShadow: `0 0 0 3px ${props.accent}`, borderRadius: 3 } : undefined}
    >
      <StackSprite
        src={`/stack/avatar/${sprite}.vox`}
        size={rows[0].length * px}
        action={props.action}
        palette={AVATAR_VOX_PALETTE}
        line="var(--ink)"
        fallbackNode={<Grid rows={rows} px={px} />}
      />
    </div>
  );
}
