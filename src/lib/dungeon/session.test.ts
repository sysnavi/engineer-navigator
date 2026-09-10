import { describe, expect, it } from "vitest";
import {
  askQuestion,
  createDiveState,
  doAnswer,
  doChoice,
  doMove,
  doNext,
  enterFloor,
  needsQuestion,
  resolveCell,
  DESCEND_DEPTH,
  MAX_FLOORS,
  type DiveState,
} from "./session";
import { cellKey, findEvent, DIRS, type Facing } from "./map";

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/** 迷路の入った探索中の状態 */
function exploring(over: Partial<DiveState> = {}, seed = 1): DiveState {
  return { ...enterFloor(baseState(over), seeded(seed)), ...over, phase: "EXPLORE" } as DiveState;
}

/** (x,y) から目的地まで迷路を歩く（最短経路・テスト用） */
function walkTo(st: DiveState, tx: number, ty: number, rng: () => number): DiveState {
  const m = st.map!;
  const prev = new Map<string, [number, number, Facing]>();
  const q: [number, number][] = [[m.x, m.y]];
  prev.set(cellKey(m.x, m.y), [-1, -1, 0]);
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === tx && y === ty) break;
    DIRS.forEach(([dx, dy], i) => {
      const nx = x + dx;
      const ny = y + dy;
      if (m.cells[ny]?.[nx] === "." && !prev.has(cellKey(nx, ny))) {
        prev.set(cellKey(nx, ny), [x, y, i as Facing]);
        q.push([nx, ny]);
      }
    });
  }
  const dirs: Facing[] = [];
  let cur: [number, number] = [tx, ty];
  while (!(cur[0] === m.x && cur[1] === m.y)) {
    const p = prev.get(cellKey(cur[0], cur[1]))!;
    dirs.unshift(p[2]);
    cur = [p[0], p[1]];
  }
  let s = st;
  for (const d of dirs) {
    s = doMove(s, { dir: d, facing: d }, rng);
    if (s.phase !== "EXPLORE") break;
  }
  return s;
}

describe("enterFloor（階に入る）", () => {
  it("迷路が生成され、探索（EXPLORE）に入る", () => {
    const st = enterFloor(baseState(), seeded(1));
    expect(st.phase).toBe("EXPLORE");
    expect(st.floor).toBe(1);
    expect(st.map).not.toBeNull();
    expect(st.map!.x).toBe(1);
    expect(st.logs.length).toBeGreaterThan(0);
  });

  it("深度が足りていればボスが階段の前に立つ（rng=0 は必ず当たる）", () => {
    const st = enterFloor(baseState({ depth: 6 }), () => 0);
    expect(Object.values(st.map!.events)).toContain("BOSS");
  });

  it("ボス撃破後は二度目のボスを出さない（探索を続けても再戦にならない）", () => {
    const st = enterFloor(baseState({ depth: 6, bossDefeated: true }), () => 0);
    expect(Object.values(st.map!.events)).not.toContain("BOSS");
  });
});

describe("doMove（迷路を歩く）", () => {
  it("壁に向かって進んでも位置は変わらず「壁だ。」と出る。向きだけ変わる", () => {
    const st = exploring();
    // (1,1) の北 (1,0) は外周の壁
    const after = doMove(st, { dir: 0, facing: 0 }, seeded(2));
    expect(after.map!.x).toBe(1);
    expect(after.map!.y).toBe(1);
    expect(after.map!.facing).toBe(0);
    expect(after.logs[0].text).toBe("壁だ。");
    expect(after.phase).toBe("EXPLORE");
  });

  it("通路に進むと位置が変わり、見た場所（seen）が増える", () => {
    const st = exploring();
    const m = st.map!;
    const dir = (m.cells[1][2] === "." ? 1 : 2) as Facing;
    const after = doMove(st, { dir, facing: dir }, seeded(2));
    expect(after.map!.x + after.map!.y).toBe(3);
    expect(after.map!.seen.length).toBeGreaterThan(m.seen.length);
  });

  it("何も無いマスは基本だまって歩く（一言はたまにだけ・同じ文は続かない）", () => {
    const st = exploring();
    const m = st.map!;
    const dir = (m.cells[1][2] === "." ? 1 : 2) as Facing;
    const clean = { ...st, map: { ...m, events: {} } };
    const quiet = doMove(clean, { dir, facing: dir }, () => 0.99);
    expect(quiet.logs).toEqual([]);
    const talk = doMove({ ...clean, lastStroll: 0 }, { dir, facing: dir }, () => 0);
    expect(talk.logs.length).toBe(1);
    expect(talk.lastStroll).not.toBe(0);
  });

  it("探索中でなければ何も起きない", () => {
    const st = exploring({ phase: "EVENT" } as Partial<DiveState>);
    expect(doMove({ ...st, phase: "EVENT" }, { dir: 1, facing: 1 }, seeded(2))).toEqual({ ...st, phase: "EVENT" });
  });

  it("階段のマスに入ると CHOICE になり、階段は消えない", () => {
    let st = exploring({}, 3);
    const [sx, sy] = st.map!.stairs;
    // 途中のイベントを踏まないよう、階段以外のイベントを消しておく
    st = { ...st, map: { ...st.map!, events: { [cellKey(sx, sy)]: "STAIRS" } } };
    const at = walkTo(st, sx, sy, seeded(4));
    expect(at.phase).toBe("CHOICE");
    expect(findEvent(at.map!, sx, sy)).toBe("STAIRS");
  });

  it("イベントのマスに入ると解決され、そのマスのイベントは消える", () => {
    let st = exploring({}, 5);
    const entry = Object.entries(st.map!.events).find(([, k]) => k === "TREASURE")!;
    const [tx, ty] = entry[0].split(",").map(Number);
    st = { ...st, map: { ...st.map!, events: { [entry[0]]: "TREASURE" } } };
    const at = walkTo(st, tx, ty, () => 0.99); // ミミックにならない乱数
    expect(at.phase).toBe("EVENT");
    expect(at.gotGadgets.length).toBe(1);
    expect(findEvent(at.map!, tx, ty)).toBeUndefined();
  });
});

describe("resolveCell（マスのイベント）", () => {
  it("遭遇は BATTLE に入り、浅い階なら ○×高速ラウンドになることがある", () => {
    const st = resolveCell(exploring({ depth: 2 }), "ENCOUNTER", () => 0);
    expect(st.phase).toBe("BATTLE");
    expect(st.foe?.rapid).toBe(true);
    const deep = resolveCell(exploring({ depth: 8 }), "ENCOUNTER", () => 0);
    expect(deep.foe?.rapid ?? false).toBe(false);
  });

  it("同じ敵は続けて出ない", () => {
    const a = resolveCell(exploring({ depth: 2 }), "ENCOUNTER", () => 0);
    const b = resolveCell({ ...exploring({ depth: 2 }), lastFoeId: a.foe!.id }, "ENCOUNTER", () => 0);
    expect(b.foe!.id).not.toBe(a.foe!.id);
  });

  it("ボスは boss=true の敵として出る", () => {
    const st = resolveCell(exploring({ depth: 6 }), "BOSS", () => 0.5);
    expect(st.foe?.boss).toBe(true);
  });

  it("休憩はHPを回復して EVENT", () => {
    const st = resolveCell(exploring({ hp: 40 }), "REST", () => 0.5);
    expect(st.hp).toBeGreaterThan(40);
    expect(st.phase).toBe("EVENT");
  });
});

describe("doNext / doChoice", () => {
  it("イベントを読み終えたら探索に戻る（ボス撃破後も終わらない）", () => {
    const st = doNext(exploring({ bossDefeated: true, phase: "EVENT" } as Partial<DiveState>));
    expect(st.phase).toBe("EXPLORE");
    expect(st.ending).toBeNull();
  });

  it("階段で降りると floor+1・depth+2 で新しい迷路に入る", () => {
    const st = doChoice({ ...exploring({}, 1), phase: "CHOICE" }, "descend", seeded(6));
    expect(st.floor).toBe(2);
    expect(st.depth).toBe(5 + DESCEND_DEPTH);
    expect(st.phase).toBe("EXPLORE");
    expect(st.map!.x).toBe(1);
  });

  it("最終階で降りようとすると終了。ボス未撃破なら limit、撃破済みなら cleared", () => {
    const lim = doChoice({ ...exploring({ floor: MAX_FLOORS }), phase: "CHOICE", floor: MAX_FLOORS }, "descend", seeded(1));
    expect(lim.phase).toBe("END");
    expect(lim.ending).toBe("limit");
    const clr = doChoice({ ...exploring({ floor: MAX_FLOORS, bossDefeated: true }), phase: "CHOICE", floor: MAX_FLOORS, bossDefeated: true }, "descend", seeded(1));
    expect(clr.ending).toBe("cleared");
    expect(clr.logs.length).toBeGreaterThan(0);
  });

  it("まだ探索する を選ぶと探索に戻る", () => {
    const st = doChoice({ ...exploring(), phase: "CHOICE" }, "stay", seeded(1));
    expect(st.phase).toBe("EXPLORE");
  });

  it("帰る は探索中いつでも選べて escaped。ボス撃破済みなら cleared（勲章は消えない）", () => {
    const escaped = doChoice(exploring(), "leave", () => 0.5);
    expect(escaped.phase).toBe("END");
    expect(escaped.ending).toBe("escaped");
    const cleared = doChoice(exploring({ bossDefeated: true }), "leave", () => 0.5);
    expect(cleared.ending).toBe("cleared");
    expect(cleared.logs.length).toBeGreaterThan(0);
  });

  it("戦闘中は帰れない", () => {
    const st = { ...exploring(), phase: "BATTLE" as const };
    expect(doChoice(st, "leave", () => 0.5).phase).toBe("BATTLE");
  });
});

describe("戦闘（問いに答えて倒す）", () => {
  const q = {
    source: "bank" as const,
    id: "q1",
    kind: "choice" as const,
    topic: "SQL",
    prompt: "?",
    choices: ["a", "b", "c", "d"],
    difficulty: 2 as const,
    askedAt: 0,
    hidden: [],
  };
  function inBattle(): DiveState {
    const st = exploring();
    return {
      ...st,
      phase: "BATTLE",
      foe: { id: "nullpo", name: "ヌルポ", sprite: "mon-nullpo", boss: false, hp: 30, maxHp: 30, atk: 8, def: 2 },
    };
  }

  it("遭遇直後は問いが無く、needsQuestion が真になる", () => {
    const st = inBattle();
    expect(needsQuestion(st)).toBe(true);
    const asked = askQuestion(st, q);
    expect(needsQuestion(asked)).toBe(false);
    expect(asked.askedIds).toEqual(["bank:q1"]);
  });

  it("正解すると敵が削れ、問いが片付いて次の問いが要る状態になる", () => {
    const st = doAnswer(askQuestion(inBattle(), q), { correct: true, elapsedMs: 99_999 }, () => 0.5);
    expect(st.foe?.hp).toBeLessThan(30);
    expect(st.hp).toBe(80);
    expect(needsQuestion(st)).toBe(true);
  });

  it("不正解だと解説が結果の直後に出る", () => {
    const st = doAnswer(askQuestion(inBattle(), q), { correct: false, elapsedMs: 0, note: "解説です" }, () => 0.5);
    expect(st.hp).toBeLessThan(80);
    expect(st.logs[1].text).toBe("解説です");
  });

  it("敗走しても盾があれば踏みとどまり、イベントとして探索に戻れる", () => {
    const st = { ...askQuestion(inBattle(), q), hp: 1, shieldLeft: 1 };
    const after = doAnswer(st, { correct: false, elapsedMs: 0 }, () => 0.5);
    expect(after.phase).toBe("EVENT");
    expect(after.shieldLeft).toBe(0);
    expect(after.hp).toBeGreaterThan(0);
    expect(doNext(after).phase).toBe("EXPLORE");
  });

  it("問いが載っていない戦闘では解答を受け付けない", () => {
    const st = inBattle();
    expect(doAnswer(st, { correct: true, elapsedMs: 0 }, () => 0.5)).toBe(st);
  });
});
