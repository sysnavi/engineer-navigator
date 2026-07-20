-- レアキャラ来訪→ペット化 + マイホーム（Issue #2）
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "speciesId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Encounter_userId_date_key" ON "Encounter"("userId", "date");
CREATE INDEX "Encounter_userId_status_idx" ON "Encounter"("userId", "status");
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "affection" INTEGER NOT NULL DEFAULT 0,
    "lastPettedAt" DATE,
    "befriendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Pet_userId_idx" ON "Pet"("userId");
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- マイホームのガジェット配置スロット
ALTER TABLE "OwnedGadget" ADD COLUMN "homeSlot" INTEGER;
CREATE UNIQUE INDEX "OwnedGadget_userId_homeSlot_key" ON "OwnedGadget"("userId", "homeSlot");
