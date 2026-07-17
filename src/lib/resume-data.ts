import { prisma } from "@/lib/db";

// 経歴書のデータ組み立て。/resume（画面）と /api/resume/pdf（PDF出力）で共有する。

export const CATEGORY_LABELS: Record<string, string> = {
  LANGUAGE: "言語",
  FRAMEWORK: "フレームワーク",
  CLOUD: "クラウド",
  DATABASE: "データベース",
  AI: "AI",
  TOOL: "ツール",
  PROCESS: "工程",
  SOFT: "ソフトスキル",
  OTHER: "その他",
};

export const LEVEL_DEFS: Record<number, string> = {
  1: "学習中",
  2: "指導のもとで実務可能",
  3: "一人で実務可能",
  4: "本番リリース経験・指導可能",
  5: "設計判断・技術選定をリード",
};

export function fmtMonth(d: Date | null): string {
  if (!d) return "現在";
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type RoleplayStat = {
  title: string;
  count: number;
  bestScore: number | null;
  lastAt: Date;
};

export async function loadResumeData(userId: string) {
  const [skills, experiences, assignments, roleplays] = await Promise.all([
    prisma.engineerSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: [{ level: "desc" }],
    }),
    prisma.skillSuggestion.findMany({
      where: { userId, status: "APPROVED", kind: "EXPERIENCE" },
      include: { sourceReport: true },
      orderBy: { decidedAt: "desc" },
    }),
    prisma.assignment.findMany({
      where: { userId },
      include: { project: true },
      orderBy: { startedAt: "desc" },
    }),
    // 完了したロールプレイ演習は、リーダーシップのエビデンスとして経歴書に載せる
    prisma.roleplaySession.findMany({
      where: { userId, status: "COMPLETED" },
      include: { scenario: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // 演習をシナリオ別に集計（回数と最高スコア）
  const statMap = new Map<string, RoleplayStat>();
  for (const r of roleplays) {
    let score: number | null = null;
    try {
      score = r.feedback ? (JSON.parse(r.feedback).score as number) : null;
    } catch {
      score = null;
    }
    const cur = statMap.get(r.scenario.title);
    if (cur) {
      cur.count += 1;
      if (score != null && (cur.bestScore == null || score > cur.bestScore)) {
        cur.bestScore = score;
      }
    } else {
      statMap.set(r.scenario.title, {
        title: r.scenario.title,
        count: 1,
        bestScore: score,
        lastAt: r.createdAt,
      });
    }
  }

  const byCategory = new Map<string, typeof skills>();
  for (const s of skills) {
    const list = byCategory.get(s.skill.category) ?? [];
    list.push(s);
    byCategory.set(s.skill.category, list);
  }

  const today = new Date();
  const updated = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  return {
    skills,
    experiences,
    assignments,
    roleplays,
    roleplayList: [...statMap.values()],
    byCategory,
    updated,
  };
}

export type ResumeData = Awaited<ReturnType<typeof loadResumeData>>;
