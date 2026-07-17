-- よもやま掲示板（AI門番を通過した投稿のみ保存）
CREATE TABLE "YomoyamaPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YomoyamaPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "YomoyamaPost_createdAt_idx" ON "YomoyamaPost"("createdAt");
ALTER TABLE "YomoyamaPost" ADD CONSTRAINT "YomoyamaPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
