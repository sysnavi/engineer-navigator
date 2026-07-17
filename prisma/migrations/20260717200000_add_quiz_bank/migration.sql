-- 良問バンク（四択・全員評価の集計・解答履歴）
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "prompt" TEXT NOT NULL,
    "choices" TEXT[] NOT NULL,
    "answerIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuizQuestion_topic_idx" ON "QuizQuestion"("topic");
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "QuizRating" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuizRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuizRating_questionId_userId_key" ON "QuizRating"("questionId", "userId");
ALTER TABLE "QuizRating" ADD CONSTRAINT "QuizRating_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizRating" ADD CONSTRAINT "QuizRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chosenIndex" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuizAttempt_userId_questionId_idx" ON "QuizAttempt"("userId", "questionId");
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
