-- 公開共有（個人サービス）: プロフィール/週報の公開。すべて additive・非破壊。
-- handle は nullable なので、既存ユーザー(handle=NULL)は unique 制約に抵触しない
-- （Postgres は NULL 同士を別物として扱う）。

ALTER TABLE "User" ADD COLUMN "handle" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

ALTER TABLE "WeeklyReport" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
