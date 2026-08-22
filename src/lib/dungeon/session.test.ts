import { describe, expect, it } from "vitest";
import {
  createDiveState,
  doChoice,
  doNext,
  enterFloor,
  MAX_FLOORS,
  type DiveState,
} from "./session";

// ボス撃破後の進行の回帰テスト。
// かつて doNext がボス撃破で強制的に END + logs=[] にしており、
// 「メッセージが空白のまま探索が終わる／それ以上潜れない」バグになっていた。

function baseState(over: Partial<DiveState> = {}): DiveState {
  const s = createDiveState({
    baseDepth: 5,
    stats: { maxHp: 80, maxSp: 5, atk: 12, def: 5 },
    hasReportShield: false,
    firstDive: false,
    items: [],
  });
  return { ...s, ...over };
}

describe("doNext（イベント読了後の分岐）", () => {
  it("ボスを倒していても探索は終わらず、分岐（CHOICE）に進める", () => {
    const st = doNext(baseState({ floor: 3, bossDefeated: true, phase: "EVENT" }));
    expect(st.phase).toBe("CHOICE");
    expect(st.ending).toBeNull();
  });

  it("最終階に達したら終了。ボス撃破済みなら ending は cleared になる", () => {
    const st = doNext(baseState({ floor: MAX_FLOORS, bossDefeated: true, phase: "EVENT" }));
    expect(st.phase).toBe("END");
    expect(st.ending).toBe("cleared");
  });

  it("最終階での終了はボス未撃破なら limit", () => {
    const st = doNext(baseState({ floor: MAX_FLOORS, phase: "EVENT" }));
    expect(st.phase).toBe("END");
    expect(st.ending).toBe("limit");
  });

  it("ENDに入るときメッセージが空白にならない（締めの一言が必ず出る）", () => {
    const st = doNext(baseState({ floor: MAX_FLOORS, bossDefeated: true, phase: "EVENT" }));
    expect(st.logs.length).toBeGreaterThan(0);
    expect(st.logs[0].text).not.toBe("");
  });
});

describe("doChoice（次の階の選択）", () => {
  it("引き返すと escaped。ボス撃破済みなら cleared（勲章は消えない）", () => {
    const escaped = doChoice(baseState({ floor: 2, phase: "CHOICE" }), "leave", () => 0.5);
    expect(escaped.ending).toBe("escaped");
    const cleared = doChoice(
      baseState({ floor: 2, bossDefeated: true, phase: "CHOICE" }),
      "leave",
      () => 0.5
    );
    expect(cleared.ending).toBe("cleared");
  });

  it("引き返した時も締めの一言が出る（直前のログの再生ではなく）", () => {
    const before: DiveState = baseState({
      floor: 2,
      phase: "CHOICE",
      logs: [{ text: "宝箱を見つけた！開けてみると…" }],
    });
    const st = doChoice(before, "leave", () => 0.5);
    expect(st.logs.length).toBeGreaterThan(0);
    expect(st.logs).not.toEqual(before.logs);
  });

  it("深く潜る=+2階 / 慎重に進む=+1階 で次の階に入る", () => {
    const deep = doChoice(baseState({ floor: 2, depth: 5, phase: "CHOICE" }), "deep", () => 0.99);
    expect(deep.depth).toBe(7);
    expect(deep.floor).toBe(3);
    const careful = doChoice(
      baseState({ floor: 2, depth: 5, phase: "CHOICE" }),
      "careful",
      () => 0.99
    );
    expect(careful.depth).toBe(6);
  });
});

describe("enterFloor（ボスの出現）", () => {
  // rng=0 はボス抽選（rng() < BOSS_RATE）に必ず当たる値
  it("深度が足りていればボスが出る", () => {
    const st = enterFloor(baseState({ depth: 6 }), () => 0);
    expect(st.foe?.boss).toBe(true);
  });

  it("ボス撃破後は二度目のボスを出さない（探索を続けても再戦にならない）", () => {
    const st = enterFloor(baseState({ depth: 6, bossDefeated: true }), () => 0);
    expect(st.foe?.boss ?? false).toBe(false);
  });
});
