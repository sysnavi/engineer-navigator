import { prisma } from "@/lib/db";
import { generateHandle, type OAuthProvider } from "@/lib/oauth";

// OAuthの身元ハッシュ→ユーザー解決（ログイン/連携追加/新規作成）。
// Webのcallbackとモバイルのexchangeで同じ規則を共有するためここに抽出。
// 「今ログイン中の人」のcookie文脈で呼ぶこと（モバイルはWebView側のexchangeで呼ぶ）。

export type OAuthLoginResult =
  | { ok: true; userId: string; redirectTo: string }
  | { ok: false; reason: "already-linked" };

export async function resolveOAuthLogin(
  provider: OAuthProvider,
  hash: string,
  current: { id: string; role: string; handle: string | null } | null
): Promise<OAuthLoginResult> {
  const identity = await prisma.authIdentity.findUnique({
    where: { providerHash: hash },
    select: { userId: true },
  });

  if (identity) {
    if (current && current.id !== identity.userId) {
      // ログイン中に、別アカウント所属の身元を連携しようとした → 拒否（乗っ取り防止）
      return { ok: false, reason: "already-linked" };
    }
    return { ok: true, userId: identity.userId, redirectTo: "/" };
  }

  if (current) {
    // ログイン中の連携追加（招待ユーザーがOAuthを後付けするケース）
    await prisma.authIdentity.create({
      data: { userId: current.id, providerHash: hash, provider },
    });
    // ゲストの昇格（Issue #18）: 同じUser行のまま role を上げるだけ。
    // 別アカウントへのデータ移行が発生しないので、育てたアバター・戦利品・
    // ダンジョン履歴はそのまま引き継がれる。
    if (current.role === "GUEST") {
      await prisma.user.update({
        where: { id: current.id },
        data: { role: "ENGINEER", name: current.handle ?? "ぼうけんしゃ" },
      });
      return { ok: true, userId: current.id, redirectTo: "/mypage?promoted=1" };
    }
    return { ok: true, userId: current.id, redirectTo: "/mypage?linked=1" };
  }

  // 新規: 匿名ユーザーを作成（メール・氏名なし。自動ハンドルは後から変更可能）
  const handle = await generateHandle();
  const user = await prisma.user.create({
    data: { name: handle, handle, role: "ENGINEER" },
  });
  await prisma.authIdentity.create({
    data: { userId: user.id, providerHash: hash, provider },
  });
  return { ok: true, userId: user.id, redirectTo: "/" };
}
