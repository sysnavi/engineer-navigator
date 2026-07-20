// PLAYER_FILE.sav カード（TOPヒーロー/デスクトップホーム共用）。
// EXPバー・進化予告・今週のかつどうは PlayerStats（導出値）から描く。

import { PixelAvatar } from "@/components/pixel-avatar";
import type { PlayerStats } from "@/lib/exp";

export function PlayerCard(props: {
  displayName: string;
  player: PlayerStats;
  className?: string;
}) {
  const { player } = props;
  const filledBlocks = Math.round(player.levelProgress * 10);
  return (
    <div
      className={`w-full overflow-hidden rounded-lg border-[2.5px] border-line8 bg-win text-ink shadow-[3px_3px_0_rgba(0,0,0,0.4)] ${props.className ?? ""}`}
    >
      <div className="flex items-center justify-between bg-ink px-3 py-1.5 font-pixel text-[10.5px] tracking-[0.12em] text-white">
        <span>PLAYER_FILE.sav</span>
        <span aria-hidden="true">▮▮▮</span>
      </div>
      <div className="flex items-center gap-3.5 px-3.5 py-3">
        <div className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-lg border-[2.5px] border-line8 bg-surface">
          <PixelAvatar
            sprite={player.stage.sprite}
            px={7}
            accent={player.genes?.dominant.color}
          />
        </div>
        <div className="min-w-0 flex-1">
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
                🔥{player.currentStreak}日連続
              </span>
            )}
          </p>
          {player.genes && (
            <p
              className="truncate font-pixel text-[10px] tracking-[0.08em]"
              style={{ color: player.genes.dominant.color }}
            >
              ◆ {player.genes.title}
            </p>
          )}
          <div
            className="mt-1.5 flex gap-[3px]"
            aria-label={`次のレベルまで ${player.expToNextLevel} EXP`}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <i
                key={i}
                className={`h-3 w-4 rounded-[3px] border-2 border-line8 ${
                  i < filledBlocks
                    ? i === filledBlocks - 1
                      ? "bg-pinkhot"
                      : "bg-lemon"
                    : "bg-win"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-inksoft">
            つぎのLvまで {player.expToNextLevel} EXP
            {player.nextStage &&
              ` ／ Lv${player.nextStage.minLevel}で「${player.nextStage.name}」に進化`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t-2 border-dashed border-peri px-3.5 py-2.5">
        <span className="w-full font-pixel text-[10px] tracking-[0.1em] text-inksoft">
          今週のかつどう
        </span>
        {player.weekActivities.length === 0 ? (
          <span className="text-[11.5px] text-inksoft">
            まだ活動なし。週報から始めよう（+50 EXP）
          </span>
        ) : (
          <>
            {player.weekActivities.map((a) => (
              <span
                key={a.label}
                className="rounded-md border-2 border-line8 bg-surface px-1.5 py-0.5 font-pixel text-[10.5px]"
              >
                {a.label} <span className="text-[var(--good)]">+{a.exp}</span>
              </span>
            ))}
            <span className="ml-auto font-pixel text-[11px] text-pinkhot">
              計 +{player.weekExp} EXP
            </span>
          </>
        )}
      </div>
    </div>
  );
}
