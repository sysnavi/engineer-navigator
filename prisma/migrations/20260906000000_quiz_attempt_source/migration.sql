-- 解答の出どころ（腕試し / ダンジョン）。既存行はすべて腕試しなので 'quiz' を既定にする

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'quiz';

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_source_createdAt_idx" ON "QuizAttempt"("userId", "source", "createdAt");
