"use server";

// コマンド選択制ダンジョン（松）のサーバーアクション。
//
// 【改ざん耐性】判定は全部サーバー。クライアントから来るのはコマンド名だけで、
// HPやダメージなどの数値は一切受け取らない。状態は DungeonRun.state に持つ。
// 潜行枠は slot の @@unique が構造で守る（連打・並行リクエストも安全）。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireFullAccountUser } from "@/lib/guest";
import { getPlayerStats } from "@/lib/exp";
import { GADGETS } from "@/lib/dungeon/content";
import { foodById, type FoodId } from "@/lib/pets/foods";
import { baseDepthOf, resolveSlot } from "@/lib/dungeon/run";
import { getDivePrep } from "@/lib/dungeon/prep";
import { heroStats, HINT_COST } from "@/lib/dungeon/battle";
import type { BattleCommand, PendingQuestion } from "@/lib/dungeon/battle";
import {
  createDiveState,
  enterFloor,
  askQuestion,
  needsQuestion,
  doAnswer,
  doBattle,
  doChoice,
  doNext,
  finishDive,
  MAX_FLOORS,
  type Choice,
  type DiveState,
} from "@/lib/dungeon/session";
import {
  loadCandidates,
  pickQuestion,
  pickRiddle,
  candidateToPending,
  riddleToPending,
} from "@/lib/dungeon/quiz-pool";
import { MONSTERS } from "@/lib/dungeon/content";
import { riddleById } from "@/lib/dungeon/riddles";
import { recordAttempt } from "@/lib/quiz/attempt";

const rng = () => Math.random();

/** クライアントに見せる状態（内部値のうち表示に要るものだけ） */
export type DiveView = {
  runId: string;
  phase: DiveState["phase"];
  floor: number;
  maxFloors: number;
  depth: number;
  /** 実際の出発階（したくの腕試しボーナス込み。表示ズレ防止のためサーバー値を使う） */
  baseDepth: number;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  shieldLeft: number;
  charms: number;
  items: { id: string; name: string }[];
  foe: {
    name: string;
    sprite: string;
    hp: number;
    maxHp: number;
    boss: boolean;
    charging: boolean;
    rapid: boolean;
    /** いまの問い（正解は含まない） */
    question: Omit<PendingQuestion, "askedAt"> | null;
  } | null;
  hintCost: number;
  logs: DiveState["logs"];
  ending: DiveState["ending"];
  loot: { gadgets: string[]; foods: string[] };
  canFlee: boolean;
};

function toView(runId: string, s: DiveState): DiveView {
  return {
    runId,
    phase: s.phase,
    floor: s.floor,
    maxFloors: MAX_FLOORS,
    depth: s.depth,
    baseDepth: s.baseDepth,
    hp: s.hp,
    maxHp: s.maxHp,
    sp: s.sp,
    maxSp: s.maxSp,
    shieldLeft: s.shieldLeft,
    charms: s.charms ?? 0,
    items: s.items.flatMap((id) => {
      const d = foodById(id);
      return d ? [{ id: String(d.id), name: d.name }] : [];
    }),
    foe: s.foe
      ? {
          name: s.foe.name,
          sprite: s.foe.sprite,
          hp: s.foe.hp,
          maxHp: s.foe.maxHp,
          boss: s.foe.boss,
          charging: !!s.foe.charging,
          rapid: !!s.foe.rapid,
          question: s.foe.question
            ? {
                source: s.foe.question.source,
                id: s.foe.question.id,
                kind: s.foe.question.kind,
                topic: s.foe.question.topic,
                prompt: s.foe.question.prompt,
                choices: s.foe.question.choices,
                difficulty: s.foe.question.difficulty,
                hidden: s.foe.question.hidden,
              }
            : null,
        }
      : null,
    hintCost: HINT_COST,
    logs: s.logs,
    ending: s.ending,
    loot: {
      gadgets: s.gotGadgets
        .map((id) => GADGETS.find((g) => g.id === id)?.name)
        .filter((n): n is string => !!n),
      foods: s.gotFoods
        .map((id) => foodById(id)?.name)
        .filter((n): n is string => !!n),
    },
    canFlee: !!s.foe && !s.foe.boss,
  };
}

/** 進行中の潜行があれば返す（リロードしても続きから） */
export async function getActiveDive(): Promise<DiveView | null> {
  const user = await requireFullAccountUser();
  const run = await prisma.dungeonRun.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!run?.state) return null;
  let state = normalizeState(run.state);
  if (needsQuestion(state)) {
    // 古い形式の状態（問いを持たない戦闘）や、選定前に閉じた潜行の続き
    state = await ensureQuestion(user.id, state);
    await prisma.dungeonRun.update({ where: { id: run.id }, data: { state: state as unknown as object } });
  }
  return toView(run.id, state);
}

/** DBから読んだ状態を今の形に揃える（以前の潜行に無かった項目を補う） */
function normalizeState(raw: unknown): DiveState {
  const s = raw as DiveState;
  return { ...s, askedIds: Array.isArray(s.askedIds) ? s.askedIds : [] };
}

/** 戦闘中で問いが無ければ選んで載せる。バンクが空なら ○× で成立させる */
async function ensureQuestion(userId: string, state: DiveState): Promise<DiveState> {
  if (!needsQuestion(state) || !state.foe) return state;
  const foe = state.foe;
  const topics = MONSTERS.find((m) => m.id === foe.id)?.topics ?? [];
  const now = Date.now();
  if (!foe.rapid) {
    const candidates = await loadCandidates(userId);
    const picked = pickQuestion({
      candidates,
      topics,
      depth: state.depth,
      charging: !!foe.charging,
      askedIds: state.askedIds,
      rng,
    });
    if (picked) return askQuestion(state, candidateToPending(picked, now));
  }
  const riddle = pickRiddle({ topics, askedIds: state.askedIds, rng });
  if (riddle) return askQuestion(state, riddleToPending(riddle, now));
  // 問いが一つも無い（マスタが空）ことは無いが、型のために
  return state;
}

/** 出題中の問いの正解を引く。バンクの問題が消えていれば null */
async function answerOf(q: PendingQuestion): Promise<{ answerIndex: number; note: string | null } | null> {
  if (q.source === "riddle") {
    const r = riddleById(q.id);
    return r ? { answerIndex: r.answer ? 0 : 1, note: r.note } : null;
  }
  const row = await prisma.quizQuestion.findUnique({
    where: { id: q.id },
    select: { answerIndex: true, explanation: true },
  });
  return row ? { answerIndex: row.answerIndex, note: row.explanation } : null;
}

/** 潜行を開始する。枠がなければエラー文言を返す */
export async function startDive(): Promise<
  { ok: true; view: DiveView } | { ok: false; error: string }
> {
  const user = await requireFullAccountUser();

  // すでに潜行中ならそれを返す（二重開始の防止）
  const active = await getActiveDive();
  if (active) return { ok: true, view: active };

  const { slot } = await resolveSlot(user.id);
  if (!slot) {
    return { ok: false, error: "きょうの探索はおしまい。休むのも仕事のうち！" };
  }

  const [stats, owned, foods, runCount, shield, prep] = await Promise.all([
    getPlayerStats(user.id),
    prisma.ownedGadget.findMany({ where: { userId: user.id }, select: { gadgetId: true } }),
    prisma.foodItem.findMany({ where: { userId: user.id, count: { gt: 0 } } }),
    prisma.dungeonRun.count({ where: { userId: user.id } }),
    prisma.weeklyReport.findFirst({
      where: { userId: user.id, status: "SUBMITTED" },
      orderBy: { weekStart: "desc" },
      select: { id: true },
    }),
    // したく: きょうの活動が潜行の質に乗る
    getDivePrep(user.id),
  ]);

  const rarities = owned
    .map((o) => GADGETS.find((g) => g.id === o.gadgetId)?.rarity)
    .filter((r): r is NonNullable<typeof r> => !!r);

  // どうぐの持ち込み枠は「したく」で増える（学習プランの項目を終えるごとに+1）
  const carried = foods.slice(0, prep.itemSlots).map((f) => f.foodId as FoodId);

  // したくの効果を素のステータスに乗せる（腕試し→開始深度、スキル承認→ATK/DEF）
  const base = heroStats({
    level: stats.level,
    generation: stats.generation,
    gadgetRarities: rarities,
  });
  let state = createDiveState({
    baseDepth: baseDepthOf(stats) + prep.startDepthBonus,
    stats: {
      ...base,
      atk: base.atk + prep.atkBonus,
      def: base.def + prep.defBonus,
    },
    hasReportShield: !!shield,
    firstDive: runCount === 0,
    items: carried,
    charms: prep.charms,
  });
  state = enterFloor(state, rng);
  state = await ensureQuestion(user.id, state);

  // slot の @@unique が二重潜行を弾く（並行リクエストでも1つしか通らない）
  const run = await prisma.dungeonRun.create({
    data: {
      userId: user.id,
      slot,
      baseDepth: state.baseDepth,
      depth: state.depth,
      steps: [],
      status: "ACTIVE",
      state: state as unknown as object,
    },
  });
  return { ok: true, view: toView(run.id, state) };
}

/** 潜行中のコマンド。送られてくるのは行動の種類と選択肢の番号だけで、数値は一切受け取らない */
export async function act(
  runId: string,
  action:
    | { type: "answer"; choiceIndex: number }
    | { type: "battle"; command: BattleCommand }
    | { type: "next" }
    | { type: "choice"; choice: Choice }
): Promise<{ ok: true; view: DiveView } | { ok: false; error: string }> {
  const user = await requireFullAccountUser();
  const run = await prisma.dungeonRun.findUnique({ where: { id: runId } });
  if (!run || run.userId !== user.id || run.status !== "ACTIVE" || !run.state) {
    return { ok: false, error: "この探索は もう終わっています。" };
  }

  let state = normalizeState(run.state);

  // フェーズと行動の整合はサーバーが判定する（不正な組み合わせは黙って無視）
  if (action.type === "answer" && state.phase === "BATTLE" && state.foe?.question) {
    const q = state.foe.question;
    const idx = action.choiceIndex;
    if (!Number.isInteger(idx) || idx < 0 || idx >= q.choices.length || q.hidden.includes(idx)) {
      return { ok: true, view: toView(run.id, state) };
    }
    const key = await answerOf(q);
    if (!key) {
      // 問題が消えていた。この問いは無かったことにして選び直す
      state = { ...state, foe: { ...state.foe, question: undefined } };
    } else {
      const correct = idx === key.answerIndex;
      const elapsedMs = Date.now() - q.askedAt;
      state = doAnswer(state, { correct, elapsedMs, note: key.note }, rng);
      if (q.source === "bank") {
        // 良問バンクの記録に乗せる（復習ボックス・スキル検証に効く。EXPとしたくは数えない）
        await recordAttempt({
          userId: user.id,
          questionId: q.id,
          chosenIndex: idx,
          correct,
          topic: q.topic,
          source: "dungeon",
        });
      }
    }
  } else if (action.type === "battle" && state.phase === "BATTLE") {
    let hintHide: number[] | undefined;
    if (action.command === "hint" && state.foe?.question?.kind === "choice") {
      const q = state.foe.question;
      const key = await answerOf(q);
      if (key) {
        const wrong = q.choices
          .map((_, i) => i)
          .filter((i) => i !== key.answerIndex && !q.hidden.includes(i));
        // 不正解のうち2つをランダムに消す
        hintHide = wrong.sort(() => rng() - 0.5).slice(0, 2);
      }
    }
    state = doBattle(state, action.command, rng, { hintHide });
  } else if (action.type === "next" && (state.phase === "EVENT" || state.phase === "INTRO")) {
    state = doNext(state);
  } else if (action.type === "choice" && state.phase === "CHOICE") {
    state = doChoice(state, action.choice, rng);
  } else {
    return { ok: true, view: toView(run.id, state) };
  }

  if (state.phase === "END") {
    state = finishDive(state);
    await persistEnd(user.id, run.id, state);
    revalidatePath("/dungeon");
    revalidatePath("/home");
    return { ok: true, view: toView(run.id, state) };
  }

  // 戦闘が続くなら次の問いを載せる
  state = await ensureQuestion(user.id, state);

  await prisma.dungeonRun.update({
    where: { id: run.id },
    data: { depth: state.depth, state: state as unknown as object },
  });
  return { ok: true, view: toView(run.id, state) };
}

/** 決着。戦利品を配って潜行を閉じる（敗走でも戦利品は持ち帰れる） */
async function persistEnd(userId: string, runId: string, s: DiveState) {
  const foodCounts = s.gotFoods.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  await prisma.$transaction([
    prisma.dungeonRun.update({
      where: { id: runId },
      data: {
        status: "DONE",
        state: undefined,
        depth: s.depth,
        steps: [
          {
            kind: "RESULT",
            title: `地下${s.depth}階に到達`,
            lines: [
              `到達: 地下${s.depth}階（出発: 地下${s.baseDepth}階）`,
              s.gotGadgets.length || s.gotFoods.length
                ? `戦利品: ${[
                    ...s.gotGadgets.map((id) => GADGETS.find((g) => g.id === id)?.name),
                    ...s.gotFoods.map((id) => foodById(id)?.name),
                  ]
                    .filter(Boolean)
                    .join("・")}`
                : "戦利品はなかった。",
            ],
            outcome: s.ending === "defeated" ? "fail" : "success",
            depthAfter: s.depth,
          },
        ] as unknown as object,
      },
    }),
    ...(s.gotGadgets.length
      ? [
          prisma.ownedGadget.createMany({
            data: s.gotGadgets.map((gadgetId) => ({ userId, gadgetId })),
            skipDuplicates: true,
          }),
        ]
      : []),
    ...Object.entries(foodCounts).map(([foodId, n]) =>
      prisma.foodItem.upsert({
        where: { userId_foodId: { userId, foodId } },
        update: { count: { increment: n } },
        create: { userId, foodId, count: n },
      })
    ),
  ]);
}
