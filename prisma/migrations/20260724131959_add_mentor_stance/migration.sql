-- DropForeignKey
ALTER TABLE "QuizAttempt" DROP CONSTRAINT "QuizAttempt_userId_fkey";

-- DropForeignKey
ALTER TABLE "QuizHidden" DROP CONSTRAINT "QuizHidden_userId_fkey";

-- DropForeignKey
ALTER TABLE "QuizRating" DROP CONSTRAINT "QuizRating_userId_fkey";

-- DropForeignKey
ALTER TABLE "YomoyamaPost" DROP CONSTRAINT "YomoyamaPost_authorId_fkey";

-- DropIndex
DROP INDEX "KnowledgeChunk_embedding_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mentorStance" TEXT NOT NULL DEFAULT 'normal';

-- AddForeignKey
ALTER TABLE "YomoyamaPost" ADD CONSTRAINT "YomoyamaPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizHidden" ADD CONSTRAINT "QuizHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizRating" ADD CONSTRAINT "QuizRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
