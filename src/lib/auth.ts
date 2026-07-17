import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, DEV_COOKIE } from "@/lib/session";
import { userFromSessionToken } from "@/lib/invite";

// 認証は2系統:
// 1) 招待リンクセッション（本番/公開用）: cookie "en_session" のトークンから Invite→User を解決。
//    個人情報（メール・パスワード）は保持しない。
// 2) 開発用ログイン（DEV_LOGIN_ENABLED のときのみ）: cookie "dev-user" のメールで特定。
//    ローカル開発の利便のため。本番では無効。

const DEV_LOGIN = process.env.DEV_LOGIN_ENABLED === "true";
const DEFAULT_DEV_USER = "engineer@sysnavi.co.jp";

/** ログイン中ユーザーを返す。未ログインなら null（gate 側でハンドリング）。 */
export async function getOptionalUser() {
  const store = await cookies();

  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = await userFromSessionToken(token);
    if (user) return user;
  }

  if (DEV_LOGIN) {
    const email = store.get(DEV_COOKIE)?.value ?? DEFAULT_DEV_USER;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) return user;
  }

  return null;
}

/** ログイン必須。未ログインは例外（middleware が /welcome へ誘導するため通常は到達しない）。 */
export async function getCurrentUser() {
  const user = await getOptionalUser();
  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }
  return user;
}
