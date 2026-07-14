import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { embedDocuments, embeddingsEnabled } from "@/lib/ai/embeddings";

// 会社独自ノウハウを content/knowledge/<kind>/*.md からチャンク化して埋め込み、
// KnowledgeChunk に投入する。
//
// 使い方: VOYAGE_API_KEY を .env に設定してから  npm run ingest:knowledge
//
// ディレクトリ = ノウハウの種別（kind）。機能ごとに検索対象を絞るために使う:
//   learning/            学習コンテンツ         → メンター・学習プラン
//   skill-criteria/      スキル判定基準         → 週報のスキル抽出
//   condition-playbook/  コンディション対応事例 → コンディション助言
//   role-definition/     リーダー職務定義書     → 役割シミュレーターの評価
//   rate-evidence/       単価交渉の勝ちパターン → 経歴書のハイライト
//
// ファイル先頭のヘッダ（# source: / # topic: / # url:）でメタデータを指定する。
// booknavi研修資産や社内規程も、この形式に整えて置けばそのまま流用できる。

const ROOT = join(process.cwd(), "content", "knowledge");
const MAX_CHARS = 600; // 1チャンクの目安

const KIND_BY_DIR: Record<string, string> = {
  learning: "LEARNING",
  "skill-criteria": "SKILL_CRITERIA",
  "condition-playbook": "CONDITION_PLAYBOOK",
  "role-definition": "ROLE_DEFINITION",
  "rate-evidence": "RATE_EVIDENCE",
};

type Doc = {
  source: string;
  topic: string | null;
  url: string | null;
  body: string;
};

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
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
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
  if (!existsSync(ROOT)) {
    console.error(`${ROOT} がありません。`);
    process.exit(1);
  }

  for (const [dir, kind] of Object.entries(KIND_BY_DIR)) {
    const path = join(ROOT, dir);
    if (!existsSync(path)) continue;
    const files = readdirSync(path).filter((f) => f.endsWith(".md"));
    if (files.length === 0) continue;

    for (const file of files) {
      const raw = readFileSync(join(path, file), "utf8");
      const doc = parseDoc(raw, file.replace(/\.md$/, ""));
      const chunks = chunk(doc.body);
      console.log(
        `[${kind}] ${doc.source}: ${chunks.length} chunks を埋め込み中...`
      );

      const vectors = await embedDocuments(chunks);
      if (!vectors) {
        console.error(`  埋め込みに失敗（${doc.source}）。スキップ。`);
        continue;
      }

      // 同じ source の既存チャンクを入れ替え（再実行で重複しない）
      await prisma.$executeRawUnsafe(
        `DELETE FROM "KnowledgeChunk" WHERE "source" = $1`,
        doc.source
      );

      for (let idx = 0; idx < chunks.length; idx++) {
        const literal = `[${vectors[idx].join(",")}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "KnowledgeChunk"
             ("id","kind","source","sourceUrl","topic","content","chunkIndex","embedding")
           VALUES (gen_random_uuid()::text, $1::"KnowledgeKind", $2, $3, $4, $5, $6, $7::vector)`,
          kind,
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
  }

  const totals = await prisma.$queryRawUnsafe<{ kind: string; c: number }[]>(
    `SELECT "kind"::text AS kind, count(*)::int AS c FROM "KnowledgeChunk" GROUP BY "kind" ORDER BY "kind"`
  );
  console.log("\n完了。KnowledgeChunk の内訳:");
  for (const t of totals) console.log(`  ${t.kind}: ${t.c} 件`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
