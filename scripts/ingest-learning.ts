import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { embedDocuments, embeddingsEnabled } from "@/lib/ai/embeddings";

// 学習コンテンツを content/learning/*.md からチャンク化して埋め込み、LearningChunk に投入する。
// 使い方: VOYAGE_API_KEY を .env に設定してから  npm run ingest:learning
//
// ファイル先頭のヘッダ（# source: / # topic: / # url:）でメタデータを指定する。
// booknavi研修資産など実データを流用する場合も、この形式に整えて置けばよい。

const DIR = join(process.cwd(), "content", "learning");
const MAX_CHARS = 600; // 1チャンクの目安

type Doc = { source: string; topic: string | null; url: string | null; body: string };

function parseDoc(raw: string, fallbackSource: string): Doc {
  const lines = raw.split("\n");
  let source = fallbackSource;
  let topic: string | null = null;
  let url: string | null = null;
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^#\s*(source|topic|url)\s*:\s*(.*)$/i);
    if (!m) break;
    const val = m[2].trim();
    if (m[1].toLowerCase() === "source" && val) source = val;
    if (m[1].toLowerCase() === "topic") topic = val || null;
    if (m[1].toLowerCase() === "url") url = val || null;
  }
  return { source, topic, url, body: lines.slice(i).join("\n").trim() };
}

/** 段落単位でまとめ、長すぎる場合だけ分割する */
function chunk(body: string): string[] {
  const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > MAX_CHARS && buf) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function main() {
  if (!embeddingsEnabled()) {
    console.error(
      "VOYAGE_API_KEY が未設定です。.env に設定してから再実行してください。"
    );
    process.exit(1);
  }

  const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.log("content/learning に .md がありません。");
    return;
  }

  for (const file of files) {
    const raw = readFileSync(join(DIR, file), "utf8");
    const doc = parseDoc(raw, file.replace(/\.md$/, ""));
    const chunks = chunk(doc.body);
    console.log(`[${doc.source}] ${chunks.length} chunks を埋め込み中...`);

    const vectors = await embedDocuments(chunks);
    if (!vectors) {
      console.error(`  埋め込みに失敗（${doc.source}）。スキップ。`);
      continue;
    }

    // 同じ source の既存チャンクを入れ替え（再実行で重複しない）
    await prisma.$executeRawUnsafe(
      `DELETE FROM "LearningChunk" WHERE "source" = $1`,
      doc.source
    );

    for (let idx = 0; idx < chunks.length; idx++) {
      const literal = `[${vectors[idx].join(",")}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "LearningChunk" ("id","source","sourceUrl","topic","content","chunkIndex","embedding")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::vector)`,
        doc.source,
        doc.url,
        doc.topic,
        chunks[idx],
        idx,
        literal
      );
    }
    console.log(`  ✓ ${doc.source}: ${chunks.length} 件投入`);
  }

  const total = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `SELECT count(*)::int AS c FROM "LearningChunk"`
  );
  console.log(`完了。LearningChunk 合計 ${total[0].c} 件。`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
