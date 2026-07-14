-- 会社独自ノウハウのRAG: LearningChunk を KnowledgeChunk に一般化する。
-- 既存の学習チャンク（埋め込み済み）は再埋め込みせずそのまま活かすため、
-- DROP/CREATE ではなく RENAME + ADD COLUMN で移行する。
-- 途中適用済みのDBでも安全に流せるよう冪等に書いている。

DO $$ BEGIN
    CREATE TYPE "KnowledgeKind" AS ENUM (
        'LEARNING',
        'SKILL_CRITERIA',
        'CONDITION_PLAYBOOK',
        'ROLE_DEFINITION',
        'RATE_EVIDENCE'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE IF EXISTS "LearningChunk" RENAME TO "KnowledgeChunk";

-- 既存行はすべて学習コンテンツなので LEARNING を入れてから DEFAULT を外す
ALTER TABLE "KnowledgeChunk"
    ADD COLUMN IF NOT EXISTS "kind" "KnowledgeKind" NOT NULL DEFAULT 'LEARNING';
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "kind" DROP DEFAULT;

ALTER INDEX IF EXISTS "LearningChunk_pkey" RENAME TO "KnowledgeChunk_pkey";
ALTER INDEX IF EXISTS "LearningChunk_source_idx" RENAME TO "KnowledgeChunk_source_idx";

-- コサイン類似度のHNSWインデックス（旧名が残っていれば作り直す）
DROP INDEX IF EXISTS "LearningChunk_embedding_idx";
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_idx" ON "KnowledgeChunk"
    USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_kind_idx" ON "KnowledgeChunk"("kind");
