// ターン制コマンド戦闘（松）。
//
// 判定は全部ここ＝サーバー側で行う。クライアントはコマンド名しか送らない。
// 乱数以外は純関数なので、バランス調整はシミュレーションで検証できる。
//
// 設計の考え方:
//  - 「たたかう」を押し続けても勝てるが、ボスや深い階では削り負ける。
//  - 「まもる」は受けを半減しつつSPを稼ぐ＝耐えて必殺に繋ぐ選択肢。
//  - 「ひっさつ」はSP消費の大技。溜めどころの判断がゲーム性の核。
//  - 「どうぐ」は拾ったごはんを使う。ペット機能との接続点でもある。

import type { Rarity } from "./content";

export type Fighter = {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
};

export type Foe = Fighter & {
  id: string;
  sprite: string;
  boss: boolean;
  /** ためる中（次のターンに強い一撃が来る）*/
  charging?: boolean;
};

export type BattleCommand = "attack" | "guard" | "special" | "item" | "flee";

export const SPECIAL_COST = 3;
/** まもる中の被ダメージ倍率 */
const GUARD_MUL = 0.4;
/** ためた敵の一撃の倍率。無防備で受けると致命的だが、まもれば大きく軽減できる＝読み合い */
const CHARGE_MUL = 2.4;
/** ためた一撃をまもったときの倍率（通常のまもるより厚い） */
const GUARD_VS_CHARGE_MUL = 0.3;

export type BattleLog = {
  text: string;
  /** 演出のヒント（UIがアニメを選ぶ） */
  fx?: "hit" | "crit" | "guard" | "heal" | "miss" | "flee" | "charge";
  /** ダメージ表示 */
  damage?: number;
  target?: "hero" | "foe";
};

/** 乱数の注入口。テストでは固定値を渡して決定的に検証する */
export type Rng = () => number;

function variance(rng: Rng): number {
  return 0.85 + rng() * 0.3; // 0.85〜1.15
}

/** ダメージ計算。防御は減算だが最低保証があるので手詰まりにならない */
export function damage(atk: number, def: number, rng: Rng, mul = 1): number {
  const raw = Math.max(atk - def * 0.6, atk * 0.25) * mul * variance(rng);
  return Math.max(1, Math.round(raw));
}

// ---------------------------------------------------------------------------
// ステータス導出
// ---------------------------------------------------------------------------

const RARITY_POWER: Record<Rarity, number> = { N: 1, R: 2, SR: 4, SSR: 7, UR: 12 };

/**
 * 集めたガジェットが強さになる（コレクションが戦力になる接続）。
 * レアなものほど効く。1つも持っていなくても戦えるだけの下限は確保する。
 */
export function heroStats(params: {
  level: number;
  generation: number;
  gadgetRarities: Rarity[];
}): { maxHp: number; maxSp: number; atk: number; def: number } {
  const gear = params.gadgetRarities.reduce((s, r) => s + RARITY_POWER[r], 0);
  return {
    maxHp: 50 + params.level * 6 + Math.floor(gear * 1.1) + (params.generation - 1) * 6,
    maxSp: 5,
    atk: 10 + Math.round(params.level * 1.5) + Math.floor(gear * 0.55) + (params.generation - 1),
    def: 4 + Math.floor(params.level * 0.6) + Math.floor(gear * 0.35),
  };
}

/**
 * 敵のステータス。深いほど強い。
 * HPは潜行中ずっと持ち越すので、1戦で勝てるかより「削られながら何階まで行けるか」が
 * 効くように、1戦あたりの消耗が深度でなだらかに増えるよう調整してある。
 */
export function foeStats(
  depth: number,
  boss: boolean
): { maxHp: number; atk: number; def: number } {
  const d = Math.max(1, depth);
  return boss
    ? { maxHp: 45 + Math.round(d * 6), atk: 8 + Math.round(d * 1.1), def: 2 + Math.floor(d * 0.4) }
    : { maxHp: 20 + Math.round(d * 3.5), atk: 5 + Math.round(d * 0.8), def: 1 + Math.floor(d * 0.3) };
}

// ---------------------------------------------------------------------------
// 1ターンの解決
// ---------------------------------------------------------------------------

export type TurnResult = {
  hero: Fighter;
  foe: Foe;
  sp: number;
  logs: BattleLog[];
  /** 決着 */
  outcome: "continue" | "win" | "lose" | "fled" | "flee-failed";
  /** どうぐを使った場合、消費したアイテム */
  usedItem?: string;
};

/**
 * プレイヤーのコマンド → 敵の反撃 まで1ターンぶん解決する。
 * heal は「どうぐ」で使う回復量（呼び出し側が食べ物から決める）。
 */
export function resolveTurn(params: {
  hero: Fighter;
  foe: Foe;
  sp: number;
  command: BattleCommand;
  rng: Rng;
  item?: { id: string; name: string; heal: number };
  /** 逃走可否（ボスからは逃げられない） */
  canFlee?: boolean;
}): TurnResult {
  const { rng } = params;
  const hero = { ...params.hero };
  const foe = { ...params.foe };
  let sp = params.sp;
  const logs: BattleLog[] = [];
  let guarding = false;
  let usedItem: string | undefined;

  // --- プレイヤーの行動 ---
  switch (params.command) {
    case "attack": {
      const dmg = damage(hero.atk, foe.def, rng);
      foe.hp = Math.max(0, foe.hp - dmg);
      sp = Math.min(5, sp + 1);
      logs.push({ text: `${hero.name}の こうげき！`, fx: "hit", damage: dmg, target: "foe" });
      break;
    }
    case "guard": {
      guarding = true;
      sp = Math.min(5, sp + 2);
      logs.push({ text: `${hero.name}は みをまもっている。`, fx: "guard" });
      break;
    }
    case "special": {
      if (sp < SPECIAL_COST) {
        logs.push({ text: "SPが たりない！", fx: "miss" });
        break;
      }
      sp -= SPECIAL_COST;
      const dmg = damage(hero.atk, foe.def, rng, 2.4);
      foe.hp = Math.max(0, foe.hp - dmg);
      logs.push({
        text: `${hero.name}の ひっさつ「リファクタ斬り」！`,
        fx: "crit",
        damage: dmg,
        target: "foe",
      });
      break;
    }
    case "item": {
      if (!params.item) {
        logs.push({ text: "つかえる どうぐが ない。", fx: "miss" });
        break;
      }
      const before = hero.hp;
      hero.hp = Math.min(hero.maxHp, hero.hp + params.item.heal);
      usedItem = params.item.id;
      logs.push({
        text: `${params.item.name}を たべた！ HPが ${hero.hp - before} かいふく。`,
        fx: "heal",
        damage: hero.hp - before,
        target: "hero",
      });
      break;
    }
    case "flee": {
      if (params.canFlee === false) {
        logs.push({ text: "ボスからは にげられない！", fx: "miss" });
        break;
      }
      if (rng() < 0.6) {
        logs.push({ text: "うまく にげきった！", fx: "flee" });
        return { hero, foe, sp, logs, outcome: "fled" };
      }
      logs.push({ text: "にげられなかった…！", fx: "miss" });
      break;
    }
  }

  if (foe.hp <= 0) {
    logs.push({ text: `${foe.name}を たおした！` });
    return { hero, foe, sp, logs, outcome: "win", usedItem };
  }

  // --- 敵の行動 ---
  if (foe.charging) {
    // ためた一撃
    foe.charging = false;
    const dmg = damage(
      foe.atk,
      hero.def,
      rng,
      guarding ? CHARGE_MUL * GUARD_VS_CHARGE_MUL : CHARGE_MUL
    );
    hero.hp = Math.max(0, hero.hp - dmg);
    logs.push({
      text: guarding
        ? `${foe.name}の ためた いちげき！ …まもりが まにあった！`
        : `${foe.name}の ためた いちげき！`,
      fx: "crit",
      damage: dmg,
      target: "hero",
    });
  } else if (foe.boss && rng() < 0.25) {
    // ボスはたまに「ためる」→ 次ターンに大技（まもるの読み合いが生まれる）
    foe.charging = true;
    logs.push({ text: `${foe.name}は ちからを ためている…`, fx: "charge" });
  } else {
    const dmg = damage(foe.atk, hero.def, rng, guarding ? GUARD_MUL : 1);
    hero.hp = Math.max(0, hero.hp - dmg);
    logs.push({
      text: `${foe.name}の こうげき！`,
      fx: guarding ? "guard" : "hit",
      damage: dmg,
      target: "hero",
    });
  }

  if (hero.hp <= 0) {
    return { hero, foe, sp, logs, outcome: "lose", usedItem };
  }
  return {
    hero,
    foe,
    sp,
    logs,
    outcome: params.command === "flee" ? "flee-failed" : "continue",
    usedItem,
  };
}
