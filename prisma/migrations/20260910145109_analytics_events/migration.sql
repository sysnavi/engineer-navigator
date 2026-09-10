-- AlterTable
ALTER TABLE "User" ADD COLUMN     "promotedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppEvent_name_createdAt_idx" ON "AppEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "AppEvent_userId_createdAt_idx" ON "AppEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
