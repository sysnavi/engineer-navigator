import { describe, it, expect } from "vitest";
import {
  CERTIFICATIONS,
  allCertTopics,
  countTopic,
  expandTopic,
} from "./certifications";

describe("topicAliases", () => {
  it("エイリアスは他の章のtopicと衝突しない（衝突すると件数が二重計上になる）", () => {
    const canonical = new Set(allCertTopics());
    for (const c of CERTIFICATIONS) {
      for (const ch of c.chapters) {
        for (const a of ch.topicAliases ?? []) {
          expect(canonical.has(a), `${ch.id} のエイリアス "${a}"`).toBe(false);
        }
      }
    }
  });

  it("同じエイリアスを同じ章に重複して書いていない", () => {
    for (const c of CERTIFICATIONS) {
      for (const ch of c.chapters) {
        const as = ch.topicAliases ?? [];
        expect(new Set(as).size, `${ch.id}`).toBe(as.length);
      }
    }
  });
});

describe("expandTopic", () => {
  it("エイリアスを持つお題は正+エイリアスを返す", () => {
    const got = expandTopic("情報セキュリティ基礎");
    expect(got).toContain("情報セキュリティ基礎");
    expect(got).toContain("セキュリティ");
  });

  it("先頭は必ず正のtopic", () => {
    expect(expandTopic("ネットワーク基礎")[0]).toBe("ネットワーク基礎");
  });

  it("複数の資格に出るお題はエイリアスが和集合になる", () => {
    // "ネットワーク基礎" はITパスポートと基本情報の両方にある
    const got = expandTopic("ネットワーク基礎");
    expect(got).toContain("ネットワーク");
    expect(got).toContain("TCP/IP");
  });

  it("エイリアスを持たないお題は自分自身だけ", () => {
    expect(expandTopic("AWS IAM")).toEqual(["AWS IAM"]);
  });

  it("カタログ外のお題はそのまま返す（呼び出し側で分岐しなくてよい）", () => {
    expect(expandTopic("エクセル関数")).toEqual(["エクセル関数"]);
  });
});

describe("countTopic", () => {
  it("エイリアス分を合算する", () => {
    const counts = new Map([
      ["情報セキュリティ基礎", 1],
      ["セキュリティ", 5],
      ["無関係なお題", 99],
    ]);
    expect(countTopic("情報セキュリティ基礎", counts)).toBe(6);
  });

  it("件数が無いお題は0", () => {
    expect(countTopic("AWS IAM", new Map())).toBe(0);
  });
});
