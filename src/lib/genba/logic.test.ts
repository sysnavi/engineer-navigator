import { describe, expect, it } from "vitest";
import { GENBA, OFFER_TEMPLATES } from "./content";
import {
  availableTemplates,
  completedTrustMap,
  hash,
  matchStars,
  offersForDay,
  resolveOffer,
  shuffled,
  strSeed,
  todayStr,
} from "./logic";

// げんばは「表示の再現はseedから決定的に」が設計方針（logic.ts 冒頭）。
// ハッシュ・シャッフルの決定性が崩れると、リロードのたびに案件や
// イベントが入れ替わって見えるバグになるため、ここで固定する。

describe("hash / strSeed", () => {
  it("同じ入力は常に同じ値（決定的）", () => {
    expect(hash(42)).toBe(hash(42));
    expect(strSeed("user-abc")).toBe(strSeed("user-abc"));
  });

  it("異なる入力は異なる値になる（代表ケース）", () => {
    expect(hash(1)).not.toBe(hash(2));
    expect(strSeed("user-a")).not.toBe(strSeed("user-b"));
  });

  it("常に32bit非負整数を返す", () => {
    for (const n of [0, 1, -1, 2 ** 31, 123456789]) {
      const h = hash(n);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(h)).toBe(true);
    }
  });
});

describe("shuffled", () => {
  it("同じseedなら同じ並び・要素は失わない", () => {
    const list = ["a", "b", "c", "d", "e"];
    const s1 = shuffled(list, 7);
    expect(shuffled(list, 7)).toEqual(s1);
    expect([...s1].sort()).toEqual([...list].sort());
  });

  it("元の配列を破壊しない", () => {
    const list = [1, 2, 3];
    shuffled(list, 1);
    expect(list).toEqual([1, 2, 3]);
  });
});

describe("todayStr", () => {
  it("サーバーローカル日付を YYYY-MM-DD で返す（ゼロ埋め）", () => {
    expect(todayStr(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("matchStars", () => {
  it("マッチ度0〜1を星の段階に写す（単調増加）", () => {
    let prev = matchStars(0);
    for (const m of [0.25, 0.5, 0.75, 1]) {
      const s = matchStars(m);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

// ---- 再訪案件（次フェーズ）まわり ----
// 「満了した案件は恒久的に出さない／しんらい70+で満了すると再訪版が解禁」を
// プールのフィルタで固定する。マスタの整合性もここで守る（typoは即テスト落ち）。

const baseTemplates = OFFER_TEMPLATES.filter((t) => !t.era && !t.revisitOf);
const revisitTemplates = OFFER_TEMPLATES.filter((t) => t.revisitOf);

describe("completedTrustMap", () => {
  it("offerIdの先頭要素でテンプレIDにまとめる", () => {
    const m = completedTrustMap([
      { offerId: "web-saas:2026-08-01:0", trust: 72 },
      { offerId: "fin-core:2026-08-10:2", trust: 55 },
    ]);
    expect(m.get("web-saas")).toBe(72);
    expect(m.get("fin-core")).toBe(55);
    expect(m.size).toBe(2);
  });

  it("同じテンプレを複数回満了していたら最大値を採用する", () => {
    const m = completedTrustMap([
      { offerId: "web-saas:2026-08-01:0", trust: 60 },
      { offerId: "web-saas:2026-08-20:1", trust: 85 },
    ]);
    expect(m.get("web-saas")).toBe(85);
  });
});

describe("availableTemplates", () => {
  it("履歴なしなら基礎案件のみ（再訪・きおくは出ない）", () => {
    const pool = availableTemplates(new Map());
    expect(pool).toEqual(baseTemplates);
  });

  it("満了した基礎案件は恒久的に消える", () => {
    const pool = availableTemplates(new Map([["web-saas", 50]]));
    expect(pool.some((t) => t.id === "web-saas")).toBe(false);
  });

  it("しんらいが閾値未満の満了では再訪は解禁されない", () => {
    const pool = availableTemplates(
      new Map([["web-saas", GENBA.REVISIT_TRUST - 1]])
    );
    expect(pool.some((t) => t.id === "web-saas-rv")).toBe(false);
  });

  it("しんらい閾値以上の満了で再訪が解禁される", () => {
    const pool = availableTemplates(new Map([["web-saas", GENBA.REVISIT_TRUST]]));
    expect(pool.some((t) => t.id === "web-saas-rv")).toBe(true);
    expect(pool.some((t) => t.id === "web-saas")).toBe(false);
  });

  it("再訪も満了すれば消える（系列完結）", () => {
    const pool = availableTemplates(
      new Map([
        ["web-saas", 90],
        ["web-saas-rv", 90],
      ])
    );
    expect(pool.some((t) => t.id === "web-saas")).toBe(false);
    expect(pool.some((t) => t.id === "web-saas-rv")).toBe(false);
  });

  it("全案件を満了するとプールは空になる（クラッシュしない）", () => {
    const all = new Map(
      [...baseTemplates, ...revisitTemplates].map((t) => [t.id, 90] as const)
    );
    expect(availableTemplates(all)).toEqual([]);
    expect(offersForDay("user-x", "2026-08-29", 0, all)).toEqual([]);
  });
});

describe("offersForDay / resolveOffer（満了履歴つき）", () => {
  const empty = new Map<string, number>();

  it("同じ入力なら同じ提示（決定的）。Mapの挿入順にも依らない", () => {
    const m1 = new Map([
      ["web-saas", 80],
      ["fin-core", 40],
    ]);
    const m2 = new Map([
      ["fin-core", 40],
      ["web-saas", 80],
    ]);
    const a = offersForDay("user-a", "2026-08-29", 30, m1);
    expect(offersForDay("user-a", "2026-08-29", 30, m2)).toEqual(a);
  });

  it("満了済みテンプレの古いofferIdはresolveOfferで弾かれる", () => {
    const before = offersForDay("user-a", "2026-08-29", 0, empty);
    const target = before[0];
    const done = new Map([[target.id, 90]]);
    expect(
      resolveOffer("user-a", "2026-08-29", 0, done, target.offerId)
    ).toBeNull();
  });
});

describe("再訪テンプレのマスタ整合性", () => {
  it("revisitOfは実在する基礎案件（非era・非再訪）を指す", () => {
    const baseIds = new Set(baseTemplates.map((t) => t.id));
    for (const rv of revisitTemplates) {
      expect(baseIds.has(rv.revisitOf!)).toBe(true);
    }
  });

  it("基礎案件それぞれに再訪がちょうど1件ある", () => {
    for (const base of baseTemplates) {
      const rvs = revisitTemplates.filter((t) => t.revisitOf === base.id);
      expect(rvs.length).toBe(1);
    }
  });

  it("idは全テンプレで一意", () => {
    const ids = OFFER_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("再訪はeraを持たず、スキル要件があり、clientは基礎と同じ現場", () => {
    for (const rv of revisitTemplates) {
      const base = OFFER_TEMPLATES.find((t) => t.id === rv.revisitOf)!;
      expect(rv.era).toBeUndefined();
      expect(rv.skills.length).toBeGreaterThan(0);
      expect(rv.client).toBe(base.client);
      expect(rv.theme).toBe(base.theme);
      expect([10, 15, 20]).toContain(rv.days);
      expect(rv.rate).toBeGreaterThan(base.rate);
    }
  });
});
