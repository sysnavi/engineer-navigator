// 戦闘で出す問いの選び方。
//
// 【順位】
//  1. 復習ボックスの期限が来ている問題 — 間違えた問題が「再戦」として戻ってくる
//  2. モンスターの得意領域に合う未解答問題（良問スコア順）
//  3. その他の未解答問題
//  4. ○×マスタ（riddles）／ 解答済み問題 — バンクが枯れても戦闘は成立させる
//
// 難易度は「問題ごとの正答率」で 1〜3 に分け、深い階・ボスの「ためる」ほど難しい方を優先する。
// 選ぶ部分（pickQuestion）は純関数なのでテストできる。DBを引くのは loadCandidates だけ。

import { prisma } from "@/lib/db";
import { topicMatches } from "@/lib/quiz/attempt";
import { RIDDLES, TRUE_FALSE_CHOICES, type Riddle } from "./riddles";
import type { PendingQuestion, Rng } from "./battle";

export type Candidate = {
  id: string;
  topic: string;
  prompt: string;
  choices: string[];
  /** 良問スコアの平均（未評価は -1） */
  rating: number;
  /** 正答率（解答が無ければ null） */
  accuracy: number | null;
  /** 本人が解いたことがあるか */
  attempted: boolean;
  /** 復習ボックスの期限が来ているか */
  due: boolean;
};

/** 正答率 → 難易度。解答が少ない問題は「ふつう」扱い */
export function difficultyOf(accuracy: number | null): 1 | 2 | 3 {
  if (accuracy == null) return 2;
  if (accuracy >= 0.7) return 1;
  if (accuracy >= 0.4) return 2;
  return 3;
}

/** 深度から「いま欲しい難易度」。ボスの「ためる」後は常に難問 */
export function wantedDifficulty(depth: number, charging: boolean): 1 | 2 | 3 {
  if (charging) return 3;
  if (depth < 4) return 1;
  if (depth < 8) return 2;
  return 3;
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 四択を1問選ぶ。候補が無ければ null（呼び出し側が ○× に切り替える）。
 * askedIds に入っている問題は同じ潜行では出さない。
 */
export function pickQuestion(params: {
  candidates: Candidate[];
  topics: string[];
  depth: number;
  charging: boolean;
  askedIds: string[];
  rng: Rng;
}): Candidate | null {
  const asked = new Set(params.askedIds);
  const pool = params.candidates.filter((c) => !asked.has(c.id));
  if (pool.length === 0) return null;

  const want = wantedDifficulty(params.depth, params.charging);
  const onTopic = (c: Candidate) => params.topics.some((t) => topicMatches(t, c.topic));
  const closeness = (c: Candidate) => Math.abs(difficultyOf(c.accuracy) - want);

  // 段階ごとに絞り、その中で「欲しい難易度に近い → 良問スコア高い」順
  const tiers: ((c: Candidate) => boolean)[] = [
    (c) => c.due,
    (c) => !c.attempted && onTopic(c),
    (c) => !c.attempted,
    () => true,
  ];
  for (const tier of tiers) {
    const hits = pool.filter(tier);
    if (hits.length === 0) continue;
    // 同順位はシャッフルしてから安定ソート（毎回同じ問題にならないように）
    const sorted = shuffle(hits, params.rng).sort(
      (a, b) => closeness(a) - closeness(b) || b.rating - a.rating
    );
    // 上位3つの中からランダム（先頭固定だと似た潜行になる）
    const top = sorted.slice(0, 3);
    return top[Math.floor(params.rng() * top.length)];
  }
  return null;
}

/** ○× を1問選ぶ。領域一致を優先し、無ければ全体から */
export function pickRiddle(params: {
  topics: string[];
  askedIds: string[];
  rng: Rng;
}): Riddle | null {
  const asked = new Set(params.askedIds);
  const fresh = RIDDLES.filter((r) => !asked.has(`riddle:${r.id}`));
  const pool = fresh.length > 0 ? fresh : RIDDLES;
  if (pool.length === 0) return null;
  const onTopic = pool.filter((r) =>
    r.topics.some((rt) => params.topics.some((t) => topicMatches(t, rt)))
  );
  const from = onTopic.length > 0 ? onTopic : pool;
  return from[Math.floor(params.rng() * from.length)];
}

export function riddleToPending(r: Riddle, now: number): PendingQuestion {
  return {
    source: "riddle",
    id: r.id,
    kind: "truefalse",
    topic: r.topics[0],
    prompt: r.statement,
    choices: [...TRUE_FALSE_CHOICES],
    difficulty: 1,
    askedAt: now,
    hidden: [],
  };
}

export function candidateToPending(c: Candidate, now: number): PendingQuestion {
  return {
    source: "bank",
    id: c.id,
    kind: "choice",
    topic: c.topic,
    prompt: c.prompt,
    choices: c.choices,
    difficulty: difficultyOf(c.accuracy),
    askedAt: now,
    hidden: [],
  };
}

/** 良問バンクから候補を引く（自作・非表示指定は除外）。正解は含めない */
export async function loadCandidates(userId: string): Promise<Candidate[]> {
  const now = new Date();
  const [questions, attempts, dues, stats] = await Promise.all([
    prisma.quizQuestion.findMany({
      where: { authorId: { not: userId }, hiddenBy: { none: { userId } } },
      select: { id: true, topic: true, prompt: true, choices: true, ratingSum: true, ratingCount: true },
      take: 300,
      orderBy: { createdAt: "desc" },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      distinct: ["questionId"],
      select: { questionId: true },
    }),
    prisma.quizReview.findMany({
      where: { userId, graduatedAt: null, dueAt: { lte: now } },
      select: { questionId: true },
    }),
    // 問題ごとの正答率（全員分）。件数が増えたら QuizQuestion 側にキャッシュする
    prisma.quizAttempt.groupBy({
      by: ["questionId", "correct"],
      _count: { _all: true },
    }),
  ]);
  const attempted = new Set(attempts.map((a) => a.questionId));
  const due = new Set(dues.map((d) => d.questionId));
  const totals = new Map<string, { n: number; ok: number }>();
  for (const s of stats) {
    const t = totals.get(s.questionId) ?? { n: 0, ok: 0 };
    t.n += s._count._all;
    if (s.correct) t.ok += s._count._all;
    totals.set(s.questionId, t);
  }
  return questions.map((q) => {
    const t = totals.get(q.id);
    return {
      id: q.id,
      topic: q.topic,
      prompt: q.prompt,
      choices: q.choices,
      rating: q.ratingCount > 0 ? q.ratingSum / q.ratingCount : -1,
      accuracy: t && t.n >= 3 ? t.ok / t.n : null,
      attempted: attempted.has(q.id),
      due: due.has(q.id),
    };
  });
}
