import Anthropic from "@anthropic-ai/sdk";

// すべてのLLM呼び出しはこのモジュールを経由する。
// - モデル名は1箇所で管理（差し替え・実験を容易に）
// - トークン数を必ず返し、呼び出し側で ReportAnalysis 等に記録する

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELS = {
  // 週報解析・スキル抽出: 精度重視
  analysis: "claude-sonnet-5",
  // メンター・ロールプレイ等の対話: 品質重視
  chat: "claude-sonnet-5",
} as const;

export type LlmUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * JSONを返すプロンプトを実行し、パース済みオブジェクトと使用量を返す。
 * スキル抽出・トーン解析などの構造化タスク用。
 */
export async function completeJson<T>(params: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<{ data: T; usage: LlmUsage }> {
  const model = params.model ?? MODELS.analysis;
  const res = await anthropic.messages.create({
    model,
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
  });

  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // ```json フェンス付きで返ってきた場合も剥がす
  const jsonText = text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();

  return {
    data: JSON.parse(jsonText) as T,
    usage: {
      model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
  };
}
