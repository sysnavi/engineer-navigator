-- UIシェル切替（デスクトップOS風UI / クラシック表示）。null=環境デフォルトに従う
ALTER TABLE "User" ADD COLUMN "uiShell" TEXT;
