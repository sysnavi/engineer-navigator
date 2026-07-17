-- 「もう表示しなくていい問題」（本人にだけ出題されなくなる）
CREATE TABLE "QuizHidden" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizHidden_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuizHidden_questionId_userId_key" ON "QuizHidden"("questionId", "userId");
CREATE INDEX "QuizHidden_userId_idx" ON "QuizHidden"("userId");
ALTER TABLE "QuizHidden" ADD CONSTRAINT "QuizHidden_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizHidden" ADD CONSTRAINT "QuizHidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
