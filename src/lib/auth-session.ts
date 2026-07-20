import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

// OAuthログインのセッション（Issue #8）。ランダムトークンをDBに置き、
// cookie(en_session) の値で照合する。招待リンク(Invite.token)と同じcookieに同居し、
// 解決順は AuthSession → Invite（src/lib/auth.ts）。

export const AUTH_SESSION_DAYS = 180;

/** ログインセッションを発行してトークンを返す（cookieに入れる値） */
export async function createAuthSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.authSession.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + AUTH_SESSION_DAYS * 86400_000),
    },
  });
  return token;
}

/** セッショントークンから有効なユーザーを解決（期限切れは無効） */
export async function userFromAuthSession(token: string) {
  const session = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

/** ログアウト時にセッション行を消す（cookie削除だけでなくサーバー側も無効化） */
export async function deleteAuthSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { token } });
}
