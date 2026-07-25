-- コマンド選択制ダンジョン（松）: 潜行中の状態をサーバーに持つ
ALTER TABLE "DungeonRun" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DONE';
ALTER TABLE "DungeonRun" ADD COLUMN "state" JSONB;
