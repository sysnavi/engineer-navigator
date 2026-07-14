import { prisma } from "@/lib/db";
import { embedQuery, embeddingsEnabled } from "./embeddings";

// 会社独自ノウハウのRAG検索（pgvector コサイン類似度）。
// vector列はPrismaの型付きクライアントで扱えないため raw SQL を使う。
//
// AIの提案・評価を「Claudeの一般知識」ではなく「会社のノウハウ」で裏付けるための検索層。
// kind で用途を絞ることで、機能ごとに関係ない知識が混ざらないようにする。

export type KnowledgeKind =
  | "LEARNING"
  | "SKILL_CRITERIA"
  | "CONDITION_PLAYBOOK"
  | "ROLE_DEFINITION"
  | "RATE_EVIDENCE";

export type RetrievedChunk = {
  id: string;
  source: string;
  sourceUrl: string | null;
  content: string;
  distance: number;
};

// 距離のしきい値は実測で決めている（voyage-3.5 のコサイン距離）。
//
// - 学習教材(LEARNING)は語彙が具体的で、関連〜0.42 / 無関係0.56以上ときれいに割れる → 0.5
// - 社内ノウハウ(職務定義書・プレイブック等)は概念的な長文のため、
//   関連でも 0.45〜0.66、無関係は 0.70以上 → 0.7
//
// kind で絞った時点で対象は用途特化済みなので、ノウハウ側は緩めでよい。
// 取りこぼす（ノウハウが黙って効かない）方が、多少のノイズより損失が大きい。
// systemプロンプト側で「無関係なら無視してよい」と指示してあるのも効いている。
const DEFAULT_MAX_DISTANCE = 0.7;
const LEARNING_MAX_DISTANCE = 0.5;

/**
 * クエリに近いノウハウチャンクを上位k件返す。
 * kinds を渡すとその用途の知識だけに絞る（省略時は全件横断）。
 * VOYAGE_API_KEY 未設定・該当なしのときは空配列（呼び出し側はRAGをスキップ）。
 */
export async function searchKnowledge(params: {
  query: string;
  kinds?: KnowledgeKind[];
  k?: number;
  maxDistance?: number;
}): Promise<RetrievedChunk[]> {
  if (!embeddingsEnabled()) return [];
  const vec = await embedQuery(params.query);
  if (!vec) return [];

  const literal = `[${vec.join(",")}]`;
  const k = params.k ?? 4;

  // <=> はコサイン距離（小さいほど近い）。HNSWインデックスが効く。
  const rows = params.kinds?.length
    ? await prisma.$queryRawUnsafe<RetrievedChunk[]>(
        `SELECT "id", "source", "sourceUrl", "content",
                ("embedding" <=> $1::vector) AS "distance"
           FROM "KnowledgeChunk"
          WHERE "embedding" IS NOT NULL
            AND "kind" = ANY($2::"KnowledgeKind"[])
          ORDER BY "embedding" <=> $1::vector
          LIMIT $3`,
        literal,
        params.kinds,
        k
      )
    : await prisma.$queryRawUnsafe<RetrievedChunk[]>(
        `SELECT "id", "source", "sourceUrl", "content",
                ("embedding" <=> $1::vector) AS "distance"
           FROM "KnowledgeChunk"
          WHERE "embedding" IS NOT NULL
          ORDER BY "embedding" <=> $1::vector
          LIMIT $2`,
        literal,
        k
      );

  const max = params.maxDistance ?? DEFAULT_MAX_DISTANCE;
  return rows.filter((r) => r.distance < max);
}

/** 学習コンテンツだけを検索（メンター・学習プラン用の薄いラッパ） */
export async function searchLearningChunks(
  query: string,
  k = 4
): Promise<RetrievedChunk[]> {
  return searchKnowledge({
    query,
    kinds: ["LEARNING"],
    k,
    maxDistance: LEARNING_MAX_DISTANCE,
  });
}

/**
 * 検索結果を system に差し込むノウハウブロックにする。
 * label で「何のノウハウか」を明示し、出典を添えるよう促す。
 */
export function formatContextBlock(
  chunks: RetrievedChunk[],
  label = "参考資料（社内学習コンテンツから検索）"
): string {
  if (chunks.length === 0) return "";
  const body = chunks
    .map((c, i) => `[${i + 1}] 出典「${c.source}」\n${c.content.trim()}`)
    .join("\n\n");
  return `\n\n## ${label}\n（関連する範囲で必ず優先して活用し、使ったら「出典「○○」より」と一言添える。無関係なら無視してよい）\n${body}`;
}
