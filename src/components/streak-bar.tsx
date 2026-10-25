// 今日の一問の連続日数。数字だけだと伸びている実感が薄いので、
// 直近7日ぶんのマスを並べて、次のボーナスまでの距離をマスの埋まり具合で見せる。
// （[[twinkle-ux-direction]] と同じ方針: 説明文を読ませない。文字は達成したときだけ）

export function StreakBar({ streak, best }: { streak: number; best: number }) {
  const inWeek = streak % 7;
  const bonusNow = streak > 0 && inWeek === 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-2 border-line8 bg-surface px-4 py-3 shadow-hard-sm">
      <span className="flex items-baseline gap-1.5">
        <span aria-hidden className="text-[18px]">
          {streak > 0 ? "🔥" : "🌱"}
        </span>
        <span className="font-pixel text-2xl text-royal">{streak}</span>
        <span className="text-[12px] text-inksoft">日連続</span>
      </span>

      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-sm border-2 border-line8 ${
              i < (bonusNow ? 7 : inWeek)
                ? "bg-royal"
                : "bg-surface2"
            }`}
          />
        ))}
      </span>

      {(bonusNow || best > 0) && (
        <span className="text-[11.5px] text-inksoft">
          {bonusNow && "★ボーナス達成！"}
          {bonusNow && best > 0 && "／"}
          {best > 0 && `最長 ${best}日`}
        </span>
      )}
    </div>
  );
}
