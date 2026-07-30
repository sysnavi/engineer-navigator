import { prisma } from "@/lib/db";

// 今日の一問（デイリー）とストリーク。
//
// 毎日1問だけ、その人に固定の問題を出す。ねらいは「今日やることが1つに決まっている」
// 状態を作ること（腕試しは10問セットで、疲れている日に開く気にならない）。
//
// ★出した問題は QuizDaily に保存して確定させる。日付シードで毎回選び直すと、
//   問題が増えたときに過去日の出題が変わり、連続日数が後からズレる。

/** 日付の境目はJST 0時。おさんぽ等と揃えるためローカル時刻で切る */
export function localDayStart(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // @db.Date 列に入れるので、ローカル日付をそのままUTC 0時として持つ
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** userId+日付から決まる整数。人によって出る問題をずらすための安定ハッシュ */
function seedOf(userId: string, day: Date): number {
  const s = `${userId}:${day.toISOString().slice(0, 10)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export type DailyState = {
  day: Date;
  question: {
    id: string;
    topic: string;
    prompt: string;
    choices: string[];
    ratingCount: number;
  } | null;
  answered: boolean;
  correct: boolean | null;
  /** 今日を含む連続達成日数 */
  streak: number;
  /** 過去最長 */
  bestStreak: number;
};

/**
 * 今日の一問を取得（無ければその場で決めて記録する）。
 * 出題できる問題が1問も無いときは question: null を返す（画面側で出し分ける）。
 */
export async function getOrCreateDaily(userId: string): Promise<DailyState> {
  const day = localDayStart();

  const existing = await prisma.quizDaily.findUnique({
    where: { userId_day: { userId, day } },
    include: {
      question: { select: { id: true, topic: true, prompt: true, choices: true, ratingCount: true } },
    },
  });

  const streaks = await computeStreaks(userId);

  if (existing) {
    return {
      day,
      question: existing.question,
      answered: !!existing.answeredAt,
      correct: existing.correct,
      ...streaks,
    };
  }

  // 未解答の問題を優先。全部解き終わっていたら解いた問題からでも出す
  // （「今日の分が無い」で連続記録が途切れる方が体験として悪い）。
  const [candidates, attempted] = await Promise.all([
    prisma.quizQuestion.findMany({
      where: { authorId: { not: userId }, hiddenBy: { none: { userId } } },
      select: { id: true, topic: true, prompt: true, choices: true, ratingCount: true },
      take: 300,
      orderBy: { createdAt: "desc" },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      distinct: ["questionId"],
      select: { questionId: true },
    }),
  ]);
  if (candidates.length === 0) {
    return { day, question: null, answered: false, correct: null, ...streaks };
  }

  const done = new Set(attempted.map((a) => a.questionId));
  const fresh = candidates.filter((c) => !done.has(c.id));
  const pool = fresh.length > 0 ? fresh : candidates;
  const picked = pool[seedOf(userId, day) % pool.length];

  // 同時アクセスで二重作成されても片方に寄せる（unique制約が受け止める）
  const row = await prisma.quizDaily
    .create({ data: { userId, day, questionId: picked.id } })
    .catch(() => null);
  if (!row) {
    const again = await prisma.quizDaily.findUnique({
      where: { userId_day: { userId, day } },
      include: {
        question: { select: { id: true, topic: true, prompt: true, choices: true, ratingCount: true } },
      },
    });
    return {
      day,
      question: again?.question ?? picked,
      answered: !!again?.answeredAt,
      correct: again?.correct ?? null,
      ...streaks,
    };
  }

  return { day, question: picked, answered: false, correct: null, ...streaks };
}

/** 今日の一問に答えたことを記録する（正誤は問わず「やった」で達成） */
export async function markDailyAnswered(
  userId: string,
  questionId: string,
  correct: boolean
): Promise<void> {
  const day = localDayStart();
  await prisma.quizDaily.updateMany({
    // 今日の出題と一致するときだけ。別ルートで同じ問題を解いても達成にはしない…
    // ではなく、達成にする。デイリーの問題をたまたま通常の腕試しで解いた人が
    // 「解いたのに未達成」になる方が理不尽なので、questionId 一致で通す。
    where: { userId, day, questionId, answeredAt: null },
    data: { answeredAt: new Date(), correct },
  });
}

/** 連続達成日数（今日まで／過去最長）。未達成の今日は途切れ扱いにしない */
export async function computeStreaks(
  userId: string
): Promise<{ streak: number; bestStreak: number }> {
  const rows = await prisma.quizDaily.findMany({
    where: { userId, answeredAt: { not: null } },
    select: { day: true },
    orderBy: { day: "desc" },
    take: 400,
  });
  if (rows.length === 0) return { streak: 0, bestStreak: 0 };

  const DAY = 86400_000;
  const days = rows.map((r) => localDayStartOf(r.day).getTime());
  const today = localDayStart().getTime();

  // 現在のストリーク: 今日 or 昨日から遡って連続している分
  let streak = 0;
  if (days[0] === today || days[0] === today - DAY) {
    streak = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i - 1] - days[i] === DAY) streak++;
      else break;
    }
  }

  // 最長ストリーク
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === DAY) run++;
    else run = 1;
    if (run > best) best = run;
  }

  return { streak, bestStreak: Math.max(best, streak) };
}

/** @db.Date で返る値をローカル日付の0時に揃える（DBはUTC 0時で持っている） */
function localDayStartOf(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** ストリークの節目（7日ごと）にボーナスを何回もらえたか */
export function streakBonusCount(totalDays: number): number {
  return Math.floor(totalDays / 7);
}
