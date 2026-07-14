// 埋め込み（Voyage AI）。Anthropicには埋め込みAPIが無いため Voyage を使う。
// ANTHROPIC_API_KEY と同じ思想: VOYAGE_API_KEY 未設定なら null を返し、
// 呼び出し側はRAGをスキップする（メンターは知識ベースのみで動作）。
//
// モデル: voyage-3.5（1024次元。DBの vector(1024) と一致させること）

export const EMBED_MODEL = "voyage-3.5";
export const EMBED_DIM = 1024;

export function embeddingsEnabled(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

type InputType = "document" | "query";

async function callVoyage(
  input: string[],
  inputType: InputType
): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        input,
        model: EMBED_MODEL,
        input_type: inputType,
        output_dimension: EMBED_DIM,
      }),
    });
    if (!res.ok) {
      console.error(`[embeddings] Voyage failed: ${res.status} ${await res.text()}`);
      return null;
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  } catch (e) {
    console.error("[embeddings] Voyage error:", e);
    return null;
  }
}

/** 検索クエリを1件埋め込む（input_type=query）。未設定なら null。 */
export async function embedQuery(text: string): Promise<number[] | null> {
  const out = await callVoyage([text], "query");
  return out?.[0] ?? null;
}

/** ドキュメントを一括埋め込む（input_type=document）。未設定なら null。 */
export async function embedDocuments(
  texts: string[]
): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  return callVoyage(texts, "document");
}
