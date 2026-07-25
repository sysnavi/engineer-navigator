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
/**
 * JSONで返るはずの応答が素の文章で返ってきたときのエラー。
 * `raw` に元の文章が入るので、会話系のように「文章そのものが使える」場面では
 * 呼び出し側で救済できる（1往復むだにしないため）。
 */
export class LlmJsonError extends Error {
  raw: string;
  constructor(raw: string) {
    super("LLMがJSONを返しませんでした");
    this.name = "LlmJsonError";
    this.raw = raw;
  }
}

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
  let jsonText = text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
  // 「はい、こちらです:」のような前置きが付いても拾えるように、
  // 最初の { から最後の } までを切り出す（JSON以外で返す事故への保険）
  if (!jsonText.startsWith("{") && !jsonText.startsWith("[")) {
    const s = jsonText.indexOf("{");
    const e = jsonText.lastIndexOf("}");
    if (s >= 0 && e > s) jsonText = jsonText.slice(s, e + 1);
  }

  let data: T;
  try {
    data = JSON.parse(jsonText) as T;
  } catch {
    // JSONがまったく無い＝素の文章で返ってきた場合。呼び出し側が
    // その文章を活かせるよう、生テキストを添えて投げる
    throw new LlmJsonError(text);
  }

  return {
    data,
    usage: {
      model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
  };
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * 対話用のストリーミング。モデル名はここで一元管理する（CLAUDE.mdの決まり）。
 * onToken でトークンを逐次受け取り、戻り値で全文と使用量を返す。
 */
export async function chatStream(params: {
  system: string;
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  onToken: (text: string) => void;
}): Promise<{ text: string; usage: LlmUsage }> {
  const model = params.model ?? MODELS.chat;
  const stream = anthropic.messages.stream({
    model,
    max_tokens: params.maxTokens ?? 2048,
    system: params.system,
    messages: params.messages,
  });

  stream.on("text", (delta) => params.onToken(delta));

  const final = await stream.finalMessage();
  const text = final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text,
    usage: {
      model,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    },
  };
}
