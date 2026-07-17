-- 招待リンク認証のユーザーはメールを持たない（PII非保持）。email を任意に。
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
