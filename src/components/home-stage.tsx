// ホームの一番上の舞台（A 舞台）。自分のキャラが住む小島を 8 方向に回せる。
// 名前・Lv・EXP は舞台の左上の札。今週のかつどうなどは下の PLAYER_FILE（variant="activity"）。
// 並べ方は src/lib/home/stage.ts、描画は StageScene。

import { StageScene } from "@/components/stage-scene";
import {
  AVATAR_SPRITES,
  AVATAR_VOX_PALETTE,
} from "@/components/pixel-avatar-data";
import { HOME_STAGE, type StageLayout } from "@/lib/home/stage";
import type { PlayerStats } from "@/lib/exp";

export function ExpBlocks({
  progress,
  toNext,
}: {
  progress: number;
  toNext: number;
}) {
  const filled = Math.round(progress * 10);
  return (
    <div
      className="mt-1 flex gap-[3px]"
      role="img"
      aria-label={`次のレベルまで ${toNext} EXP`}
      title={`つぎのLvまで ${toNext} EXP`}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <i
          key={i}
          className={`h-2.5 w-3.5 rounded-[3px] border-2 border-line8 ${
            i < filled
              ? i === filled - 1
                ? "bg-pinkhot"
                : "bg-lemon"
              : "bg-win"
          }`}
        />
      ))}
    </div>
  );
}

export function HomeStage(props: {
  displayName: string;
  player: PlayerStats;
  className?: string;
}) {
  const { player } = props;
  const sprite = AVATAR_SPRITES[player.stage.sprite]
    ? player.stage.sprite
    : "egg";
  const layout: StageLayout = {
    ground: HOME_STAGE.ground,
    groundZ: HOME_STAGE.groundZ,
    pitch: HOME_STAGE.pitch,
    centerY: HOME_STAGE.centerY,
    items: [
      ...HOME_STAGE.props,
      {
        ...HOME_STAGE.player,
        id: "player",
        src: `/stack/avatar/${sprite}.vox`,
        palette: AVATAR_VOX_PALETTE,
      },
    ],
  };
  return (
    <StageScene
      layout={layout}
      className={`h-[340px] rounded-xl border-[2.5px] border-line8 shadow-hard sm:h-[380px] ${props.className ?? ""}`}
    >
      <div className="absolute left-2.5 top-2.5 z-[2] max-w-[62%] rounded-[9px] border-[2.5px] border-line8 bg-win/95 px-2.5 py-1.5 text-ink shadow-[2px_2px_0_var(--line)]">
        <p className="truncate font-pixel text-[14px] tracking-wide">
          {props.displayName}
          {player.generation >= 2 && (
            <span className="ml-1.5 text-[10.5px] text-royal2">
              第{player.generation}世代
            </span>
          )}
        </p>
        <p className="font-pixel text-[11px] tracking-[0.1em] text-pinkhot">
          Lv {player.level} — {player.stage.name}
          {player.currentStreak >= 2 && (
            <span className="ml-1.5 text-[#f59f00]">
              🔥{player.currentStreak}
            </span>
          )}
        </p>
        <ExpBlocks
          progress={player.levelProgress}
          toNext={player.expToNextLevel}
        />
      </div>
    </StageScene>
  );
}
