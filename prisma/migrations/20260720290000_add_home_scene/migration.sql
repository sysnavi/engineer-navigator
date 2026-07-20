-- マイホーム見た目充実化（Issue #12 松）: DESKTOP.sav 自由配置 + 部屋のきせかえ
ALTER TABLE "OwnedGadget"
  ADD COLUMN "deskX" INTEGER,
  ADD COLUMN "deskY" INTEGER,
  ADD COLUMN "deskZ" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User"
  ADD COLUMN "homeWallpaper" TEXT NOT NULL DEFAULT 'cream',
  ADD COLUMN "homeFloor" TEXT NOT NULL DEFAULT 'wood';

-- 旧v1スロット配置（棚0-5/床6-11）を自由配置座標へ移行する。
-- 棚の品はデスク上（y=52）、床の品は床（y=78）へ。homeSlot は後戻り用に温存。
UPDATE "OwnedGadget" SET
  "deskX" = 12 + ("homeSlot" % 6) * 15,
  "deskY" = CASE WHEN "homeSlot" < 6 THEN 52 ELSE 78 END,
  "deskZ" = "homeSlot"
WHERE "homeSlot" IS NOT NULL;
