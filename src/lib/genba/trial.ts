// げんば体験版（チュートリアル内で遊ぶ縮小版）の純ロジック。
// 本番（actions.ts）と同じ式で面接と現場の1日を判定するが、DBには一切触れず報酬も出さない。
// 成否のロールは rng を注入できるようにしてテスト可能にしてある（既定は Math.random）。

import {
  GENBA,
  OFFER_TEMPLATES,
  offerTemplateById,
  type GenbaEvent,
  type OfferTemplate,
} from "./content";
import { choiceRate, interviewBaseRate } from "./logic";

/** 体験に使う案件。要求スキルが軽く、面接官・イベントの雰囲気が初見向き */
export const TRIAL_OFFER_ID = "web-junior";
/** 体験する現場日数（本番は10〜20日） */
export const TRIAL_DAYS = 2;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function trialOffer(): OfferTemplate {
  return offerTemplateById(TRIAL_OFFER_ID) ?? OFFER_TEMPLATES[0];
}

/** 体験版では「案件の必須スキルをちょうど持っている」前提（充足度=1、経歴書の選択肢も解放） */
export function trialOwnedSkills(offer: OfferTemplate): Map<string, number> {
  return new Map(offer.skills.map((s) => [s.name, s.level]));
}

/** 面接: 本番と同じ 通過率 = 40% + 55%×充足度(=1) + 受け答え */
export function trialInterviewRate(mod: number): number {
  return clamp(interviewBaseRate(1) + mod, 0.05, 0.97);
}

export function trialInterviewPass(mod: number, rng: () => number = Math.random): boolean {
  return rng() < trialInterviewRate(mod);
}

export type TrialDayState = { trust: number; stamina: number; strikes: number };
export type TrialDayResult = TrialDayState & {
  ok: boolean;
  forced: boolean; // たいりょく0の強制しくじり
  text: string;
};

/** 現場の1日（actions.ts の workChoice と同じ順序: 朝の回復 → 選択肢の増減 → 0なら強制しくじり → ロール） */
export function resolveTrialDay(
  event: GenbaEvent,
  choiceIdx: number,
  state: TrialDayState,
  owned: Map<string, number>,
  rng: () => number = Math.random
): TrialDayResult {
  const choice = event.choices[choiceIdx];
  if (!choice) throw new Error("選択が不正です");

  const staminaStart = Math.min(100, state.stamina + GENBA.STAMINA_RECOVER_PER_DAY);
  const stamina = clamp(staminaStart + (choice.stamina ?? 0), 0, 100);
  const forced = !event.peaceful && stamina === 0;

  let ok: boolean;
  if (event.peaceful) ok = true;
  else if (forced) ok = false;
  else {
    const p = choiceRate(
      choice.baseRate,
      1,
      !!choice.skillTag && owned.has(choice.skillTag)
    );
    ok = rng() < p;
  }

  const outcome = ok ? choice.success : choice.fail;
  return {
    ok,
    forced,
    text: outcome.text,
    trust: clamp(state.trust + outcome.trust, 0, 100),
    stamina,
    strikes: ok ? 0 : state.strikes + 1,
  };
}

/** 「本番ならこう精算される」見込み（満了前提）。表示専用で、どこにも加算しない */
export function trialProjection(offer: OfferTemplate, trust: number) {
  const base = offer.rate * offer.days;
  const bonus = Math.min(GENBA.COMPLETE_BONUS_MAX, trust * GENBA.COMPLETE_BONUS_PER_TRUST);
  return { base, bonus, total: base + bonus };
}
