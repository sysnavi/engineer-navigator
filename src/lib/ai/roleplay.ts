import { prisma } from "@/lib/db";
import { chatStream, completeJson, type ChatMessage } from "./client";

// 役割シミュレーター（Phase 4）— AIが顧客役/上長役/後輩役を演じ、
// 終了後に職務定義書ベースの観点(objectives)で自動フィードバックする。

function personaSystem(persona: string): string {
  return `あなたはロールプレイの相手役です。次の役になりきってください。

${persona}

## 演じ方のルール
- 完全に役になりきり、相手（エンジニア）の対応に自然に反応する。
- 1回の発言は簡潔に（2〜4文）。長い演説はしない。
- 指導・解説・メタな説明はしない。あなたは相手役であって講師ではない。
- 相手の対応の良し悪しで、あなたの態度（強硬/軟化/前向き/後ろ向き）が自然に変わる。
- 会話が続くよう、問いかけや反応で相手にボールを返す。`;
}

/** ロールプレイの相手役メッセージ列を組み立てる */
export async function buildRoleplayMessages(
  sessionId: string
): Promise<{ system: string; messages: ChatMessage[] }> {
  const session = await prisma.roleplaySession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      scenario: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  // ロールプレイでは USER=エンジニア=user、ASSISTANT=AIの相手役=assistant
  const messages: ChatMessage[] = session.messages.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));
  return { system: personaSystem(session.scenario.persona), messages };
}

/** セッション開始時に相手役が口火を切る一言を生成する */
export async function generateOpeningLine(scenarioId: string): Promise<string> {
  const scenario = await prisma.roleplayScenario.findUniqueOrThrow({
    where: { id: scenarioId },
  });
  const { text } = await chatStream({
    system: personaSystem(scenario.persona),
    messages: [
      {
        role: "user",
        content:
          "（ロールプレイ開始。あなたから場面の口火を切ってください。状況に合った短い第一声を、役になりきって話してください）",
      },
    ],
    maxTokens: 300,
    onToken: () => {},
  });
  return text;
}

export type FeedbackResult = {
  perObjective: { objective: string; good: string; improve: string }[];
  overall: string;
  advice: string;
  score: number;
};

/** 会話全体を objectives に照らして評価する */
export async function generateFeedback(
  sessionId: string
): Promise<FeedbackResult> {
  const session = await prisma.roleplaySession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { scenario: true, messages: { orderBy: { createdAt: "asc" } } },
  });

  const objectives = (session.scenario.objectives as string[]) ?? [];
  const transcript = session.messages
    .map(
      (m) => `${m.role === "USER" ? "エンジニア" : "相手役"}: ${m.content}`
    )
    .join("\n");

  const { data } = await completeJson<FeedbackResult>({
    system: `あなたはSES企業のリーダー育成の評価者です。ロールプレイ演習の会話を、リーダー職務定義書に基づく評価観点に照らして採点します。
## ルール
- 各観点について good(できていた点) と improve(改善点) を1〜2文ずつ。会話の具体的な発言に触れる。
- overall(総評, 2〜3文), advice(次に試すと良い1つの具体的アドバイス), score(0-100の総合点)。
- 甘すぎず厳しすぎず、次に活きる建設的な評価にする。
- 出力はJSONのみ:
{ "perObjective": [{ "objective": string, "good": string, "improve": string }], "overall": string, "advice": string, "score": number }`,
    user: `## シナリオ
${session.scenario.title} — ${session.scenario.description}

## 評価観点
${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}

## 会話
${transcript || "（会話なし）"}`,
  });
  return data;
}
