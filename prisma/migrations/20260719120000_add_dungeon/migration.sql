-- ローグライクダンジョン（Issue #3）: 潜行ログとガジェットコレクション
CREATE TABLE "DungeonRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseDepth" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "steps" JSONB NOT NULL,
    CONSTRAINT "DungeonRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DungeonRun_userId_slot_key" ON "DungeonRun"("userId", "slot");
CREATE INDEX "DungeonRun_userId_createdAt_idx" ON "DungeonRun"("userId", "createdAt");
ALTER TABLE "DungeonRun" ADD CONSTRAINT "DungeonRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OwnedGadget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gadgetId" TEXT NOT NULL,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnedGadget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OwnedGadget_userId_gadgetId_key" ON "OwnedGadget"("userId", "gadgetId");
ALTER TABLE "OwnedGadget" ADD CONSTRAINT "OwnedGadget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
