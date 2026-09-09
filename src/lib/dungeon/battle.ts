// 戦闘（問いに答えて倒す）。
//
// 判定は全部ここ＝サーバー側で行う。クライアントから来るのは選択肢の index と
// コマンド名だけで、正誤もダメージも受け取らない。
// 乱数以外は純関数なので、バランス調整はシミュレーションで検証できる。
//
// 設計の考え方:
//  - モンスターは得意領域の問題を出す。**正解＝こちらの攻撃、不正解＝敵の攻撃**。
//    倒し方が「知っているか」になる。ここがこのダンジョンの芯。
//  - 「はやい正解」はクリティカル。考えた末の正解も正解だが、即答は気持ちいい。
//  - 「パス」は問いを見送って半減で受ける。「間違えると痛い問いを見送る」判断。
//  - 「ヒント」はSPを使って選択肢を2つ消す。SPは正解とパスで貯まる。
//  - ボスは「ためる」＝次の問いが難問になり、不正解の一撃が重い。パスなら軽い。
//  - 「どうぐ」は拾ったごはんを使う。ペット機能との接続点でもある。

import type { Rarity } from "./content";

export type Fighter = {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
};

export type QuestionKind = "choice" | "truefalse";

/** 出題中の問い。正解の index は持たない（state は DB に残るため） */
export type PendingQuestion = {
  source: "bank" | "riddle";
  id: string;
  kind: QuestionKind;
  topic: string;
  prompt: string;
  choices: string[];
  /** 1=やさしい 2=ふつう 3=難問（ボスの「ためる」後はこれ） */
  difficulty: 1 | 2 | 3;
  /** 発問時刻（epoch ms）。はやい正解の判定はサーバーの時計で行う */
  askedAt: number;
  /** ヒントで消した選択肢の index */
  hidden: number[];
};

export type Foe = Fighter & {
  id: string;
  sprite: string;
  boss: boolean;
  /** ためる中（次の問いは難問・不正解の一撃が重い）*/
  charging?: boolean;
  /** いま出している問い */
  question?: PendingQuestion;
  /** ○×高速ラウンド（浅い階の雑魚戦）。この敵の問いは全部 ○× になる */
  rapid?: boolean;
};

export type BattleCommand = "pass" | "hint" | "item" | "charm" | "flee";

export const HINT_COST = 3;
/** パス中の被ダメージ倍率 */
const PASS_MUL = 0.4;
/** ためた敵の一撃の倍率。無防備で受けると致命的だが、パスすれば大きく軽減できる＝読み合い */
const CHARGE_MUL = 2.4;
/** ためた一撃をパスで受けたときの倍率（通常のパスより厚い） */
const PASS_VS_CHARGE_MUL = 0.3;
/** 不正解で受ける一撃の倍率。まちがいは学びの瞬間でもあるので、素の攻撃よりやや軽い
 *  （数値を触ったら scripts/sim-dungeon.ts を回し直すこと） */
const WRONG_MUL = 0.75;
/** これより速い正解はクリティカル */
export const FAST_ANSWER_MS = 10_000;
const FAST_MUL = 1.5;
/** 問いの種類ごとの攻防倍率。○×は1問が軽い（5連で1戦ぶん） */
export const KIND_MUL: Record<QuestionKind, number> = { choice: 1, truefalse: 0.45 };
/** ボスが「ためる」確率（1ターン終了時） */
const BOSS_CHARGE_RATE = 0.25;

export type BattleLog = {
  text: string;
  /** 演出のヒント（UIがアニメを選ぶ） */
  fx?: "hit" | "crit" | "guard" | "heal" | "miss" | "flee" | "charge" | "correct" | "wrong";
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
  /** 知恵の護符を使ったか（呼び出し側で所持数を減らす） */
  usedCharm?: boolean;
  /** 出していた問いが片付いた（次の問いが要る） */
  questionDone: boolean;
};

/** 敵の攻撃。ためていればその一撃（倍率は呼び出し側が決める） */
function foeStrike(
  hero: Fighter,
  foe: Foe,
  rng: Rng,
  mul: number,
  logs: BattleLog[],
  text: string,
  fx: BattleLog["fx"]
) {
  const dmg = damage(foe.atk, hero.def, rng, mul);
  hero.hp = Math.max(0, hero.hp - dmg);
  logs.push({ text, fx, damage: dmg, target: "hero" });
}

/** ターンの締め。敵が生きていればボスはたまに「ためる」 */
function endOfTurn(foe: Foe, rng: Rng, logs: BattleLog[]) {
  if (foe.hp > 0 && foe.boss && !foe.charging && rng() < BOSS_CHARGE_RATE) {
    foe.charging = true;
    logs.push({ text: `${foe.name}は ちからを ためている… つぎの問いは 難問だ。`, fx: "charge" });
  }
}

function settle(
  hero: Fighter,
  foe: Foe,
  sp: number,
  logs: BattleLog[],
  questionDone: boolean,
  extra: Pick<TurnResult, "usedItem" | "usedCharm"> = {}
): TurnResult {
  if (foe.hp <= 0) {
    logs.push({ text: `${foe.name}を たおした！` });
    return { hero, foe, sp, logs, outcome: "win", questionDone: true, ...extra };
  }
  if (hero.hp <= 0) {
    return { hero, foe, sp, logs, outcome: "lose", questionDone: true, ...extra };
  }
  return { hero, foe, sp, logs, outcome: "continue", questionDone, ...extra };
}

/**
 * 問いへの解答を解決する。正解＝こちらの攻撃、不正解＝敵の攻撃。
 * 正誤の判定は呼び出し側（正解を知っているサーバー）が済ませて渡す。
 */
export function resolveAnswer(params: {
  hero: Fighter;
  foe: Foe;
  sp: number;
  correct: boolean;
  elapsedMs: number;
  rng: Rng;
}): TurnResult {
  const { rng } = params;
  const hero = { ...params.hero };
  const foe = { ...params.foe };
  let sp = params.sp;
  const logs: BattleLog[] = [];
  const kind = foe.question?.kind ?? "choice";
  const kindMul = KIND_MUL[kind];
  const wasCharging = !!foe.charging;
  foe.charging = false;

  if (params.correct) {
    const fast = params.elapsedMs >= 0 && params.elapsedMs <= FAST_ANSWER_MS;
    const dmg = damage(hero.atk, foe.def, rng, kindMul * (fast ? FAST_MUL : 1));
    foe.hp = Math.max(0, foe.hp - dmg);
    sp = Math.min(5, sp + 1);
    logs.push({
      text: fast ? `せいかい！ 即答の いちげき！` : `せいかい！ ${hero.name}の こうげき！`,
      fx: fast ? "crit" : "correct",
      damage: dmg,
      target: "foe",
    });
    if (wasCharging) {
      logs.push({ text: `${foe.name}の ためた いちげきは 空を切った。`, fx: "guard" });
    }
  } else {
    foeStrike(
      hero,
      foe,
      rng,
      kindMul * (wasCharging ? CHARGE_MUL : WRONG_MUL),
      logs,
      wasCharging ? `まちがい… ${foe.name}の ためた いちげき！` : `まちがい… ${foe.name}の こうげき！`,
      wasCharging ? "crit" : "wrong"
    );
  }

  endOfTurn(foe, rng, logs);
  return settle(hero, foe, sp, logs, true);
}

/**
 * 解答以外のコマンド → 敵の反撃 まで1ターンぶん解決する。
 * heal は「どうぐ」で使う回復量（呼び出し側が食べ物から決める）。
 * hint で消す選択肢は呼び出し側（正解を知っている側）が決めて渡す。
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
  /** 知恵の護符の所持数（AIメンターに相談した日だけ持てる） */
  charms?: number;
  /** ヒントで消す選択肢の index（2つ） */
  hintHide?: number[];
}): TurnResult {
  const { rng } = params;
  const hero = { ...params.hero };
  const foe = { ...params.foe };
  let sp = params.sp;
  const logs: BattleLog[] = [];
  const kindMul = KIND_MUL[foe.question?.kind ?? "choice"];
  let usedItem: string | undefined;
  let usedCharm: boolean | undefined;

  switch (params.command) {
    case "pass": {
      // 問いを見送る。敵の攻撃を薄く受け、SPを貯める
      sp = Math.min(5, sp + 2);
      const wasCharging = !!foe.charging;
      foe.charging = false;
      logs.push({ text: `この問いは 見送った。`, fx: "guard" });
      foeStrike(
        hero,
        foe,
        rng,
        kindMul * (wasCharging ? PASS_VS_CHARGE_MUL : PASS_MUL),
        logs,
        wasCharging
          ? `${foe.name}の ためた いちげき！ …身をかわして かすり傷。`
          : `${foe.name}の こうげき！ …かすり傷で すんだ。`,
        "guard"
      );
      endOfTurn(foe, rng, logs);
      return settle(hero, foe, sp, logs, true);
    }
    case "hint": {
      // 選択肢を2つ消す。敵のターンは来ない（SPが対価）
      if (sp < HINT_COST) {
        logs.push({ text: "SPが たりない！", fx: "miss" });
        return settle(hero, foe, sp, logs, false);
      }
      if (!foe.question || foe.question.kind !== "choice") {
        logs.push({ text: "○×には ヒントが きかない。", fx: "miss" });
        return settle(hero, foe, sp, logs, false);
      }
      if (!params.hintHide || params.hintHide.length === 0) {
        logs.push({ text: "これ以上 消せる選択肢が ない。", fx: "miss" });
        return settle(hero, foe, sp, logs, false);
      }
      sp -= HINT_COST;
      foe.question = {
        ...foe.question,
        hidden: Array.from(new Set([...foe.question.hidden, ...params.hintHide])),
      };
      logs.push({ text: `ヒント！ 選択肢が ${params.hintHide.length}つ 消えた。`, fx: "heal" });
      return settle(hero, foe, sp, logs, false);
    }
    case "item": {
      if (!params.item) {
        logs.push({ text: "つかえる どうぐが ない。", fx: "miss" });
        return settle(hero, foe, sp, logs, false);
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
    case "charm": {
      // 知恵の護符（AIメンターに相談した日だけ持てる）。HPを全回復する切り札
      if (!params.charms || params.charms <= 0) {
        logs.push({ text: "おふだを もっていない。", fx: "miss" });
        return settle(hero, foe, sp, logs, false);
      }
      const before = hero.hp;
      hero.hp = hero.maxHp;
      usedCharm = true;
      logs.push({
        text: `知恵の護符が 光った！ HPが ${hero.hp - before} かいふく。`,
        fx: "heal",
        damage: hero.hp - before,
        target: "hero",
      });
      break;
    }
    case "flee": {
      if (params.canFlee === false) {
        logs.push({ text: "ボスからは にげられない！", fx: "miss" });
        return settle(hero, foe, sp, logs, false);
      }
      if (rng() < 0.6) {
        logs.push({ text: "うまく にげきった！", fx: "flee" });
        return { hero, foe, sp, logs, outcome: "fled", questionDone: true };
      }
      logs.push({ text: "にげられなかった…！", fx: "miss" });
      break;
    }
  }

  // --- どうぐ・おふだ・逃走失敗: 敵のターン（問いはそのまま残る） ---
  const wasCharging = !!foe.charging;
  foe.charging = false;
  foeStrike(
    hero,
    foe,
    rng,
    wasCharging ? CHARGE_MUL : 1,
    logs,
    wasCharging ? `${foe.name}の ためた いちげき！` : `${foe.name}の こうげき！`,
    wasCharging ? "crit" : "hit"
  );
  if (hero.hp <= 0) {
    return { hero, foe, sp, logs, outcome: "lose", usedItem, usedCharm, questionDone: true };
  }
  endOfTurn(foe, rng, logs);
  return {
    hero,
    foe,
    sp,
    logs,
    outcome: params.command === "flee" ? "flee-failed" : "continue",
    usedItem,
    usedCharm,
    questionDone: false,
  };
}
