// ダンジョンのバランスをシミュレーションで確かめる（npx tsx scripts/sim-dungeon.ts）。
//
// 「1戦の勝率」ではなく「HP持ち越しで何階まで行けるか」で見る（handoff の決まり）。
// 問いの正誤は正答率 p のコイン投げで代用し、選択は単純方針:
//   - 難問（ためる後）は SP があればヒント、無ければ答える
//   - HP が 30% を切ったら どうぐ（あれば）
//   - 深く潜る／慎重の選択は「HP 50% 以上なら深く」。ボスを倒したら帰る。
//     HP が 30% を切って どうぐも無ければ引き返す（慎重な人）

import { heroStats } from "@/lib/dungeon/battle";
import {
  createDiveState,
  enterFloor,
  askQuestion,
  needsQuestion,
  doAnswer,
  doBattle,
  doChoice,
  doNext,
  finishDive,
  type DiveState,
} from "@/lib/dungeon/session";

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ask(st: DiveState, rng: () => number, hard: boolean): DiveState {
  const rapid = !!st.foe?.rapid;
  return askQuestion(st, {
    source: rapid ? "riddle" : "bank",
    id: `q${st.askedIds.length}`,
    kind: rapid ? "truefalse" : "choice",
    topic: "SQL",
    prompt: "?",
    choices: rapid ? ["○", "×"] : ["a", "b", "c", "d"],
    difficulty: hard ? 3 : 2,
    askedAt: 0,
    hidden: [],
  });
}

function dive(level: number, p: number, rng: () => number, fastRate: number) {
  const stats = heroStats({ level, generation: 1, gadgetRarities: [] });
  let st = createDiveState({
    baseDepth: Math.max(1, 1 + Math.floor(level / 2)), // baseDepthOf の第1世代相当
    stats,
    hasReportShield: false,
    firstDive: false,
    items: ["onigiri" as never],
  });
  st = enterFloor(st, rng);
  let guard = 0;
  let bossMet = false;
  while (st.phase !== "END" && guard++ < 500) {
    if (st.phase === "BATTLE" && st.foe) {
      if (st.foe.boss) bossMet = true;
      const hard = !!st.foe.charging;
      if (needsQuestion(st)) st = ask(st, rng, hard);
      const q = st.foe?.question;
      if (!q) break;
      if (st.hp < st.maxHp * 0.3 && st.items.length > 0) {
        st = doBattle(st, "item", rng);
        continue;
      }
      let pc = q.kind === "truefalse" ? Math.min(0.95, p + 0.15) : p;
      if (q.difficulty === 3) {
        pc = Math.max(0.1, p - 0.25);
        if (st.sp >= 3 && q.hidden.length === 0) {
          st = doBattle(st, "hint", rng, { hintHide: [1, 2] });
          continue;
        }
      }
      if (q.hidden.length > 0) pc = Math.min(0.95, pc + 0.3);
      st = doAnswer(st, { correct: rng() < pc, elapsedMs: rng() < fastRate ? 3000 : 20_000 }, rng);
    } else if (st.phase === "EVENT" || st.phase === "INTRO") {
      st = doNext(st);
    } else if (st.phase === "CHOICE") {
      // 慎重な人の方針: ボスを倒したら帰る／HPが3割を切って どうぐも無ければ帰る
      const tired = st.hp < st.maxHp * 0.3 && st.items.length === 0;
      st = doChoice(
        st,
        st.bossDefeated || tired ? "leave" : st.hp >= st.maxHp * 0.5 ? "deep" : "careful",
        rng
      );
    }
  }
  st = finishDive(st);
  return { st, bossMet };
}

const N = Number(process.argv[2] ?? 5000);
console.log(`各 ${N} 回 / 正答率 × Lv`);
console.log("p\tLv\t到達\t手ぶら\tボス遭遇\tボス撃破\t敗走");
for (const p of [0.4, 0.6, 0.8]) {
  for (const level of [1, 3, 8]) {
    const rng = mulberry(level * 1000 + p * 100);
    let depth = 0, empty = 0, met = 0, cleared = 0, defeated = 0;
    for (let i = 0; i < N; i++) {
      const { st, bossMet } = dive(level, p, rng, 0.3);
      depth += st.depth;
      if (st.gotGadgets.length + st.gotFoods.length === 0) empty++;
      if (bossMet) met++;
      if (st.bossDefeated) cleared++;
      if (st.ending === "defeated") defeated++;
    }
    const pct = (n: number) => `${((n / N) * 100).toFixed(1)}%`;
    const bossWin = met ? `${((cleared / met) * 100).toFixed(1)}%` : "-";
    console.log(`${p}\t${level}\tB${(depth / N).toFixed(1)}\t${pct(empty)}\t${pct(met)}\t${bossWin}\t${pct(defeated)}`);
  }
}
