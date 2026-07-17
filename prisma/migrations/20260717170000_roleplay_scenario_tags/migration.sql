-- 役割演習シナリオに識別アイコンと関連技術領域を追加（シャッフルの領域優先に使う）
ALTER TABLE "RoleplayScenario" ADD COLUMN "emoji" TEXT NOT NULL DEFAULT '🎯';
ALTER TABLE "RoleplayScenario" ADD COLUMN "domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
