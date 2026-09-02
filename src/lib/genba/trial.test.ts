import { describe, expect, it } from "vitest";
import { GENBA, type GenbaEvent } from "./content";
import {
  resolveTrialDay,
  trialInterviewRate,
  trialOffer,
  trialOwnedSkills,
  trialProjection,
} from "./trial";

const ev: GenbaEvent = {
  id: "t",
  npc: "owl",
  text: "x",
  choices: [
    {
      label: "a",
      baseRate: 0.5,
      stamina: -30,
      skillTag: "JavaScript",
      success: { text: "ok", trust: 5 },
      fail: { text: "ng", trust: -4 },
    },
  ],
};

describe("げんば体験版", () => {
  it("体験案件は実在し、必須スキルをちょうど持つ扱いになる", () => {
    const offer = trialOffer();
    expect(offer.era).toBeUndefined();
    const owned = trialOwnedSkills(offer);
    for (const s of offer.skills) expect(owned.get(s.name)).toBe(s.level);
  });

  it("面接通過率は充足度1の本番式（上限97%）", () => {
    expect(trialInterviewRate(0)).toBeCloseTo(
      GENBA.INTERVIEW_BASE + GENBA.INTERVIEW_SKILL_COEF
    );
    expect(trialInterviewRate(0.5)).toBe(0.97);
  });

  it("1日: 朝の回復→選択肢の増減→ロール。成功でしんらい+、失敗でしくじり+1", () => {
    const state = { trust: 50, stamina: 50, strikes: 0 };
    const owned = new Map([["JavaScript", 3]]);
    const ok = resolveTrialDay(ev, 0, state, owned, () => 0);
    expect(ok).toMatchObject({ ok: true, forced: false, trust: 55, strikes: 0, text: "ok" });
    expect(ok.stamina).toBe(50 + GENBA.STAMINA_RECOVER_PER_DAY - 30);
    const ng = resolveTrialDay(ev, 0, state, owned, () => 0.99);
    expect(ng).toMatchObject({ ok: false, trust: 46, strikes: 1, text: "ng" });
  });

  it("たいりょく0で強制しくじり、peacefulは常に成功", () => {
    const owned = new Map<string, number>();
    const forced = resolveTrialDay(ev, 0, { trust: 50, stamina: 0, strikes: 0 }, owned, () => 0);
    expect(forced).toMatchObject({ ok: false, forced: true, stamina: 0 });
    const peaceful = resolveTrialDay(
      { ...ev, peaceful: true },
      0,
      { trust: 50, stamina: 0, strikes: 2 },
      owned,
      () => 0.99
    );
    expect(peaceful).toMatchObject({ ok: true, strikes: 0 });
  });

  it("見込み精算は 単価×日数 + min(200, しんらい×2)", () => {
    const offer = trialOffer();
    expect(trialProjection(offer, 60)).toEqual({
      base: offer.rate * offer.days,
      bonus: 120,
      total: offer.rate * offer.days + 120,
    });
    expect(trialProjection(offer, 100).bonus).toBe(GENBA.COMPLETE_BONUS_MAX);
  });
});
