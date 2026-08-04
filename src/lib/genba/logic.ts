// げんばの純ロジック（クライアント/サーバー共用・prisma依存禁止）。
// 「表示の再現」はseedから決定的に、「成否のロール」はサーバーのみ（actions.ts）——ダンジョンと同方針。

import {
  GENBA,
  OFFER_TEMPLATES,
  eventsForTheme,
  type GenbaEvent,
  type GenbaTheme,
  type OfferTemplate,
} from "./content";

// walk/world.ts と同系の整数ハッシュ（決定的・環境非依存）
export function hash(n: number): number {
  let x = n | 0;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = (x >>> 16) ^ x;
  return x >>> 0;
}

/** 文字列→32bit seed（userId等をseedに混ぜる用） */
export function strSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** サーバーローカルの今日 "YYYY-MM-DD"（DungeonRun.slot と同じ流儀） */
export function todayStr(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** LCG + Fisher-Yates（walk/world.ts の shuffledSeq と同方式） */
export function shuffled<T>(list: T[], seed: number): T[] {
  const arr = [...list];
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- 案件提示 ----

export type GenbaOffer = OfferTemplate & {
  offerId: string; // "<templateId>:<date>:<枠>" — 応募検証・当日ブロックのキー
  rateToday: number; // 営業信頼ボーナス込みの提示単価
};

/** きょうの提示案件（seed決定的・DB保存しない）。
 *  信頼度20+で4件、40+で単価+5%。テーマが偏らないよう全テンプレをシャッフルして先頭から取る。
 *  信頼度60+の日は、たまに「妙な案件」（きおくの現場）が最後に紛れ込む */
export function offersForDay(
  userId: string,
  date: string,
  salesTrust: number
): GenbaOffer[] {
  const count = salesTrust >= GENBA.SALES_TRUST_EXTRA_OFFER ? 4 : 3;
  const rateBonus = salesTrust >= GENBA.SALES_TRUST_RATE_BONUS ? 1.05 : 1;
  const seed = hash(strSeed(userId) ^ strSeed(date));
  const offers: GenbaOffer[] = shuffled(
    OFFER_TEMPLATES.filter((t) => !t.era),
    seed
  )
    .slice(0, count)
    .map((t, i) => ({
      ...t,
      offerId: `${t.id}:${date}:${i}`,
      rateToday: Math.round(t.rate * rateBonus),
    }));
  if (salesTrust >= GENBA.SALES_TRUST_ERA_OFFER) {
    const eras = OFFER_TEMPLATES.filter((t) => t.era);
    const roll = hash(seed ^ 0x716b6f); // 「きおく」枠専用のロール（案件シャッフルとは独立）
    if (eras.length > 0 && roll % 4 === 0) {
      const t = eras[hash(roll) % eras.length];
      // 単価は当時の相場そのまま（信頼ボーナス対象外）。枠名も特別に "era"
      offers.push({ ...t, offerId: `${t.id}:${date}:era`, rateToday: t.rate });
    }
  }
  return offers;
}

/** offerId を検証して案件を復元する（きょうの提示に実在するか） */
export function resolveOffer(
  userId: string,
  date: string,
  salesTrust: number,
  offerId: string
): GenbaOffer | null {
  return (
    offersForDay(userId, date, salesTrust).find((o) => o.offerId === offerId) ??
    null
  );
}

// ---- スキル充足度 ----

/** 充足度 m = Σmin(保有Lv, 必要Lv) / Σ必要Lv（0..1）。skills: 本人の承認済みスキル名→Lv */
export function fulfillment(
  required: { name: string; level: number }[],
  owned: Map<string, number>
): number {
  if (required.length === 0) return 1;
  let have = 0;
  let need = 0;
  for (const r of required) {
    need += r.level;
    have += Math.min(owned.get(r.name) ?? 0, r.level);
  }
  return need === 0 ? 1 : have / need;
}

/** 相性の星（案件カード表示用 0..5） */
export function matchStars(m: number): number {
  return Math.round(m * 5);
}

/** 面接の基礎通過率（受け答えmod抜き） */
export function interviewBaseRate(m: number): number {
  return GENBA.INTERVIEW_BASE + GENBA.INTERVIEW_SKILL_COEF * m;
}

// ---- 現場イベント ----

/** その契約の day 日目（1始まり）のイベント。seedシャッフルした列を周回するので
 *  契約内で同じイベントが続けて出ない（プール一巡までは重複なし） */
export function eventForDay(
  seed: number,
  theme: GenbaTheme,
  day: number
): GenbaEvent {
  const pool = eventsForTheme(theme);
  const cycle = Math.floor((day - 1) / pool.length);
  // 周回ごとに並びを変える（2周目以降も日ごとの並びが新しくなる）
  const seq = shuffled(pool, hash(seed ^ Math.imul(cycle + 1, 0x9e3779b9)));
  return seq[(day - 1) % pool.length];
}

/** イベント選択肢の成功率（サーバーがこの値でロールする。クライアントは表示目安に使う） */
export function choiceRate(
  base: number,
  m: number,
  hasSkillTag: boolean
): number {
  const p =
    base +
    (m - 0.5) * GENBA.EVENT_MATCH_COEF +
    (hasSkillTag ? GENBA.EVENT_SKILL_BONUS : 0);
  return Math.min(0.98, Math.max(0.05, p));
}

// ---- 精算 ----

export function settleCompleted(rate: number, totalDays: number, trust: number): number {
  const bonus = Math.min(
    GENBA.COMPLETE_BONUS_MAX,
    trust * GENBA.COMPLETE_BONUS_PER_TRUST
  );
  return rate * totalDays + bonus;
}

export function settleFailed(rate: number, daysWorked: number): number {
  return Math.floor(rate * daysWorked * GENBA.EARLY_EXIT_RATE);
}

// ---- 契約ログ（GenbaContract.log の1要素） ----
export type GenbaLogEntry = {
  d: number; // 現場日（1始まり）
  t: string; // リアル日 "YYYY-MM-DD"（いつ遊んだかの記録）
  ev: string; // イベントID
  c: number; // 選んだ選択肢index
  ok: boolean;
  trust: number; // 適用後の値（リプレイ表示用）
  stamina: number;
};
