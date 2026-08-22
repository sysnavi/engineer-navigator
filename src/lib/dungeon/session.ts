// 探索の状態機械（松）。コマンドのたびにサーバーがここを回して次の状態を作る。
//
// 【設計の芯】
//  - 判定は全部サーバー。クライアントはコマンド名しか送らない（改ざん耐性）。
//  - HPは潜行のあいだ持ち越す。だから緊張は「この戦闘に勝てるか」ではなく
//    「まだ進めるか、ここで引き返すか」になる＝判断がゲーム性の核。
//  - **敗走しても戦利品は持ち帰れる**。手ぶらで終わる体験を構造的に無くすため
//    （初回の潜行が面白くない最大の原因が「48.9%が手ぶら」だった）。
//  - 初回の潜行は宝箱を確定で出す。「持ち帰る楽しさ」を必ず1回は体験させる。

import {
  MONSTERS,
  TRAPS,
  RESTS,
  GADGETS,
  EVENT_WEIGHTS,
  MIMIC_RATE,
  type Rarity,
} from "./content";
import { FOODS, rollFood, foodById, type FoodId } from "@/lib/pets/foods";
import {
  foeStats,
  resolveTurn,
  type BattleCommand,
  type BattleLog,
  type Fighter,
  type Foe,
  type Rng,
} from "./battle";

/** 1回の潜行で進める最大の階数（日課として重くなりすぎない上限） */
export const MAX_FLOORS = 10;
/** ボスが現れうる最小の深度。育ちきっていなくても山場に会えるよう浅めに置く */
export const BOSS_MIN_DEPTH = 5;
const BOSS_RATE = 0.28;
const FOOD_DROP_RATE = 0.5;
/** どうぐ（ごはん）1つの回復量は最大HPのこの割合 */
const HEAL_RATIO = 0.3;

export type Phase =
  | "INTRO" // 出発（次へ で最初の階へ）
  | "EVENT" // イベントの結果を読んでいる（次へ で分岐へ）
  | "BATTLE" // 戦闘中（コマンド待ち）
  | "CHOICE" // 次の階をどう進むか
  | "END"; // 決着

export type DiveState = {
  floor: number; // 何階ぶん進んだか（MAX_FLOORSで打ち止め）
  depth: number; // 到達深度
  baseDepth: number;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  atk: number;
  def: number;
  shieldLeft: number; // 週報の盾（敗走を1回だけ無効化）
  charms: number; // 知恵の護符（AIメンターに相談した日に持てる・HP全快）
  items: FoodId[]; // 潜行中に使えるごはん
  gotGadgets: string[];
  gotFoods: string[];
  foe: Foe | null;
  phase: Phase;
  /** 直前に起きたことの表示用ログ */
  logs: BattleLog[];
  /** 決着の種類 */
  ending: "escaped" | "defeated" | "cleared" | "limit" | null;
  bossDefeated: boolean;
  firstDive: boolean;
};

export type Choice = "deep" | "careful" | "leave";

/**
 * 潜行の初期状態を作る。
 * 初回の潜行には「はじめての盾」を1枚渡す — 敗走しても終わりではないと
 * 最初に体験してもらうため（初対面でいきなり負けて終わると印象が悪い）。
 */
export function createDiveState(params: {
  baseDepth: number;
  stats: { maxHp: number; maxSp: number; atk: number; def: number };
  hasReportShield: boolean;
  firstDive: boolean;
  items: FoodId[];
  /** したく（その日の活動）で得た知恵の護符 */
  charms?: number;
}): DiveState {
  return {
    floor: 0,
    depth: params.baseDepth,
    baseDepth: params.baseDepth,
    hp: params.stats.maxHp,
    maxHp: params.stats.maxHp,
    sp: 0,
    maxSp: params.stats.maxSp,
    atk: params.stats.atk,
    def: params.stats.def,
    shieldLeft: (params.hasReportShield ? 1 : 0) + (params.firstDive ? 1 : 0),
    charms: params.charms ?? 0,
    items: params.items,
    gotGadgets: [],
    gotFoods: [],
    foe: null,
    phase: "INTRO",
    logs: [],
    ending: null,
    bossDefeated: false,
    firstDive: params.firstDive,
  };
}

// ---------------------------------------------------------------------------
// イベント生成
// ---------------------------------------------------------------------------

function pick<T extends { weight?: number }>(list: T[], rng: Rng): T {
  const total = list.reduce((s, i) => s + (i.weight ?? 1), 0);
  let r = rng() * total;
  for (const i of list) {
    r -= i.weight ?? 1;
    if (r <= 0) return i;
  }
  return list[list.length - 1];
}

function rollGadget(depth: number, rng: Rng) {
  const pool = GADGETS.filter((g) => !g.retired && !g.minGeneration);
  const base: Record<Rarity, number> = { N: 60, R: 30, SR: 9, SSR: 2, UR: 0.4 };
  const boost = Math.min(2.5, 1 + depth * 0.08);
  const weighted = pool.map((g) => ({
    ...g,
    weight: base[g.rarity] * (g.rarity === "N" ? 1 : boost),
  }));
  return pick(weighted, rng);
}

/** 次の階のイベントを決めて状態を進める。戦闘なら phase=BATTLE で止まる */
export function enterFloor(s: DiveState, rng: Rng): DiveState {
  const st = { ...s, logs: [] as BattleLog[] };
  st.floor += 1;

  // 初回の潜行の1階目は宝箱を確定（必ず何か持ち帰れる体験をさせる）
  const forceTreasure = st.firstDive && st.floor === 1;

  // ボス: 一定より深く、まだ倒していなければ。
  // ボスの minDepth は深い階を想定した値なので、そこに届かない浅い潜行では
  // 「いちばん浅いボス」を出す（育ちきっていない人が山場に一度も会えないのを防ぐ）。
  const bossPool = MONSTERS.filter((m) => m.boss && !m.retired);
  if (
    !forceTreasure &&
    st.depth >= BOSS_MIN_DEPTH &&
    !st.bossDefeated &&
    bossPool.length > 0 &&
    rng() < BOSS_RATE
  ) {
    const eligible = bossPool.filter((m) => m.minDepth <= st.depth);
    const boss = eligible.length
      ? pick(eligible.map((m) => ({ ...m, weight: m.weight ?? 1 })), rng)
      : [...bossPool].sort((a, b) => a.minDepth - b.minDepth)[0];
    const fs = foeStats(st.depth, true);
    st.foe = {
      id: boss.id,
      name: boss.name,
      sprite: boss.sprite,
      boss: true,
      hp: fs.maxHp,
      maxHp: fs.maxHp,
      atk: fs.atk,
      def: fs.def,
    };
    st.phase = "BATTLE";
    st.logs = [{ text: boss.encounter, fx: "charge" }];
    return st;
  }

  const ev = forceTreasure
    ? "TREASURE"
    : pick(
        [
          { kind: "ENCOUNTER", weight: EVENT_WEIGHTS.ENCOUNTER },
          { kind: "TREASURE", weight: EVENT_WEIGHTS.TREASURE },
          { kind: "TRAP", weight: EVENT_WEIGHTS.TRAP },
          { kind: "REST", weight: EVENT_WEIGHTS.REST },
        ],
        rng
      ).kind;

  if (ev === "ENCOUNTER") {
    const mon = pick(
      MONSTERS.filter((m) => !m.boss && !m.retired && m.minDepth <= st.depth).map((m) => ({
        ...m,
        weight: m.weight ?? 1,
      })),
      rng
    );
    const fs = foeStats(st.depth, false);
    st.foe = {
      id: mon.id,
      name: mon.name,
      sprite: mon.sprite,
      boss: false,
      hp: fs.maxHp,
      maxHp: fs.maxHp,
      atk: fs.atk,
      def: fs.def,
    };
    st.phase = "BATTLE";
    st.logs = [{ text: mon.encounter }];
    return st;
  }

  if (ev === "TREASURE") {
    if (!forceTreasure && rng() < MIMIC_RATE) {
      st.logs = [
        { text: "宝箱を見つけた！開けてみると…" },
        { text: "空っぽだ。「304 Not Modified」の文字だけが浮かんで消えた。", fx: "miss" },
      ];
    } else {
      const g = rollGadget(st.depth, rng);
      st.gotGadgets.push(g.id);
      const food = rng() < FOOD_DROP_RATE ? rollFood(st.depth, false) : null;
      st.logs = [
        { text: "宝箱を見つけた！開けてみると…" },
        { text: `「${g.name}」を手に入れた！（${g.rarity}）`, fx: "heal" },
      ];
      if (food) {
        st.gotFoods.push(food.id);
        st.items.push(food.id as FoodId);
        st.logs.push({ text: `すみに「${food.name}」も入っていた。`, fx: "heal" });
      }
    }
    st.phase = "EVENT";
    return st;
  }

  if (ev === "TRAP") {
    const trap = pick(
      TRAPS.filter((t) => !t.retired).map((t) => ({ ...t, weight: 1 })),
      rng
    );
    // 罠は「避けられる」ことがある。避けられなければHPを削る
    if (rng() < 0.35) {
      st.logs = [{ text: "……いやな よかんが する。" }, { text: trap.avoid, fx: "guard" }];
    } else {
      const dmg = Math.max(3, Math.round(st.maxHp * 0.12));
      st.hp = Math.max(1, st.hp - dmg);
      st.logs = [
        { text: "……いやな よかんが する。" },
        { text: trap.hit, fx: "hit", damage: dmg, target: "hero" },
      ];
    }
    st.phase = "EVENT";
    return st;
  }

  // REST
  const rest = pick(
    RESTS.filter((r) => !r.retired).map((r) => ({ ...r, weight: 1 })),
    rng
  );
  const heal = Math.round(st.maxHp * 0.25);
  const before = st.hp;
  st.hp = Math.min(st.maxHp, st.hp + heal);
  st.sp = Math.min(st.maxSp, st.sp + 1);
  st.logs = [
    { text: rest.text },
    { text: `HPが ${st.hp - before} かいふくした。`, fx: "heal", damage: st.hp - before, target: "hero" },
  ];
  st.phase = "EVENT";
  return st;
}

// ---------------------------------------------------------------------------
// コマンドの解決
// ---------------------------------------------------------------------------

/** 戦闘コマンド1回ぶん。決着したら phase を進める */
export function doBattle(s: DiveState, command: BattleCommand, rng: Rng): DiveState {
  const st = { ...s };
  if (!st.foe || st.phase !== "BATTLE") return st;

  const hero: Fighter = {
    name: "きみ",
    hp: st.hp,
    maxHp: st.maxHp,
    atk: st.atk,
    def: st.def,
  };
  // どうぐは持っているごはんの先頭を使う
  const itemId = st.items[0];
  const def = itemId ? foodById(itemId) : null;
  const r = resolveTurn({
    hero,
    foe: st.foe,
    sp: st.sp,
    command,
    rng,
    canFlee: !st.foe.boss,
    charms: st.charms,
    item: def
      ? { id: def.id, name: def.name, heal: Math.round(st.maxHp * HEAL_RATIO) }
      : undefined,
  });

  st.hp = r.hero.hp;
  st.sp = r.sp;
  st.foe = r.foe;
  st.logs = r.logs;
  if (r.usedCharm) st.charms = Math.max(0, st.charms - 1);
  if (r.usedItem) {
    const i = st.items.indexOf(r.usedItem as FoodId);
    if (i >= 0) st.items.splice(i, 1);
    // 使ったぶんは持ち帰らない
    const j = st.gotFoods.indexOf(r.usedItem);
    if (j >= 0) st.gotFoods.splice(j, 1);
  }

  if (r.outcome === "win") {
    if (st.foe.boss) {
      st.bossDefeated = true;
      // ボスは大きな戦利品
      const g = rollGadget(st.depth + 4, rng);
      st.gotGadgets.push(g.id);
      const food = rollFood(st.depth, true);
      if (food) st.gotFoods.push(food.id);
      st.logs.push({ text: `ボスの宝から「${g.name}」を手に入れた！`, fx: "heal" });
      if (food) st.logs.push({ text: `「${food.name}」も見つけた。`, fx: "heal" });
    }
    st.foe = null;
    st.phase = "EVENT";
    return st;
  }

  if (r.outcome === "fled") {
    st.foe = null;
    st.depth = Math.max(1, st.depth - 1);
    st.phase = "EVENT";
    return st;
  }

  if (r.outcome === "lose") {
    if (st.shieldLeft > 0) {
      // 週報の盾: 一度だけ踏みとどまる
      st.shieldLeft -= 1;
      st.hp = Math.max(1, Math.round(st.maxHp * 0.35));
      st.foe = null;
      st.phase = "EVENT";
      st.logs.push({ text: "週報の盾が光った！ ぎりぎりで踏みとどまった。", fx: "guard" });
      return st;
    }
    // 敗走。ただし**戦利品は持ち帰れる**
    st.foe = null;
    st.phase = "END";
    st.ending = "defeated";
    return st;
  }

  return st;
}

/**
 * 決着の締めの一言。ENDに遷移するときは必ずこれを出す。
 * 以前はログを空にしたままENDへ入る経路があり、メッセージ欄が空白のまま
 * 終わっていた（引き返した時は逆に直前のログがもう一度再生されていた）。
 */
function closingLogs(ending: NonNullable<DiveState["ending"]>): BattleLog[] {
  if (ending === "cleared") {
    return [{ text: "ボスを たおした！ むねを はって 帰ろう。", fx: "heal" }];
  }
  if (ending === "escaped") {
    return [{ text: "きょうは ここで 引き返す。ぶじが いちばん。" }];
  }
  return [{ text: "きょう すすめるのは ここまで。また こんど。" }];
}

/** 次の階へどう進むか */
export function doChoice(s: DiveState, choice: Choice, rng: Rng): DiveState {
  let st = { ...s };
  if (choice === "leave") {
    st.phase = "END";
    st.ending = st.bossDefeated ? "cleared" : "escaped";
    st.logs = closingLogs(st.ending);
    return st;
  }
  st.depth += choice === "deep" ? 2 : 1;
  if (st.floor >= MAX_FLOORS) {
    st.phase = "END";
    st.ending = st.bossDefeated ? "cleared" : "limit";
    st.logs = closingLogs(st.ending);
    return st;
  }
  st = enterFloor(st, rng);
  return st;
}

/**
 * 潜行の締め。何も持ち帰れなかった場合だけ、帰り道でひとつ拾わせる。
 * 「潜ったのに手ぶら」は潜る面白さが伝わらない最大の原因だったので、
 * 宝箱の当たり外れは残しつつ、最悪のケースだけを構造で潰す。
 */
export function finishDive(s: DiveState): DiveState {
  if (s.gotGadgets.length > 0 || s.gotFoods.length > 0) return s;
  const consolation = FOODS.find((f) => f.id === "onigiri") ?? FOODS[0];
  return {
    ...s,
    gotFoods: [...s.gotFoods, consolation.id],
    logs: [
      ...s.logs,
      {
        text: `帰り道、入口に「${consolation.name}」が落ちていた。持って帰ろう。`,
        fx: "heal",
      },
    ],
  };
}

/**
 * イベントを読み終えた → 分岐へ。
 * ボスを倒しても探索は終わらない（enterFloor が二度目のボスを出さないだけ）。
 * 「どこまで行くかは、きみが決める」ので、帰るかどうかも本人の選択に委ねる。
 * ボスを倒した潜行は、どの形で帰っても ending=cleared（ボス撃破の勲章）になる。
 */
export function doNext(s: DiveState): DiveState {
  const st = { ...s, logs: [] as BattleLog[] };
  if (st.floor >= MAX_FLOORS) {
    st.phase = "END";
    st.ending = st.bossDefeated ? "cleared" : "limit";
    st.logs = closingLogs(st.ending);
    return st;
  }
  st.phase = "CHOICE";
  return st;
}
