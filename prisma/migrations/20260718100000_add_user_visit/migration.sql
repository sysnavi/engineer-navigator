-- サイト訪問の記録（1日1行）。訪問EXP・連続ログインストリークに使う
CREATE TABLE "UserVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    CONSTRAINT "UserVisit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserVisit_userId_date_key" ON "UserVisit"("userId", "date");
ALTER TABLE "UserVisit" ADD CONSTRAINT "UserVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
