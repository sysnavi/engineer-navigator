import { prisma } from "@/lib/db";
import { generateHandle, type OAuthProvider } from "@/lib/oauth";
import { track, EVENT } from "@/lib/analytics/track";

// OAuthの身元ハッシュ→ユーザー解決（ログイン/連携追加/新規作成）。
// Webのcallbackとモバイルのexchangeで同じ規則を共有するためここに抽出。
// 「今ログイン中の人」のcookie文脈で呼ぶこと（モバイルはWebView側のexchangeで呼ぶ）。

// outcome は来訪者分析用（docs/analytics.md）:
//  login=既存アカウントで再ログイン / new=新規作成 / linked=ログイン中の連携追加 /
//  promoted=ゲストからの昇格 / already-linked=別アカウント所属の身元を連携しようとして拒否
export type OAuthOutcome = "login" | "new" | "linked" | "promoted" | "already-linked";

export type OAuthLoginResult =
  | { ok: true; userId: string; redirectTo: string; outcome: OAuthOutcome }
  | { ok: false; reason: "already-linked"; outcome: "already-linked" };

export async function resolveOAuthLogin(
  provider: OAuthProvider,
  hash: string,
  current: { id: string; role: string; handle: string | null } | null
): Promise<OAuthLoginResult> {
  const identity = await prisma.authIdentity.findUnique({
    where: { providerHash: hash },
    select: { userId: true },
  });

  const guest = current?.role === "GUEST";
  const result = async (
    r: OAuthLoginResult
  ): Promise<OAuthLoginResult> => {
    await track(EVENT.oauthResult, {
      userId: r.ok ? r.userId : current?.id,
      props: { provider, outcome: r.outcome, guest },
    });
    return r;
  };

  if (identity) {
    if (current && current.id !== identity.userId) {
      // ログイン中に、別アカウント所属の身元を連携しようとした → 拒否（乗っ取り防止）
      // ゲストがこれを踏むと「育てたデータが宙に浮く」— 件数は管理画面の分析で追う
      return result({ ok: false, reason: "already-linked", outcome: "already-linked" });
    }
    return result({ ok: true, userId: identity.userId, redirectTo: "/", outcome: "login" });
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
        data: {
          role: "ENGINEER",
          name: current.handle ?? "ぼうけんしゃ",
          promotedAt: new Date(), // お試し→登録までの日数の材料（来訪者分析）
        },
      });
      await track(EVENT.guestPromoted, { userId: current.id, props: { provider } });
      return result({ ok: true, userId: current.id, redirectTo: "/mypage?promoted=1", outcome: "promoted" });
    }
    return result({ ok: true, userId: current.id, redirectTo: "/mypage?linked=1", outcome: "linked" });
  }

  // 新規: 匿名ユーザーを作成（メール・氏名なし。自動ハンドルは後から変更可能）
  const handle = await generateHandle();
  const user = await prisma.user.create({
    data: { name: handle, handle, role: "ENGINEER" },
  });
  await prisma.authIdentity.create({
    data: { userId: user.id, providerHash: hash, provider },
  });
  return result({ ok: true, userId: user.id, redirectTo: "/", outcome: "new" });
}
