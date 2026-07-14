import { prisma } from "@/lib/db";
import { embedQuery, embeddingsEnabled } from "./embeddings";

// 学習コンテンツのRAG検索（pgvector コサイン類似度）。
// vector列はPrismaの型付きクライアントで扱えないため raw SQL を使う。

export type RetrievedChunk = {
  id: string;
  source: string;
  sourceUrl: string | null;
  content: string;
  distance: number;
};

/**
 * クエリに近い学習チャンクを上位k件返す。
 * VOYAGE_API_KEY 未設定・該当なしのときは空配列（呼び出し側はRAGをスキップ）。
 */
export async function searchLearningChunks(
  query: string,
  k = 4
): Promise<RetrievedChunk[]> {
  if (!embeddingsEnabled()) return [];
  const vec = await embedQuery(query);
  if (!vec) return [];

  const literal = `[${vec.join(",")}]`;
  // <=> はコサイン距離（小さいほど近い）。HNSWインデックスが効く。
  const rows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
    `SELECT "id", "source", "sourceUrl", "content",
            ("embedding" <=> $1::vector) AS "distance"
       FROM "LearningChunk"
      WHERE "embedding" IS NOT NULL
      ORDER BY "embedding" <=> $1::vector
      LIMIT $2`,
    literal,
    k
  );
  // 距離が遠すぎる（無関係）チャンクは落とす。voyage-3.5 のコサイン距離で
  // 関連は概ね〜0.45、無関係は0.55以上に分離するため 0.5 を閾値にする。
  return rows.filter((r) => r.distance < 0.5);
}

/** メンターのsystemに差し込む参考資料ブロックを組み立てる */
export function formatContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const body = chunks
    .map(
      (c, i) =>
        `[${i + 1}] 出典「${c.source}」\n${c.content.trim()}`
    )
    .join("\n\n");
  return `\n\n## 参考資料（社内学習コンテンツから検索。関連する範囲で活用し、使ったら「出典「○○」より」と一言添える。無関係なら無視してよい）\n${body}`;
}
