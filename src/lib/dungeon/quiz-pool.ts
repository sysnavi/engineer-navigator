// 戦闘で出す問いの選び方。
//
// 【順位】（pickBattleQuestion）
//  1. 復習ボックスの期限が来ている問題 — 間違えた問題が「再戦」として戻ってくる
//  2. モンスターの得意領域に合う未解答問題（良問バンク・良問スコア順）
//  3. モンスターの得意領域に合う TSマスタの問題（○×・四択）で、この潜行でも直近の潜行でも出していないもの
//     — バンクに領域の問題が無くても「その敵らしい問い」を出す。敵の個性はここで担保する
//  4. その他の未解答問題（良問バンク）→ 解答済み問題
//  5. TSマスタ全体 — バンクが枯れても戦闘は成立させる
// ○×高速ラウンド（foe.rapid）は 3 と 5 の ○× だけを使う。
//
// 【同じ問いを続けない】この潜行で出した問い（askedIds）は二度出さない。直近の潜行で出した問い
// （recentIds・DungeonRun.askedIds から読む）は後回しにする。マスタは有限なので、
// 「毎日同じ○×が出る」を防ぐにはこの記憶が要る。
//
// 難易度は「問題ごとの正答率」で 1〜3 に分け、深い階・ボスの「ためる」ほど難しい方を優先する。
// 選ぶ部分は純関数なのでテストできる。DBを引くのは loadCandidates / loadRecentAsked だけ。

import { prisma } from "@/lib/db";
import { topicMatches } from "@/lib/quiz/attempt";
import { RIDDLES, TRUE_FALSE_CHOICES, type Riddle } from "./riddles";
import type { PendingQuestion, QuestionKind, Rng } from "./battle";

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

const bankKey = (id: string) => `bank:${id}`;
const riddleKey = (id: string) => `riddle:${id}`;

/**
 * 良問バンクから四択を1問選ぶ。候補が無ければ null。
 * askedIds（"bank:<id>"）に入っている問題は同じ潜行では出さない。recentIds に入っている問題は後回し。
 * tier を指定すると、その段階だけから選ぶ（primary=復習期限＋領域一致の未解答 / secondary=それ以外）。
 */
export function pickQuestion(params: {
  candidates: Candidate[];
  topics: string[];
  depth: number;
  charging: boolean;
  askedIds: string[];
  recentIds?: string[];
  tier?: "primary" | "secondary";
  rng: Rng;
}): Candidate | null {
  const asked = new Set(params.askedIds);
  const recent = new Set(params.recentIds ?? []);
  const pool = params.candidates.filter((c) => !asked.has(bankKey(c.id)));
  if (pool.length === 0) return null;

  const want = wantedDifficulty(params.depth, params.charging);
  const onTopic = (c: Candidate) => params.topics.some((t) => topicMatches(t, c.topic));
  const closeness = (c: Candidate) => Math.abs(difficultyOf(c.accuracy) - want);

  // 段階ごとに絞り、その中で「欲しい難易度に近い → 良問スコア高い」順
  const primary: ((c: Candidate) => boolean)[] = [
    (c) => c.due,
    (c) => !c.attempted && onTopic(c),
  ];
  const secondary: ((c: Candidate) => boolean)[] = [
    (c) => !c.attempted,
    (c) => !recent.has(bankKey(c.id)),
    () => true,
  ];
  const tiers =
    params.tier === "primary" ? primary : params.tier === "secondary" ? secondary : [...primary, ...secondary];
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

/**
 * TSマスタから1問選ぶ。
 * 「この潜行でも直近の潜行でも出していない → この潜行で出していない → 全部」の順に緩め、
 * 各段階で領域一致を優先する。
 */
export function pickRiddle(params: {
  topics: string[];
  askedIds: string[];
  /** 直近の潜行で出した問い（"riddle:<id>"）。後回しにする */
  recentIds?: string[];
  /** 問いの種類を絞る（○×高速ラウンドは truefalse だけ） */
  kind?: QuestionKind;
  /** 領域一致のものだけ（無ければ null。全体からの保険には落とさない） */
  onTopicOnly?: boolean;
  /** この潜行でも直近の潜行でも出していないものだけ（無ければ null） */
  freshOnly?: boolean;
  rng: Rng;
}): Riddle | null {
  const asked = new Set(params.askedIds);
  const recent = new Set(params.recentIds ?? []);
  const byKind = RIDDLES.filter((r) => !params.kind || r.kind === params.kind);
  const unasked = byKind.filter((r) => !asked.has(riddleKey(r.id)));
  const tiers = [
    unasked.filter((r) => !recent.has(riddleKey(r.id))),
    ...(params.freshOnly ? [] : [unasked, byKind]),
  ];
  const onTopic = (r: Riddle) => r.topics.some((rt) => params.topics.some((t) => topicMatches(t, rt)));
  for (const tier of tiers) {
    const matched = tier.filter(onTopic);
    const from = matched.length > 0 ? matched : params.onTopicOnly ? [] : tier;
    if (from.length > 0) return from[Math.floor(params.rng() * from.length)];
  }
  return null;
}

export function riddleToPending(r: Riddle, now: number): PendingQuestion {
  return r.kind === "truefalse"
    ? {
        source: "riddle",
        id: r.id,
        kind: "truefalse",
        topic: r.topics[0],
        prompt: r.statement,
        choices: [...TRUE_FALSE_CHOICES],
        difficulty: 1,
        askedAt: now,
        hidden: [],
      }
    : {
        source: "riddle",
        id: r.id,
        kind: "choice",
        topic: r.topics[0],
        prompt: r.prompt,
        choices: [...r.choices],
        difficulty: 2,
        askedAt: now,
        hidden: [],
      };
}

/** TSマスタの正解（採点はサーバーだけが行う） */
export function riddleAnswerIndex(r: Riddle): number {
  return r.kind === "truefalse" ? (r.answer ? 0 : 1) : r.answerIndex;
}

/**
 * 戦闘で出す問いを1つ決める（冒頭の【順位】）。純関数。
 * 何も無ければ null（マスタが空でない限り起きない）。
 */
export function pickBattleQuestion(params: {
  candidates: Candidate[];
  topics: string[];
  depth: number;
  charging: boolean;
  askedIds: string[];
  recentIds: string[];
  /** ○×高速ラウンド（この敵の問いは全部 ○×） */
  rapid: boolean;
  rng: Rng;
  now: number;
}): PendingQuestion | null {
  const { candidates, topics, depth, charging, askedIds, recentIds, rng, now } = params;
  if (!params.rapid) {
    // 1-2. 復習の再戦 → 領域一致の未解答（良問バンク）
    const first = pickQuestion({ candidates, topics, depth, charging, askedIds, recentIds, tier: "primary", rng });
    if (first) return candidateToPending(first, now);
    // 3. 領域一致の TSマスタ（この潜行でも直近の潜行でも出していないもの）
    const own = pickRiddle({ topics, askedIds, recentIds, onTopicOnly: true, freshOnly: true, rng });
    if (own) return riddleToPending(own, now);
    // 4. その他の良問バンク
    const rest = pickQuestion({ candidates, topics, depth, charging, askedIds, recentIds, tier: "secondary", rng });
    if (rest) return candidateToPending(rest, now);
  }
  // 5. TSマスタ全体（○×高速ラウンドは ○× だけ）
  const any = pickRiddle({ topics, askedIds, recentIds, kind: params.rapid ? "truefalse" : undefined, rng });
  return any ? riddleToPending(any, now) : null;
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

/** 直近の潜行で出した問いを何回ぶん覚えておくか（1日1回なので、およそ1週間） */
export const RECENT_RUNS = 6;

/** 直近の潜行で出した問い（"bank:<id>" / "riddle:<id>"）。決着時に DungeonRun.askedIds に写したもの */
export async function loadRecentAsked(userId: string): Promise<string[]> {
  const runs = await prisma.dungeonRun.findMany({
    where: { userId, status: "DONE" },
    orderBy: { createdAt: "desc" },
    take: RECENT_RUNS,
    select: { askedIds: true },
  });
  return [...new Set(runs.flatMap((r) => r.askedIds))];
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
