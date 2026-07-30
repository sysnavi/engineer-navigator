// 今日の一問の連続日数。数字だけだと伸びている実感が薄いので、
// 直近7日ぶんのマスを並べて「あと何日で次のボーナスか」を見て分かるようにする。
// （[[twinkle-ux-direction]] と同じ方針: 説明文を読ませない）

export function StreakBar({ streak, best }: { streak: number; best: number }) {
  const inWeek = streak % 7;
  const toBonus = streak > 0 && inWeek === 0 ? 0 : 7 - inWeek;

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
              i < (streak > 0 && inWeek === 0 ? 7 : inWeek)
                ? "bg-royal"
                : "bg-surface2"
            }`}
          />
        ))}
      </span>

      <span className="text-[11.5px] text-inksoft">
        {streak === 0
          ? "まずは1日"
          : toBonus === 0
            ? "★ボーナス達成！"
            : `あと${toBonus}日でボーナス`}
        {best > 0 && `／最長 ${best}日`}
      </span>
    </div>
  );
}
