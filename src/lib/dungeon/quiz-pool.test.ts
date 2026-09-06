import { describe, expect, it } from "vitest";
import { pickQuestion, pickRiddle, difficultyOf, wantedDifficulty, type Candidate } from "./quiz-pool";
import { RIDDLES } from "./riddles";

function c(over: Partial<Candidate> & { id: string }): Candidate {
  return {
    topic: "SQL",
    prompt: "?",
    choices: ["a", "b", "c", "d"],
    rating: -1,
    accuracy: null,
    attempted: false,
    due: false,
    ...over,
  };
}
const rng = () => 0.5;

describe("pickQuestion（出題の順位）", () => {
  it("復習の期限が来ている問題を最優先で出す（再戦）", () => {
    const picked = pickQuestion({
      candidates: [c({ id: "fresh-sql" }), c({ id: "due", attempted: true, due: true, topic: "HTTP" })],
      topics: ["SQL"],
      depth: 5,
      charging: false,
      askedIds: [],
      rng,
    });
    expect(picked?.id).toBe("due");
  });

  it("次に得意領域に合う未解答問題（ゆるい包含で照合）", () => {
    const picked = pickQuestion({
      candidates: [c({ id: "http", topic: "HTTP" }), c({ id: "iam", topic: "AWS IAM" })],
      topics: ["AWS"],
      depth: 5,
      charging: false,
      askedIds: [],
      rng,
    });
    expect(picked?.id).toBe("iam");
  });

  it("領域に合う問題が無ければ、その他の未解答 → 解答済み の順", () => {
    const picked = pickQuestion({
      candidates: [c({ id: "done", attempted: true }), c({ id: "other", topic: "Git" })],
      topics: ["HTTP"],
      depth: 5,
      charging: false,
      askedIds: [],
      rng,
    });
    expect(picked?.id).toBe("other");
  });

  it("同じ潜行で出した問題は二度出さない。候補が尽きたら null", () => {
    const picked = pickQuestion({
      candidates: [c({ id: "a" })],
      topics: [],
      depth: 1,
      charging: false,
      askedIds: ["a"],
      rng,
    });
    expect(picked).toBeNull();
  });

  it("ボスが「ためている」ときは難問（正答率の低い問題）を選ぶ", () => {
    const picked = pickQuestion({
      candidates: [c({ id: "easy", accuracy: 0.9 }), c({ id: "hard", accuracy: 0.2 })],
      topics: ["SQL"],
      depth: 5,
      charging: true,
      askedIds: [],
      rng: () => 0, // 上位から先頭を取る
    });
    expect(picked?.id).toBe("hard");
  });
});

describe("難易度", () => {
  it("正答率から3段階に分ける。解答が無ければ ふつう", () => {
    expect(difficultyOf(null)).toBe(2);
    expect(difficultyOf(0.9)).toBe(1);
    expect(difficultyOf(0.5)).toBe(2);
    expect(difficultyOf(0.1)).toBe(3);
  });
  it("深いほど難しく、ためる後は常に難問", () => {
    expect(wantedDifficulty(1, false)).toBe(1);
    expect(wantedDifficulty(5, false)).toBe(2);
    expect(wantedDifficulty(9, false)).toBe(3);
    expect(wantedDifficulty(1, true)).toBe(3);
  });
});

describe("pickRiddle / riddles マスタ", () => {
  it("領域に合う ○× を優先し、出し尽くしたら全体から出す", () => {
    const r = pickRiddle({ topics: ["Git"], askedIds: [], rng });
    expect(r?.topics).toContain("Git");
    const all = RIDDLES.map((x) => `riddle:${x.id}`);
    expect(pickRiddle({ topics: ["Git"], askedIds: all, rng })).not.toBeNull();
  });

  it("id は一意で、○と×が偏っていない", () => {
    const ids = RIDDLES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const yes = RIDDLES.filter((r) => r.answer).length;
    expect(Math.abs(yes - (RIDDLES.length - yes))).toBeLessThanOrEqual(RIDDLES.length * 0.2);
  });
});
