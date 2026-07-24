-- Issue #23 追補: ごはんを1日3回/匹に。今日の給餌回数を数える列を追加
ALTER TABLE "Pet" ADD COLUMN "fedCount" INTEGER NOT NULL DEFAULT 0;
