// げんばNPCのドット絵。3D（スプライトスタッキング・public/stack/npc/<id>.vox）で描き、
// 読み込むまで（とサーバーレンダリング）は原本の文字マップ（npc-sprite-data.ts）を CSS グリッドで出す。
// 世界観はペットと同じ「鳥と小動物」。設計書のラフを12x12で清書したもの。

import type { NpcId } from "@/lib/genba/content";
import { StackSprite, type StackAction } from "@/components/stack-sprite";
import { NPC_COLORS, NPC_SPRITES, NPC_VOX_PALETTE } from "./npc-sprite-data";

export function NpcSprite(props: { npc: NpcId; px?: number; action?: StackAction }) {
  const rows = NPC_SPRITES[props.npc];
  const px = props.px ?? 5;
  const grid = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(12, ${px}px)`,
        imageRendering: "pixelated",
      }}
    >
      {rows.flatMap((row, y) =>
        row.split("").map((ch, x) => (
          <i
            key={`${x}-${y}`}
            style={{ width: px, height: px, display: "block", background: NPC_COLORS[ch] ?? "transparent" }}
          />
        ))
      )}
    </div>
  );
  return (
    <div aria-hidden="true">
      <StackSprite
        src={`/stack/npc/${props.npc}.vox`}
        size={12 * px}
        action={props.action}
        palette={NPC_VOX_PALETTE}
        line="var(--ink)"
        fallbackNode={grid}
      />
    </div>
  );
}
