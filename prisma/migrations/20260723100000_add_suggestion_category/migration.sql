-- SkillSuggestion にAI抽出時のカテゴリを保存する（承認時のマスタSkill作成に使う）。
-- これまでAIが返した category は捨てられ、未登録スキルはすべて OTHER で
-- マスタ登録されていた（レーダーチャートのカテゴリが増えないバグの原因）。
ALTER TABLE "SkillSuggestion" ADD COLUMN "category" "SkillCategory" NOT NULL DEFAULT 'OTHER';

-- データ修正①: OTHER で作られてしまった既存マスタSkillのカテゴリを、
-- ReportAnalysis.extractedSkills(JSON) に残っている抽出時カテゴリから復元する。
-- 同名で複数の解析結果がある場合は最新の解析を採用する。
UPDATE "Skill" sk
SET "category" = sub.cat::"SkillCategory"
FROM (
  SELECT DISTINCT ON (lower(e->>'name'))
    lower(e->>'name') AS name,
    e->>'category' AS cat
  FROM "ReportAnalysis" ra
  CROSS JOIN LATERAL jsonb_array_elements(ra."extractedSkills") e
  WHERE jsonb_typeof(ra."extractedSkills") = 'array'
    AND e->>'category' IN ('LANGUAGE','FRAMEWORK','CLOUD','DATABASE','AI','TOOL','PROCESS','SOFT')
  ORDER BY lower(e->>'name'), ra."createdAt" DESC
) sub
WHERE sk."category" = 'OTHER'
  AND lower(sk."name") = sub.name;

-- データ修正②: 未決のままの過去提案にもカテゴリを復元しておく
-- （今後の承認で正しいカテゴリのマスタが作られるように）。
UPDATE "SkillSuggestion" sg
SET "category" = sub.cat::"SkillCategory"
FROM (
  SELECT DISTINCT ON (lower(e->>'name'))
    lower(e->>'name') AS name,
    e->>'category' AS cat
  FROM "ReportAnalysis" ra
  CROSS JOIN LATERAL jsonb_array_elements(ra."extractedSkills") e
  WHERE jsonb_typeof(ra."extractedSkills") = 'array'
    AND e->>'category' IN ('LANGUAGE','FRAMEWORK','CLOUD','DATABASE','AI','TOOL','PROCESS','SOFT')
  ORDER BY lower(e->>'name'), ra."createdAt" DESC
) sub
WHERE sg."category" = 'OTHER'
  AND lower(sg."skillName") = sub.name;
