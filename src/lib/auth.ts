import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

// 開発用の簡易認証。cookie "dev-user" のメールでユーザーを特定する。
// 本番導入時は Google Workspace SSO (sysnavi.co.jp 限定) に置き換える。

const DEFAULT_DEV_USER = "engineer@sysnavi.co.jp";

export async function getCurrentUser() {
  const store = await cookies();
  const email = store.get("dev-user")?.value ?? DEFAULT_DEV_USER;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `ユーザーが見つかりません: ${email}（npx prisma db seed を実行してください）`
    );
  }
  return user;
}
