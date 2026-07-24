-- Issue #25: スキルレベル10段階化 + 検証状態 + 深掘りログ
-- 写像は src/lib/skill-levels.ts の LEVEL_MIGRATION_MAP と一致させること

ALTER TABLE "EngineerSkill" ADD COLUMN "verifiedBy" TEXT;
ALTER TABLE "EngineerSkill" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "SkillSuggestion" ADD COLUMN "probe" JSONB;

-- 旧5段階 → 10段階（1=学習中→2素振り / 2=指導下→3 / 3=独力→5 / 4=本番→6 / 5=選定リード→9）
UPDATE "EngineerSkill" SET "level" = CASE "level"
  WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 5 WHEN 4 THEN 6 WHEN 5 THEN 9 ELSE "level" END;

UPDATE "SkillHistory" SET "level" = CASE "level"
  WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 5 WHEN 4 THEN 6 WHEN 5 THEN 9 ELSE "level" END;

UPDATE "SkillSuggestion" SET "suggestedLevel" = CASE "suggestedLevel"
  WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 5 WHEN 4 THEN 6 WHEN 5 THEN 9 ELSE "suggestedLevel" END
  WHERE "suggestedLevel" IS NOT NULL;
