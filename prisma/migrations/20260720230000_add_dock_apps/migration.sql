-- モバイルドックのカスタム配置（Issue #10）。AppDef.id を選択順に3件。空配列=デフォルト構成
ALTER TABLE "User" ADD COLUMN "dockApps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
