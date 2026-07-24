-- ごはん（Issue #23 竹案）。
-- ごはんマスタは src/lib/pets/foods.ts のTS定義なので、DBは所持数だけを持つ。

-- 1日1回/匹の判定（なでなでの lastPettedAt と同型）と、好物を見つけた記録
ALTER TABLE "Pet" ADD COLUMN "lastFedAt" DATE;
ALTER TABLE "Pet" ADD COLUMN "favoriteFoundAt" TIMESTAMP(3);

CREATE TABLE "FoodItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodItem_userId_foodId_key" ON "FoodItem"("userId", "foodId");

ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
