import { prisma } from "@/lib/db";
import { domainsToLabels } from "@/lib/domains";
import type { ChatMessage } from "./client";
import { chatStanceBlock, toStance } from "./stance";

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
  const [user, skills, reports] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { targetDomains: true },
    }),
    prisma.engineerSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: { level: "desc" },
      take: 15,
    }),
    prisma.weeklyReport.findMany({
      where: { userId, status: "SUBMITTED" },
      orderBy: { weekStart: "desc" },
      take: 3,
      select: { struggleText: true, newText: true, shareText: true },
    }),
  ]);

  const skillLine = skills.length
    ? skills.map((s) => `${s.skill.name}(Lv${s.level})`).join(", ")
    : "（まだ登録なし）";
  const struggles = reports
    .map((r) => r.struggleText)
    .filter(Boolean)
    .join(" / ");
  // 週報の設問7「AIメンターへの共有・相談」— 本人からメンターに宛てた共有事項
  const shares = reports
    .map((r) => r.shareText)
    .filter(Boolean)
    .join(" / ");

  const goals = domainsToLabels(user.targetDomains);

  return `## 相手のプロフィール（メンタリングの参考に。本人には言及しすぎない）
現在のスキル: ${skillLine}
目指している技術領域: ${goals || "（未設定）"}
最近の週報で詰まっていること: ${struggles || "（特に記載なし）"}
週報でメンター宛てに共有されたこと: ${shares || "（特に記載なし）"}

※「次の一歩」は、可能な限り本人が目指している技術領域につながる提案にすること。`;
}

/** セッション履歴 + コンテキストからメンターへ渡すメッセージ列を組み立てる */
export async function buildMentorMessages(
  sessionId: string
): Promise<{ system: string; messages: ChatMessage[] }> {
  const session = await prisma.mentorSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      user: { select: { mentorStance: true } },
    },
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

  // 本人が選んだ接し方を反映（きびしめは1往復だけ問い返してから答える）
  const stanceBlock = chatStanceBlock(toStance(session.user.mentorStance));

  return {
    system: `${MENTOR_SYSTEM}${stanceBlock}\n\n${context}${topicLine}`,
    messages,
  };
}
