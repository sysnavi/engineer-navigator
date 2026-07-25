-- ペットが会話から覚えたこと（Issue: ペットとの会話・竹）
CREATE TABLE "PetMemory" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PetMemory_petId_createdAt_idx" ON "PetMemory"("petId", "createdAt");

ALTER TABLE "PetMemory" ADD CONSTRAINT "PetMemory_petId_fkey"
  FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
