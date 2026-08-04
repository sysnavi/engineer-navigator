-- おかいもの松: 家具のLIVING.sav自由配置（OwnedGadget.deskX/Y/Z と同型）
ALTER TABLE "Purchase" ADD COLUMN "livingX" INTEGER;
ALTER TABLE "Purchase" ADD COLUMN "livingY" INTEGER;
ALTER TABLE "Purchase" ADD COLUMN "livingZ" INTEGER NOT NULL DEFAULT 0;
