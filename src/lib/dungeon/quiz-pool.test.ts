import { describe, expect, it } from "vitest";
import {
  pickQuestion,
  pickRiddle,
  pickBattleQuestion,
  riddleAnswerIndex,
  difficultyOf,
  wantedDifficulty,
  type Candidate,
} from "./quiz-pool";
import { RIDDLES } from "./riddles";
import { MONSTERS } from "./content";
import { topicMatches } from "@/lib/quiz/attempt";

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

  it("同じ潜行で出した問題（askedIds は \"bank:<id>\" 形式）は二度出さない。候補が尽きたら null", () => {
    const picked = pickQuestion({
      candidates: [c({ id: "a" })],
      topics: [],
      depth: 1,
      charging: false,
      askedIds: ["bank:a"],
      rng,
    });
    expect(picked).toBeNull();
  });

  it("解答済みしか残っていなければ、直近の潜行で出していないものを先に出す", () => {
    const picked = pickQuestion({
      candidates: [c({ id: "seen", attempted: true }), c({ id: "old", attempted: true })],
      topics: [],
      depth: 1,
      charging: false,
      askedIds: [],
      recentIds: ["bank:seen"],
      rng,
    });
    expect(picked?.id).toBe("old");
  });

  it("tier を指定すると、その段階だけから選ぶ", () => {
    const candidates = [c({ id: "other", topic: "Git" })];
    const args = { candidates, topics: ["SQL"], depth: 1, charging: false, askedIds: [], rng };
    expect(pickQuestion({ ...args, tier: "primary" })).toBeNull();
    expect(pickQuestion({ ...args, tier: "secondary" })?.id).toBe("other");
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

describe("pickRiddle（TSマスタからの選定）", () => {
  const key = (r: { id: string }) => `riddle:${r.id}`;

  it("領域に合うものを優先し、出し尽くしたら全体から出す", () => {
    const r = pickRiddle({ topics: ["Git"], askedIds: [], rng });
    expect(r?.topics).toContain("Git");
    const all = RIDDLES.map(key);
    expect(pickRiddle({ topics: ["Git"], askedIds: all, rng })).not.toBeNull();
  });

  it("kind で ○× だけ／四択だけに絞れる", () => {
    for (let i = 0; i < 20; i++) {
      const seed = i / 20;
      expect(pickRiddle({ topics: ["SQL"], askedIds: [], kind: "truefalse", rng: () => seed })?.kind).toBe("truefalse");
      expect(pickRiddle({ topics: ["SQL"], askedIds: [], kind: "choice", rng: () => seed })?.kind).toBe("choice");
    }
  });

  it("直近の潜行で出した問いは後回し（他が残っていれば出さない）", () => {
    const git = RIDDLES.filter((r) => r.topics.includes("Git"));
    const recent = git.slice(1).map(key);
    // Git のうち recent でないのは git[0] だけ → 何度引いてもそれ
    for (let i = 0; i < 10; i++) {
      const r = pickRiddle({ topics: ["Git"], askedIds: [], recentIds: recent, rng: () => i / 10 });
      expect(r?.id).toBe(git[0].id);
    }
  });

  it("onTopicOnly は領域一致が無ければ null、freshOnly は新顔が無ければ null", () => {
    expect(pickRiddle({ topics: ["存在しない領域"], askedIds: [], onTopicOnly: true, rng })).toBeNull();
    const all = RIDDLES.map(key);
    expect(pickRiddle({ topics: ["Git"], askedIds: all, freshOnly: true, rng })).toBeNull();
    expect(pickRiddle({ topics: ["Git"], askedIds: [], recentIds: all, freshOnly: true, rng })).toBeNull();
    // 緩めれば出る
    expect(pickRiddle({ topics: ["Git"], askedIds: [], recentIds: all, rng })).not.toBeNull();
  });
});

describe("pickBattleQuestion（戦闘の出題順位）", () => {
  const base = { depth: 5, charging: false, askedIds: [], recentIds: [], rng, now: 0 };

  it("○×高速ラウンドはバンクを使わず、○× だけを出す", () => {
    const q = pickBattleQuestion({ ...base, rapid: true, candidates: [c({ id: "sql" })], topics: ["SQL"] });
    expect(q?.source).toBe("riddle");
    expect(q?.kind).toBe("truefalse");
  });

  it("領域に合う未解答のバンク問題があればそれ（TSマスタより先）", () => {
    const q = pickBattleQuestion({ ...base, rapid: false, candidates: [c({ id: "sql", topic: "SQL" })], topics: ["SQL"] });
    expect(q).toMatchObject({ source: "bank", id: "sql" });
  });

  it("復習期限の問題は領域が違っても最優先（再戦）", () => {
    const q = pickBattleQuestion({
      ...base,
      rapid: false,
      candidates: [c({ id: "due", topic: "Git", attempted: true, due: true })],
      topics: ["SQL"],
    });
    expect(q).toMatchObject({ source: "bank", id: "due" });
  });

  it("バンクに領域の問題が無ければ、その他のバンクより先に領域一致の TSマスタを出す（敵の個性）", () => {
    const q = pickBattleQuestion({ ...base, rapid: false, candidates: [c({ id: "git", topic: "Git" })], topics: ["SQL"] });
    expect(q?.source).toBe("riddle");
    expect(q?.topic).toBe("SQL");
  });

  it("領域一致の TSマスタを出し尽くしていれば、その他のバンクに落ちる", () => {
    const recent = RIDDLES.filter((r) => r.topics.includes("SQL")).map((r) => `riddle:${r.id}`);
    const q = pickBattleQuestion({
      ...base,
      rapid: false,
      recentIds: recent,
      candidates: [c({ id: "git", topic: "Git" })],
      topics: ["SQL"],
    });
    expect(q).toMatchObject({ source: "bank", id: "git" });
  });

  it("何も無くても TSマスタで成立する（四択も混ざる）", () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const q = pickBattleQuestion({ ...base, rapid: false, candidates: [], topics: ["Docker"], rng: () => i / 40 });
      expect(q?.source).toBe("riddle");
      kinds.add(q!.kind);
    }
    expect(kinds).toEqual(new Set(["truefalse", "choice"]));
  });

  it("同じ潜行で出した TSマスタの問いは二度出さない", () => {
    const asked: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const q = pickBattleQuestion({ ...base, rapid: true, candidates: [], topics: ["Git"], askedIds: asked, rng: () => 0.37 });
      expect(seen.has(q!.id)).toBe(false);
      seen.add(q!.id);
      asked.push(`riddle:${q!.id}`);
    }
  });
});

describe("riddles マスタの健全性", () => {
  const tf = RIDDLES.filter((r) => r.kind === "truefalse");
  const mc = RIDDLES.filter((r) => r.kind === "choice");

  it("id は ○× と四択を通して一意", () => {
    const ids = RIDDLES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("○と×が偏っていない", () => {
    const yes = tf.filter((r) => r.kind === "truefalse" && r.answer).length;
    expect(Math.abs(yes - (tf.length - yes))).toBeLessThanOrEqual(tf.length * 0.2);
  });

  it("四択は選択肢4つ・正解は範囲内・重複なし。正解の位置が偏っていない（いつもB にしない）", () => {
    const hist = [0, 0, 0, 0];
    for (const r of mc) {
      if (r.kind !== "choice") continue;
      expect(r.choices).toHaveLength(4);
      expect(new Set(r.choices).size).toBe(4);
      expect(r.answerIndex).toBeGreaterThanOrEqual(0);
      expect(r.answerIndex).toBeLessThan(4);
      expect(riddleAnswerIndex(r)).toBe(r.answerIndex);
      hist[r.answerIndex]++;
    }
    expect(Math.max(...hist)).toBeLessThanOrEqual(mc.length * 0.4);
  });

  it("どのモンスターにも得意領域の問題が十分にある（○× 20問以上・四択 10問以上）", () => {
    for (const m of MONSTERS.filter((m) => !m.retired)) {
      const on = (r: { topics: string[] }) => r.topics.some((rt) => m.topics.some((t) => topicMatches(t, rt)));
      expect(tf.filter(on).length, `${m.id} の ○×`).toBeGreaterThanOrEqual(20);
      expect(mc.filter(on).length, `${m.id} の 四択`).toBeGreaterThanOrEqual(10);
    }
  });
});
