import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

// 招待リンク認証。トークンそのものがログイン資格。個人情報（メール・氏名）は保持しない。
// - 管理者が発行 → 不透明トークンを1本作る（note は管理用の目印のみ）
// - 被招待者が /join/<token> を開く → ユーザーを作成/紐付けし、セッション cookie に token を保存
// - getCurrentUser は cookie の token から Invite→User を解決する

export { SESSION_COOKIE } from "@/lib/session";

/** 推測不可能な招待トークンを生成（URLセーフ） */
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

/** 招待を1件発行する（未引き換え） */
export async function createInvite(note?: string | null) {
  return prisma.invite.create({
    data: { token: generateToken(), note: note?.trim() || null },
  });
}

/**
 * トークンを引き換える。有効なら（必要ならユーザーを作成して）そのユーザーを返す。
 * 無効・失効時は null。
 */
export async function redeemToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!invite || invite.revokedAt) return null;

  if (invite.user) return invite.user;

  // 初回引き換え: 匿名ユーザーを作成して紐付ける（氏名は仮。本人がハンドルを設定する）
  const user = await prisma.user.create({
    data: { name: invite.note?.trim() || "ゲスト", role: "ENGINEER" },
  });
  await prisma.invite.update({
    where: { id: invite.id },
    data: { userId: user.id },
  });
  return user;
}

/** セッション token から有効なユーザーを解決（失効済みは無効） */
export async function userFromSessionToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!invite || invite.revokedAt || !invite.user) return null;
  return invite.user;
}
