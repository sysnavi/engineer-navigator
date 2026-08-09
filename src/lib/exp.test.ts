import { describe, expect, it } from "vitest";
import {
  EXP_WEIGHTS,
  REBIRTH_MIN_LEVEL,
  STAGES,
  expForLevel,
  levelFromExp,
  stageFor,
  stageForLevel,
} from "./exp";

// レベルカーブと進化段階は保存されない導出値（EXPから毎回計算）。
// 式を変えると全ユーザーのレベル・進化が一斉に変わるため、境界を固定しておく。

describe("levelFromExp / expForLevel", () => {
  it("Lv1は0EXPから、Lv2は50EXPから", () => {
    expect(levelFromExp(0)).toBe(1);
    expect(levelFromExp(49)).toBe(1);
    expect(levelFromExp(50)).toBe(2);
  });

  it("負のEXPでもLv1に丸める（重み変更でEXPが目減りしても壊れない）", () => {
    expect(levelFromExp(-100)).toBe(1);
  });

  it("expForLevel はレベル閾値の逆関数になっている", () => {
    for (let lv = 1; lv <= 30; lv++) {
      expect(levelFromExp(expForLevel(lv))).toBe(lv);
      if (lv >= 2) expect(levelFromExp(expForLevel(lv) - 1)).toBe(lv - 1);
    }
  });
});

describe("stageFor", () => {
  it("初代はレベルに応じて egg → chick → … → meister", () => {
    expect(stageFor(1, 1).sprite).toBe("egg");
    expect(stageFor(3, 1).sprite).toBe("chick");
    expect(stageFor(12, 1).sprite).toBe("meister");
  });

  it("世代限定の形態は初代では出ない（けんじゃはLv14でも2世代目から）", () => {
    expect(stageFor(14, 1).sprite).toBe("meister");
    expect(stageFor(14, 2).sprite).toBe("sage");
    expect(stageFor(16, 2).sprite).toBe("sage");
    expect(stageFor(16, 3).sprite).toBe("legend");
  });

  it("2世代目のLv1はきんのたまごから始まる", () => {
    expect(stageFor(1, 2).sprite).toBe("goldegg");
  });

  it("stageForLevel は世代1として解決する（公開ビュー用の後方互換）", () => {
    expect(stageForLevel(14).sprite).toBe("meister");
  });
});

describe("整合性", () => {
  it("転生条件レベルにはマイスター段階が存在する", () => {
    expect(stageFor(REBIRTH_MIN_LEVEL, 1).sprite).toBe("meister");
  });

  it("STAGES は minLevel 昇順（stageFor が最後のマッチを取る前提）", () => {
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].minLevel).toBeGreaterThanOrEqual(STAGES[i - 1].minLevel);
    }
  });

  it("EXP重みはすべて正の値（負の重みは導出EXPを壊す）", () => {
    for (const v of Object.values(EXP_WEIGHTS)) expect(v).toBeGreaterThan(0);
  });
});
