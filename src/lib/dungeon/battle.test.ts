import { describe, expect, it } from "vitest";
import {
  resolveAnswer,
  resolveTurn,
  FAST_ANSWER_MS,
  HINT_COST,
  type Fighter,
  type Foe,
  type PendingQuestion,
} from "./battle";

// 「問いに答えて倒す」戦闘の回帰テスト。乱数は固定して決定的に検証する。

const mid = () => 0.5; // variance = 1.0 / ボスは「ためる」判定(0.25)に当たらない

function hero(over: Partial<Fighter> = {}): Fighter {
  return { name: "きみ", hp: 60, maxHp: 60, atk: 14, def: 5, ...over };
}
function question(over: Partial<PendingQuestion> = {}): PendingQuestion {
  return {
    source: "bank",
    id: "q1",
    kind: "choice",
    topic: "SQL",
    prompt: "?",
    choices: ["a", "b", "c", "d"],
    difficulty: 2,
    askedAt: 0,
    hidden: [],
    ...over,
  };
}
function foe(over: Partial<Foe> = {}): Foe {
  return {
    id: "nullpo",
    name: "ヌルポ",
    sprite: "mon-nullpo",
    boss: false,
    hp: 40,
    maxHp: 40,
    atk: 9,
    def: 2,
    question: question(),
    ...over,
  };
}

describe("resolveAnswer（正解＝攻撃／不正解＝被弾）", () => {
  it("正解すると敵だけがダメージを受け、SPが1たまる", () => {
    const r = resolveAnswer({ hero: hero(), foe: foe(), sp: 0, correct: true, elapsedMs: 30_000, rng: mid });
    expect(r.foe.hp).toBeLessThan(40);
    expect(r.hero.hp).toBe(60);
    expect(r.sp).toBe(1);
    expect(r.questionDone).toBe(true);
    expect(r.outcome).toBe("continue");
  });

  it("はやい正解はクリティカル（遅い正解より大きい）", () => {
    const slow = resolveAnswer({ hero: hero(), foe: foe(), sp: 0, correct: true, elapsedMs: FAST_ANSWER_MS + 1, rng: mid });
    const fast = resolveAnswer({ hero: hero(), foe: foe(), sp: 0, correct: true, elapsedMs: FAST_ANSWER_MS, rng: mid });
    expect(40 - fast.foe.hp).toBeGreaterThan(40 - slow.foe.hp);
    expect(fast.logs[0].fx).toBe("crit");
  });

  it("不正解だと自分だけがダメージを受ける", () => {
    const r = resolveAnswer({ hero: hero(), foe: foe(), sp: 0, correct: false, elapsedMs: 1000, rng: mid });
    expect(r.hero.hp).toBeLessThan(60);
    expect(r.foe.hp).toBe(40);
    expect(r.logs[0].fx).toBe("wrong");
  });

  it("○×は四択より1問あたりの攻防が軽い", () => {
    const choice = resolveAnswer({ hero: hero(), foe: foe(), sp: 0, correct: true, elapsedMs: 99_999, rng: mid });
    const tf = resolveAnswer({
      hero: hero(),
      foe: foe({ question: question({ kind: "truefalse", choices: ["○", "×"] }) }),
      sp: 0,
      correct: true,
      elapsedMs: 99_999,
      rng: mid,
    });
    expect(40 - tf.foe.hp).toBeLessThan(40 - choice.foe.hp);
  });

  it("ためた敵に不正解すると重い一撃、正解すれば空振り", () => {
    const plain = resolveAnswer({ hero: hero(), foe: foe(), sp: 0, correct: false, elapsedMs: 0, rng: mid });
    const charged = resolveAnswer({ hero: hero(), foe: foe({ charging: true }), sp: 0, correct: false, elapsedMs: 0, rng: mid });
    expect(60 - charged.hero.hp).toBeGreaterThan(60 - plain.hero.hp);
    expect(charged.foe.charging).toBe(false);

    const dodged = resolveAnswer({ hero: hero(), foe: foe({ charging: true }), sp: 0, correct: true, elapsedMs: 0, rng: mid });
    expect(dodged.hero.hp).toBe(60);
    expect(dodged.foe.charging).toBe(false);
  });

  it("敵のHPを0にすると勝ち、自分のHPが0になると負け", () => {
    const win = resolveAnswer({ hero: hero(), foe: foe({ hp: 1 }), sp: 0, correct: true, elapsedMs: 0, rng: mid });
    expect(win.outcome).toBe("win");
    const lose = resolveAnswer({ hero: hero({ hp: 1 }), foe: foe(), sp: 0, correct: false, elapsedMs: 0, rng: mid });
    expect(lose.outcome).toBe("lose");
  });

  it("ボスはターンの終わりに「ためる」ことがある", () => {
    // rng: variance用に0.5、ためる判定で0（<0.25）
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0.5 : 0);
    const r = resolveAnswer({ hero: hero(), foe: foe({ boss: true, hp: 100, maxHp: 100 }), sp: 0, correct: true, elapsedMs: 99_999, rng });
    expect(r.foe.charging).toBe(true);
    expect(r.logs.some((l) => l.fx === "charge")).toBe(true);
  });
});

describe("resolveTurn（解答以外のコマンド）", () => {
  it("パスは問いを片付けて、軽く被弾し、SPが2たまる", () => {
    const wrong = resolveAnswer({ hero: hero(), foe: foe(), sp: 0, correct: false, elapsedMs: 0, rng: mid });
    const pass = resolveTurn({ hero: hero(), foe: foe(), sp: 0, command: "pass", rng: mid });
    expect(pass.questionDone).toBe(true);
    expect(pass.sp).toBe(2);
    expect(60 - pass.hero.hp).toBeLessThan(60 - wrong.hero.hp);
  });

  it("ためた敵へのパスは、不正解で受けるより大きく軽減される", () => {
    const wrong = resolveAnswer({ hero: hero(), foe: foe({ charging: true }), sp: 0, correct: false, elapsedMs: 0, rng: mid });
    const pass = resolveTurn({ hero: hero(), foe: foe({ charging: true }), sp: 0, command: "pass", rng: mid });
    expect(60 - pass.hero.hp).toBeLessThan((60 - wrong.hero.hp) / 3);
  });

  it("ヒントはSPを消費して選択肢を消し、敵のターンは来ない", () => {
    const r = resolveTurn({ hero: hero(), foe: foe(), sp: HINT_COST, command: "hint", rng: mid, hintHide: [1, 3] });
    expect(r.sp).toBe(0);
    expect(r.foe.question?.hidden).toEqual([1, 3]);
    expect(r.hero.hp).toBe(60);
    expect(r.questionDone).toBe(false);
  });

  it("SPが足りないヒントは何も起きない", () => {
    const r = resolveTurn({ hero: hero(), foe: foe(), sp: HINT_COST - 1, command: "hint", rng: mid, hintHide: [1, 3] });
    expect(r.sp).toBe(HINT_COST - 1);
    expect(r.foe.question?.hidden).toEqual([]);
    expect(r.logs[0].fx).toBe("miss");
  });

  it("○×にはヒントがきかない", () => {
    const r = resolveTurn({
      hero: hero(),
      foe: foe({ question: question({ kind: "truefalse", choices: ["○", "×"] }) }),
      sp: HINT_COST,
      command: "hint",
      rng: mid,
      hintHide: [1],
    });
    expect(r.sp).toBe(HINT_COST);
    expect(r.foe.question?.hidden).toEqual([]);
  });

  it("どうぐは回復して敵のターンが来るが、問いは残る", () => {
    const r = resolveTurn({
      hero: hero({ hp: 20 }),
      foe: foe(),
      sp: 0,
      command: "item",
      rng: mid,
      item: { id: "onigiri", name: "おにぎり", heal: 18 },
    });
    expect(r.usedItem).toBe("onigiri");
    expect(r.hero.hp).toBeGreaterThan(20);
    expect(r.hero.hp).toBeLessThan(38);
    expect(r.questionDone).toBe(false);
    expect(r.foe.question).toBeDefined();
  });

  it("ボスからは逃げられない", () => {
    const r = resolveTurn({ hero: hero(), foe: foe({ boss: true }), sp: 0, command: "flee", rng: mid, canFlee: false });
    expect(r.outcome).toBe("continue");
    expect(r.hero.hp).toBe(60);
  });
});
