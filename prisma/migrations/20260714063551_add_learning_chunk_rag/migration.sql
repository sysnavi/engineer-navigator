-- pgvector 拡張（docker image: pgvector/pgvector:pg16 に同梱）
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "LearningChunk" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "topic" TEXT,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningChunk_source_idx" ON "LearningChunk"("source");

-- コサイン類似度の近似最近傍インデックス（HNSW）
CREATE INDEX "LearningChunk_embedding_idx" ON "LearningChunk"
    USING hnsw ("embedding" vector_cosine_ops);
