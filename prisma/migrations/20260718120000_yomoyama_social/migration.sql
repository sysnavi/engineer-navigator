-- よもやま拡張: いいね・コメント・コメント可否
ALTER TABLE "YomoyamaPost" ADD COLUMN "allowComments" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "YomoyamaLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YomoyamaLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "YomoyamaLike_postId_userId_key" ON "YomoyamaLike"("postId", "userId");
CREATE INDEX "YomoyamaLike_userId_createdAt_idx" ON "YomoyamaLike"("userId", "createdAt");
ALTER TABLE "YomoyamaLike" ADD CONSTRAINT "YomoyamaLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "YomoyamaPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YomoyamaLike" ADD CONSTRAINT "YomoyamaLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "YomoyamaComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    CONSTRAINT "YomoyamaComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "YomoyamaComment_postId_createdAt_idx" ON "YomoyamaComment"("postId", "createdAt");
CREATE INDEX "YomoyamaComment_authorId_createdAt_idx" ON "YomoyamaComment"("authorId", "createdAt");
ALTER TABLE "YomoyamaComment" ADD CONSTRAINT "YomoyamaComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "YomoyamaPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YomoyamaComment" ADD CONSTRAINT "YomoyamaComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
