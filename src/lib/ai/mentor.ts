import { prisma } from "@/lib/db";
import type { ChatMessage } from "./client";

// AIメンター（Phase 3）— 設計は docs/roadmap.md
// 「理論 → 現場システムでどう適用するか」を必ず具体例つきで返すのが心臓部。
// 相手の現在のスキルと週報の詰まりを踏まえてパーソナライズする。

export const MENTOR_SYSTEM = `あなたはSES企業の若手エンジニアを支える技術メンターです。資格学習や技術習得の相談に答えます。

## 回答のルール（厳守）
- 必ず2段構成で答える:
  ①【理論】要点を短く、噛み砕いて。
  ②【現場でどう使うか】実際のシステム開発・SESの現場で「どの場面で・どう使うか」の具体例を必ず添える。抽象論だけ・理論だけの回答は禁止。
- 専門用語は現場の言葉に翻訳して説明する。いきなり難しい用語で煙に巻かない。
- 相手の今のスキルレベルと、週報で詰まっていることを踏まえてパーソナライズする。相手が知っている技術に例える。
- 長すぎない。要点を絞る。
- 最後に必ず「次の一歩」を1行で示す（次に何を学ぶ／試すと良いか）。
- Markdownの見出し(##)や太字(**)は使ってよい。コード例は現場でよくある最小限のものを。`;

/** メンター用の個人コンテキスト（スキルと直近の詰まり） */
async function buildContext(userId: string): Promise<string> {
  const [skills, reports] = await Promise.all([
    prisma.engineerSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: { level: "desc" },
      take: 15,
    }),
    prisma.weeklyReport.findMany({
      where: { userId, status: "SUBMITTED", struggleText: { not: null } },
      orderBy: { weekStart: "desc" },
      take: 3,
      select: { struggleText: true, newText: true },
    }),
  ]);

  const skillLine = skills.length
    ? skills.map((s) => `${s.skill.name}(Lv${s.level})`).join(", ")
    : "（まだ登録なし）";
  const struggles = reports
    .map((r) => r.struggleText)
    .filter(Boolean)
    .join(" / ");

  return `## 相手のプロフィール（メンタリングの参考に。本人には言及しすぎない）
現在のスキル: ${skillLine}
最近の週報で詰まっていること: ${struggles || "（特に記載なし）"}`;
}

/** セッション履歴 + コンテキストからメンターへ渡すメッセージ列を組み立てる */
export async function buildMentorMessages(
  sessionId: string
): Promise<{ system: string; messages: ChatMessage[] }> {
  const session = await prisma.mentorSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const context = await buildContext(session.userId);
  const topicLine =
    session.topic || session.certification
      ? `\n\n## このセッションのテーマ\n${[session.certification, session.topic].filter(Boolean).join(" / ")}`
      : "";

  const messages: ChatMessage[] = session.messages.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));

  return { system: `${MENTOR_SYSTEM}\n\n${context}${topicLine}`, messages };
}
