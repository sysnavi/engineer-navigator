// ペットとの会話に渡す「きみの一週間」。
//
// この機能の肝はここ。汎用チャットボットと決定的に違うのは、
// **その子が週報・スキル・ダンジョンの戦果・なつき度・前回の会話を知っている**こと。
// 「AIが喋る」のではなく「きみを見てきた子が喋る」状態をデータで作る。
//
// プライバシー: コンディション（気分・稼働）は本人しか見られない値。ここでは
// 本人との会話にしか使わず、粗いラベルに畳んでから渡す（生スコアは渡さない）。

import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";

/** 会話に渡す文脈。文字列に組み立てる直前の素材 */
export type TalkContext = {
  petName: string;
  affection: number;
  /** 仲良し度合いの言葉（であいたて/なかよし/しんゆう/かぞく） */
  tier: string;
  daysTogether: number;
  /** 直近の週報から拾えたこと（2週間なにも出していなければ null） */
  week: {
    did: string | null;
    tried: string | null;
    struggle: string | null;
    next: string | null;
    /** ☀️🌤☁️🌧 の言葉 */
    condition: string | null;
    /** 稼働の言葉 */
    workload: string | null;
    /** 今週のものか（false=先週の週報。週の前半は必ずこちらになる） */
    isThisWeek: boolean;
  } | null;
  /** 直近に承認したスキル（新しい順・最大3件） */
  recentSkills: string[];
  /** 直近のダンジョン（最深到達階・7日以内の回数） */
  dungeon: { deepest: number; runs: number } | null;
  /** この子が覚えていること（新しい順・最大6件） */
  memories: string[];
  /** 最後に会話した日からの経過日数（初回は null） */
  daysSinceTalk: number | null;
};

const TIERS: [number, string][] = [
  [15, "かぞく"],
  [7, "しんゆう"],
  [3, "なかよし"],
  [0, "であいたて"],
];
export function affectionTier(a: number): string {
  return (TIERS.find(([n]) => a >= n) ?? TIERS[TIERS.length - 1])[1];
}

const COND_WORD = ["", "つらそう", "すこし おつかれ", "ふつう", "げんき"];
const LOAD_WORD = ["", "限界がちかい", "いそがしい", "ふつう", "よゆうあり"];

const MEMORY_KEEP = 6; // 会話に持ち込む記憶の数（プロンプト肥大を防ぐ）

export async function loadTalkContext(
  userId: string,
  petId: string
): Promise<TalkContext | null> {
  const pet = await prisma.pet.findUnique({ where: { id: petId } });
  if (!pet || pet.userId !== userId) return null;

  const weekStart = mondayOf(new Date());
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  // 週の前半は今週ぶんがまだ無いのが普通なので、直近2週間の最新を見る。
  // 「今週のを出していないから何も知らない子」にしないための保険。
  const reportSince = new Date(weekStart.getTime() - 14 * 24 * 60 * 60_000);

  const [report, skills, runs, memories, lastTalk] = await Promise.all([
    prisma.weeklyReport.findFirst({
      where: { userId, status: "SUBMITTED", weekStart: { gte: reportSince } },
      orderBy: { weekStart: "desc" },
    }),
    prisma.engineerSkill.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { skill: { select: { name: true } } },
    }),
    prisma.dungeonRun.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { depth: true },
    }),
    prisma.petMemory.findMany({
      where: { petId },
      orderBy: { createdAt: "desc" },
      take: MEMORY_KEEP,
      select: { text: true },
    }),
    // 直近の会話（AiUsageのkindで判定。会話専用のタグを使う）
    prisma.aiUsage.findFirst({
      where: { userId, kind: PET_TALK_KIND, blocked: false },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const submitted = report;
  const day = 24 * 60 * 60_000;

  return {
    petName: pet.name,
    affection: pet.affection,
    tier: affectionTier(pet.affection),
    daysTogether: Math.max(
      0,
      Math.floor((Date.now() - pet.befriendedAt.getTime()) / day)
    ),
    week: submitted
      ? {
          did: submitted.didText?.trim() || null,
          tried: submitted.newText?.trim() || null,
          struggle: submitted.struggleText?.trim() || null,
          next: submitted.nextText?.trim() || null,
          condition: submitted.conditionSelf
            ? COND_WORD[submitted.conditionSelf] ?? null
            : null,
          workload: submitted.workloadSelf
            ? LOAD_WORD[submitted.workloadSelf] ?? null
            : null,
          isThisWeek: submitted.weekStart.getTime() >= weekStart.getTime(),
        }
      : null,
    recentSkills: skills.map((s) => s.skill.name),
    dungeon: runs.length
      ? { deepest: Math.max(...runs.map((r) => r.depth)), runs: runs.length }
      : null,
    memories: memories.map((m) => m.text),
    daysSinceTalk: lastTalk
      ? Math.floor((Date.now() - lastTalk.createdAt.getTime()) / day)
      : null,
  };
}

/** AiUsage に記録する会話のタグ（回数制限と「前回いつ話したか」の判定に使う） */
export const PET_TALK_KIND = "pet-chat";

/** 文脈をAIに渡す1つのテキストに組み立てる。空の項目は行ごと出さない */
export function renderTalkContext(c: TalkContext): string {
  const lines: string[] = [
    `あなたの名前: ${c.petName}`,
    `飼い主との関係: ${c.tier}（なつき度${c.affection}・出会って${c.daysTogether}日）`,
  ];
  if (c.daysSinceTalk != null && c.daysSinceTalk >= 2) {
    lines.push(`前に話してから${c.daysSinceTalk}日あいている。`);
  }

  if (c.week) {
    const w = c.week;
    lines.push(
      w.isThisWeek
        ? "## 飼い主の今週（本人が書いた週報より）"
        : "## 飼い主の先週（本人が書いた週報より。今週ぶんはまだ）"
    );
    if (w.did) lines.push(`- やったこと: ${w.did.slice(0, 300)}`);
    if (w.tried) lines.push(`- 新しく触れたこと: ${w.tried.slice(0, 200)}`);
    if (w.struggle) lines.push(`- 詰まったこと: ${w.struggle.slice(0, 300)}`);
    if (w.next) lines.push(`- 来週やること: ${w.next.slice(0, 200)}`);
    if (w.condition) lines.push(`- 気分: ${w.condition}`);
    if (w.workload) lines.push(`- 忙しさ: ${w.workload}`);
  } else {
    lines.push("## 飼い主の今週: まだ週報を書いていない（責めないこと）");
  }

  if (c.recentSkills.length) {
    lines.push(`## さいきん伸ばしたスキル: ${c.recentSkills.join("・")}`);
  }
  if (c.dungeon) {
    lines.push(
      `## ダンジョン（この1週間）: ${c.dungeon.runs}回もぐって、いちばん深いのは地下${c.dungeon.deepest}階`
    );
  }
  if (c.memories.length) {
    lines.push("## あなたが覚えていること（前の会話から）");
    for (const m of c.memories) lines.push(`- ${m}`);
  }
  return lines.join("\n");
}
