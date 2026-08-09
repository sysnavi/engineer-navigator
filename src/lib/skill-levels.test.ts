import { describe, expect, it } from "vitest";
import {
  LEVEL_MIGRATION_MAP,
  SKILL_LEVELS,
  SKILL_LEVEL_MAX,
  clampSkillLevel,
  skillLevelDef,
  skillLevelRubricText,
} from "./skill-levels";

// 10段階ルーブリックはAI解析プロンプト・深掘り判定・UIの全部が参照するマスタ。
// レベルの穴あき・範囲外がそのまま判定バグになるので構造を固定する。

describe("SKILL_LEVELS", () => {
  it("1〜10が欠番なく昇順に並んでいる", () => {
    expect(SKILL_LEVELS.map((d) => d.level)).toEqual(
      Array.from({ length: SKILL_LEVEL_MAX }, (_, i) => i + 1)
    );
  });
});

describe("clampSkillLevel", () => {
  it("範囲外は1〜10に丸める", () => {
    expect(clampSkillLevel(0)).toBe(1);
    expect(clampSkillLevel(-3)).toBe(1);
    expect(clampSkillLevel(11)).toBe(10);
  });

  it("小数は四捨五入する（AIが小数を返しても壊れない）", () => {
    expect(clampSkillLevel(5.4)).toBe(5);
    expect(clampSkillLevel(5.5)).toBe(6);
  });
});

describe("skillLevelDef", () => {
  it("定義済みレベルはその定義を返す", () => {
    expect(skillLevelDef(3).label).toBe("指導下で実務");
  });

  it("範囲外レベルでもクランプして必ず定義を返す", () => {
    expect(skillLevelDef(99).level).toBe(10);
    expect(skillLevelDef(-5).level).toBe(1);
  });
});

describe("LEVEL_MIGRATION_MAP", () => {
  it("旧5段階の全キーが新10段階の範囲に写る", () => {
    expect(Object.keys(LEVEL_MIGRATION_MAP).map(Number).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
    for (const v of Object.values(LEVEL_MIGRATION_MAP)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(SKILL_LEVEL_MAX);
    }
  });
});

describe("skillLevelRubricText", () => {
  it("AIプロンプト用に全レベルを1行へ連結する", () => {
    const text = skillLevelRubricText();
    expect(text).toContain("1=入門");
    expect(text).toContain("10=発信");
  });
});
