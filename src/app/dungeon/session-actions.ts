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
import { heroStats } from "@/lib/dungeon/battle";
import type { BattleCommand } from "@/lib/dungeon/battle";
import {
  createDiveState,
  enterFloor,
  doBattle,
  doChoice,
  doNext,
  finishDive,
  MAX_FLOORS,
  type Choice,
  type DiveState,
} from "@/lib/dungeon/session";

const rng = () => Math.random();

/** クライアントに見せる状態（内部値のうち表示に要るものだけ） */
export type DiveView = {
  runId: string;
  phase: DiveState["phase"];
  floor: number;
  maxFloors: number;
  depth: number;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  shieldLeft: number;
  charms: number;
  items: { id: string; name: string }[];
  foe: { name: string; sprite: string; hp: number; maxHp: number; boss: boolean; charging: boolean } | null;
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
        }
      : null,
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
  return toView(run.id, run.state as unknown as DiveState);
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

/** 潜行中のコマンド。command は行動の種類だけで、数値は一切受け取らない */
export async function act(
  runId: string,
  action:
    | { type: "battle"; command: BattleCommand }
    | { type: "next" }
    | { type: "choice"; choice: Choice }
): Promise<{ ok: true; view: DiveView } | { ok: false; error: string }> {
  const user = await requireFullAccountUser();
  const run = await prisma.dungeonRun.findUnique({ where: { id: runId } });
  if (!run || run.userId !== user.id || run.status !== "ACTIVE" || !run.state) {
    return { ok: false, error: "この探索は もう終わっています。" };
  }

  let state = run.state as unknown as DiveState;

  // フェーズと行動の整合はサーバーが判定する（不正な組み合わせは黙って無視）
  if (action.type === "battle" && state.phase === "BATTLE") {
    state = doBattle(state, action.command, rng);
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
