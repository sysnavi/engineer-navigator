-- 目指す技術領域（キャリアの方向性）。Postgresのtext配列。デフォルトは空配列。
ALTER TABLE "User" ADD COLUMN "targetDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
