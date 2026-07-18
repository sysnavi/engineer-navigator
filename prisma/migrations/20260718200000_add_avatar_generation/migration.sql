-- アバター継承（転生）: 完了した世代の記録（Issue #1）。1行 = 家系図の1段
CREATE TABLE "AvatarGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gen" INTEGER NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expSnapshot" INTEGER NOT NULL,
    "expInGen" INTEGER NOT NULL,
    "levelAtEnd" INTEGER NOT NULL,
    "stageAtEnd" TEXT NOT NULL,
    "spriteAtEnd" TEXT NOT NULL,
    "dominantGene" TEXT NOT NULL,
    "recessiveGene" TEXT,
    "bequest" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    CONSTRAINT "AvatarGeneration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AvatarGeneration_userId_gen_key" ON "AvatarGeneration"("userId", "gen");
ALTER TABLE "AvatarGeneration" ADD CONSTRAINT "AvatarGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
