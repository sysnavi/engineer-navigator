// ダンジョン潜行エンジン（Issue #3）。
//
// フルオート: サーバーが5ステップ（出発/イベント×3/結果）を一度に確定して
// DungeonRun.steps に保存し、クライアントは紙芝居再生するだけ（トークンゼロ運用）。
// 乱数はサーバーの Math.random で解決し、結果を保存する（リプレイは常に同じ）。
//
// 挑戦回数の哲学（Issue #3 の議論で確定）:
// - 1日1回 + 週報提出週のみボーナス1回。slot の @@unique が構造で強制する
// - 「◯時間で回復」等のタイマーは持たない。制限は「アバターの休養」として見せる
//   （休むのも仕事のうち、を世界観に埋め込む。依存させない）

import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";
import { getPlayerStats, type PlayerStats } from "@/lib/exp";
import {
  MONSTERS,
  GADGETS,
  TRAPS,
  RESTS,
  GENE_DUNGEON_MODS,
  EVENT_WEIGHTS,
  RARITY_MIN_DEPTH,
  MIMIC_RATE,
  BOSS_DEPTH,
  BOSS_RATE,
  type Gadget,
  type Rarity,
} from "@/lib/dungeon/content";

// 紙芝居の1コマ。クライアントはこれを順に表示するだけ
export type DungeonStep = {
  kind: "DEPART" | "ENCOUNTER" | "TREASURE" | "TRAP" | "REST" | "BOSS" | "RESULT";
  title: string;
  lines: string[]; // ログ行（DUNGEON.log に追記されていく）
  sprite?: string; // 相手/対象のスプライトID（public/dungeon/<id>.png）
  outcome?: "success" | "fail" | "avoid" | "none";
  depthAfter: number; // このコマ終了時点の深度（プログレス表示用）
  gadgetId?: string; // 獲得ガジェット
};

export type DungeonState = {
  canDive: boolean;
  diveKind: "daily" | "bonus" | null; // 次に使う枠
  restingMessage: string | null; // 今日は潜れない時の表示
  lastRun: { depth: number; createdAt: Date; steps: DungeonStep[] } | null;
  totalRuns: number;
  maxDepth: number;
};

function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 今日/今週の枠を判定する。daily未使用→daily、使用済み&週報提出済み&bonus未使用→bonus */
async function resolveSlot(userId: string): Promise<{
  slot: string | null;
  kind: "daily" | "bonus" | null;
}> {
  const now = new Date();
  const dailySlot = `d:${dayStr(now)}`;
  const weekStart = mondayOf(now);
  const bonusSlot = `b:${dayStr(weekStart)}`;

  const [dailyUsed, bonusUsed, reportThisWeek] = await Promise.all([
    prisma.dungeonRun.findFirst({ where: { userId, slot: dailySlot }, select: { id: true } }),
    prisma.dungeonRun.findFirst({ where: { userId, slot: bonusSlot }, select: { id: true } }),
    prisma.weeklyReport.findFirst({
      where: { userId, weekStart, status: "SUBMITTED" },
      select: { id: true },
    }),
  ]);

  if (!dailyUsed) return { slot: dailySlot, kind: "daily" };
  if (!bonusUsed && reportThisWeek) return { slot: bonusSlot, kind: "bonus" };
  return { slot: null, kind: null };
}

const RESTING_MESSAGES = [
  "きょうはもう帰って休んでいます。休むのも仕事のうち。",
  "冒険から帰って、風呂に入って寝ました。また明日。",
  "今日はよく歩いた。ストレッチをして休んでいます。",
];

export async function getDungeonState(userId: string): Promise<DungeonState> {
  const [{ kind }, lastRun, agg] = await Promise.all([
    resolveSlot(userId),
    prisma.dungeonRun.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dungeonRun.aggregate({
      where: { userId },
      _count: true,
      _max: { depth: true },
    }),
  ]);
  // 休養メッセージは日替わりで固定（表示のたびに変わらないように日付から決める）
  const msgIndex = new Date().getDate() % RESTING_MESSAGES.length;
  return {
    canDive: kind !== null,
    diveKind: kind,
    restingMessage: kind === null ? RESTING_MESSAGES[msgIndex] : null,
    lastRun: lastRun
      ? {
          depth: lastRun.depth,
          createdAt: lastRun.createdAt,
          steps: lastRun.steps as DungeonStep[],
        }
      : null,
    totalRuns: agg._count,
    maxDepth: agg._max.depth ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 潜行の解決
// ---------------------------------------------------------------------------

function pickWeighted<T extends { weight?: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const i of items) {
    r -= i.weight ?? 1;
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}

/** 基礎深度: 育成の成果がそのまま出発階になる。Lv/世代/継承限定形態で決まる */
export function baseDepthOf(stats: PlayerStats): number {
  const stageBonus =
    stats.stage.sprite === "sage" ? 1 : stats.stage.sprite === "legend" ? 2 : 0;
  return Math.max(1, 1 + Math.floor(stats.level / 2) + (stats.generation - 1) + stageBonus);
}

/** 深度に応じた宝箱のレア度抽選（深いほど高レアが混ざる） */
function rollRarity(depth: number, generation: number, treasureLuck: boolean): Gadget {
  const pool = GADGETS.filter(
    (g) =>
      !g.retired &&
      depth >= RARITY_MIN_DEPTH[g.rarity] &&
      (g.minGeneration ?? 1) <= generation
  );
  // 深いほど高レアの重みが増す。創造遺伝子(treasureLuck)はさらに1段上振れ
  const rarityWeight = (r: Rarity): number => {
    const base: Record<Rarity, number> = { N: 50, R: 30, SR: 14, SSR: 5, UR: 1 };
    const depthBoost = Math.min(2.5, 1 + depth * 0.08);
    const boost: Record<Rarity, number> = {
      N: 1,
      R: depthBoost,
      SR: depthBoost * (treasureLuck ? 1.4 : 1),
      SSR: depthBoost * (treasureLuck ? 1.6 : 1),
      UR: depthBoost * (treasureLuck ? 1.6 : 1),
    };
    return base[r] * boost[r];
  };
  return pickWeighted(pool.map((g) => ({ ...g, weight: rarityWeight(g.rarity) })));
}

/** 潜行を実行して確定済みステップを保存する。枠がなければ throw */
export async function performDive(userId: string): Promise<{
  steps: DungeonStep[];
  depth: number;
  kind: "daily" | "bonus";
}> {
  const { slot, kind } = await resolveSlot(userId);
  if (!slot || !kind) {
    throw new Error("今日の探索はおしまい。休むのも仕事のうち！");
  }

  const stats = await getPlayerStats(userId);
  const mods = stats.genes ? GENE_DUNGEON_MODS[stats.genes.dominant.id] : undefined;
  const owned = new Set(
    (
      await prisma.ownedGadget.findMany({ where: { userId }, select: { gadgetId: true } })
    ).map((o) => o.gadgetId)
  );

  // 今週の週報を出していれば「週報の盾」1回（敗走を無効化）
  const weekStart = mondayOf(new Date());
  const hasShield = !!(await prisma.weeklyReport.findFirst({
    where: { userId, weekStart, status: "SUBMITTED" },
    select: { id: true },
  }));

  const baseDepth = baseDepthOf(stats);
  let depth = baseDepth;
  let shieldLeft = hasShield ? 1 : 0;
  let buff = 0; // RESTのbuff: 次のENCOUNTER成功率に加算（1回で消費）
  const gotGadgets: string[] = [];
  const steps: DungeonStep[] = [];

  // --- 出発 ---
  steps.push({
    kind: "DEPART",
    title: "潜行開始",
    lines: [
      `${stats.stage.name}（第${stats.generation}世代・Lv${stats.level}）はエレベーターに乗り込んだ。`,
      `育成の成果で 地下${baseDepth}階 からのスタートだ。`,
      ...(hasShield ? ["装備:「今週の週報」— 整った心が身を守る。"] : []),
      ...(kind === "bonus" ? ["週報ボーナス潜行！整った心で、もう一潜り。"] : []),
    ],
    outcome: "none",
    depthAfter: depth,
  });

  // --- イベント×3 ---
  for (let i = 0; i < 3; i++) {
    const isLast = i === 2;
    // ボス: 最終イベントで深度が既に深ければ抽選
    if (isLast && depth >= BOSS_DEPTH && Math.random() < BOSS_RATE) {
      const boss = pickWeighted(
        MONSTERS.filter((m) => m.boss && !m.retired && m.minDepth <= depth)
      );
      const p = 0.5 + (mods?.encounterBonus ?? 0) + buff;
      buff = 0;
      if (Math.random() < p) {
        depth += 2;
        const drop = rollRarity(Math.max(depth, RARITY_MIN_DEPTH.SSR), stats.generation, true);
        const isNew = !owned.has(drop.id) && !gotGadgets.includes(drop.id);
        if (isNew) gotGadgets.push(drop.id);
        steps.push({
          kind: "BOSS",
          title: `ボス: ${boss.name}`,
          lines: [
            boss.encounter,
            boss.win,
            isNew
              ? `宝物庫から「${drop.name}」を手に入れた！`
              : `宝物庫の「${drop.name}」は既に持っていた。丁寧に磨いた。`,
          ],
          sprite: boss.sprite,
          outcome: "success",
          depthAfter: depth,
          gadgetId: isNew ? drop.id : undefined,
        });
      } else {
        depth = Math.max(1, depth - 1);
        steps.push({
          kind: "BOSS",
          title: `ボス: ${boss.name}`,
          lines: [boss.encounter, boss.lose],
          sprite: boss.sprite,
          outcome: "fail",
          depthAfter: depth,
        });
      }
      continue;
    }

    // 通常イベント抽選
    const weights = [
      { kind: "ENCOUNTER" as const, weight: EVENT_WEIGHTS.ENCOUNTER },
      {
        kind: "TREASURE" as const,
        weight: EVENT_WEIGHTS.TREASURE * (mods?.treasureWeightMul ?? 1),
      },
      { kind: "TRAP" as const, weight: EVENT_WEIGHTS.TRAP },
      { kind: "REST" as const, weight: EVENT_WEIGHTS.REST },
    ];
    const ev = pickWeighted(weights).kind;

    if (ev === "ENCOUNTER") {
      const mon = pickWeighted(
        MONSTERS.filter((m) => !m.boss && !m.retired && m.minDepth <= depth)
      );
      const p = 0.6 + (mods?.encounterBonus ?? 0) + buff;
      buff = 0;
      if (Math.random() < p) {
        depth += 1;
        steps.push({
          kind: "ENCOUNTER",
          title: mon.name,
          lines: [mon.encounter, mon.win],
          sprite: mon.sprite,
          outcome: "success",
          depthAfter: depth,
        });
      } else if (shieldLeft > 0) {
        shieldLeft -= 1;
        steps.push({
          kind: "ENCOUNTER",
          title: mon.name,
          lines: [mon.encounter, mon.lose, "…しかし「今週の週報」が輝き、踏みとどまった！"],
          sprite: mon.sprite,
          outcome: "avoid",
          depthAfter: depth,
        });
      } else {
        depth = Math.max(1, depth - 1);
        steps.push({
          kind: "ENCOUNTER",
          title: mon.name,
          lines: [mon.encounter, mon.lose],
          sprite: mon.sprite,
          outcome: "fail",
          depthAfter: depth,
        });
      }
    } else if (ev === "TREASURE") {
      if (Math.random() < MIMIC_RATE) {
        steps.push({
          kind: "TREASURE",
          title: "宝箱…？",
          lines: [
            "宝箱を見つけた！開けてみると…",
            "空っぽだ。「304 Not Modified」の文字だけが浮かんで消えた。キャッシュの幻影だったようだ。",
          ],
          sprite: "icon-chest",
          outcome: "fail",
          depthAfter: depth,
        });
      } else {
        const drop = rollRarity(depth, stats.generation, !!mods?.treasureWeightMul);
        const isNew = !owned.has(drop.id) && !gotGadgets.includes(drop.id);
        if (isNew) gotGadgets.push(drop.id);
        steps.push({
          kind: "TREASURE",
          title: "宝箱発見！",
          lines: [
            "宝箱を見つけた！開けてみると…",
            isNew
              ? `「${drop.name}」を手に入れた！（${drop.rarity}）`
              : `「${drop.name}」…は既に持っていた。予備としてしまっておこう。`,
          ],
          sprite: "icon-chest",
          outcome: "success",
          depthAfter: depth,
          gadgetId: isNew ? drop.id : undefined,
        });
      }
    } else if (ev === "TRAP") {
      const trap = pickWeighted(TRAPS.filter((t) => !t.retired).map((t) => ({ ...t, weight: 1 })));
      const pAvoid = 0.4 + (mods?.trapAvoidBonus ?? 0);
      if (Math.random() < pAvoid) {
        steps.push({
          kind: "TRAP",
          title: trap.name,
          lines: [trap.avoid],
          sprite: "icon-trap",
          outcome: "avoid",
          depthAfter: depth,
        });
      } else {
        depth = Math.max(1, depth - 1);
        steps.push({
          kind: "TRAP",
          title: trap.name,
          lines: [trap.hit],
          sprite: "icon-trap",
          outcome: "fail",
          depthAfter: depth,
        });
      }
    } else {
      const rest = pickWeighted(RESTS.filter((r) => !r.retired).map((r) => ({ ...r, weight: 1 })));
      const deepen =
        rest.effect === "deepen" || Math.random() < (mods?.restDeepenBonus ?? 0);
      if (deepen) {
        depth += 1;
        steps.push({
          kind: "REST",
          title: rest.name,
          lines: [rest.text],
          sprite: "icon-rest",
          outcome: "success",
          depthAfter: depth,
        });
      } else {
        buff = 0.2;
        steps.push({
          kind: "REST",
          title: rest.name,
          lines: [rest.text],
          sprite: "icon-rest",
          outcome: "none",
          depthAfter: depth,
        });
      }
    }
  }

  // --- 結果 ---
  const record = depth > baseDepth ? "自己の基礎深度を超えた！" : "今日はここまで。";
  steps.push({
    kind: "RESULT",
    title: `地下${depth}階に到達！`,
    lines: [
      `本日の探索終了 — 到達: 地下${depth}階（出発: ${baseDepth}階）`,
      gotGadgets.length > 0
        ? `戦利品: ${gotGadgets.map((id) => GADGETS.find((g) => g.id === id)?.name).join("・")}`
        : "戦利品はなかったが、いい運動になった。",
      record,
      "今日はもう帰ろう。休むのも仕事のうち。",
    ],
    outcome: "none",
    depthAfter: depth,
  });

  // --- 保存（slot @@unique が二重潜行を構造で弾く） ---
  await prisma.$transaction([
    prisma.dungeonRun.create({
      data: { userId, slot, baseDepth, depth, steps },
    }),
    ...(gotGadgets.length > 0
      ? [
          prisma.ownedGadget.createMany({
            data: gotGadgets.map((gadgetId) => ({ userId, gadgetId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return { steps, depth, kind };
}

/** コレクション（棚）: 所持ガジェットをマスタ情報付きで */
export async function getCollection(userId: string) {
  const rows = await prisma.ownedGadget.findMany({
    where: { userId },
    orderBy: { obtainedAt: "asc" },
  });
  return rows
    .map((r) => {
      const def = GADGETS.find((g) => g.id === r.gadgetId);
      return def ? { ...def, obtainedAt: r.obtainedAt } : null;
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
}
