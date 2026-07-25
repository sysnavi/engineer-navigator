-- AlterTable
ALTER TABLE "YomoyamaPost" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenReason" TEXT;

-- CreateTable
CREATE TABLE "YomoyamaReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YomoyamaReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YomoyamaReport_createdAt_idx" ON "YomoyamaReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "YomoyamaReport_postId_reporterId_key" ON "YomoyamaReport"("postId", "reporterId");

-- AddForeignKey
ALTER TABLE "YomoyamaReport" ADD CONSTRAINT "YomoyamaReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "YomoyamaPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YomoyamaReport" ADD CONSTRAINT "YomoyamaReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
