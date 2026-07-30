-- 学びコンテンツ拡充: 学習プランの章紐づけ / 今日の一問 / 復習ボックス

-- AlterTable: 学習プランの各週に、対応する腕試しのお題を持たせる
ALTER TABLE "StudyPlanItem" ADD COLUMN "topic" TEXT;

-- CreateTable: 今日の一問（その日に出した問題を確定させる）
CREATE TABLE "QuizDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "correct" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 復習ボックス（間隔反復）
CREATE TABLE "QuizReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "graduatedAt" TIMESTAMP(3),
    "lastResult" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizDaily_userId_day_key" ON "QuizDaily"("userId", "day");
CREATE INDEX "QuizDaily_userId_answeredAt_idx" ON "QuizDaily"("userId", "answeredAt");
CREATE UNIQUE INDEX "QuizReview_userId_questionId_key" ON "QuizReview"("userId", "questionId");
CREATE INDEX "QuizReview_userId_graduatedAt_dueAt_idx" ON "QuizReview"("userId", "graduatedAt", "dueAt");

-- AddForeignKey
ALTER TABLE "QuizDaily" ADD CONSTRAINT "QuizDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizDaily" ADD CONSTRAINT "QuizDaily_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizReview" ADD CONSTRAINT "QuizReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizReview" ADD CONSTRAINT "QuizReview_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
