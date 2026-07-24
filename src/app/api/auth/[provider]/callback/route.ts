import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/auth";
import { createAuthSession, AUTH_SESSION_DAYS } from "@/lib/auth-session";
import { SESSION_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/session";
import {
  exchangeCodeForSub,
  generateHandle,
  isOAuthProvider,
  providerHash,
} from "@/lib/oauth";

// OAuthコールバック。state検証 → code→sub引換 → ハッシュで身元解決。
// - 既存の身元          → その人としてログイン
// - ログイン中（招待等） → 現在のアカウントに連携を追加（乗っ取り防止チェックあり）
// - まったくの新規       → 匿名ユーザー作成（自動ハンドル・PIIなし）してログイン

function fail(req: NextRequest, reason: string) {
  const url = new URL("/welcome", req.nextUrl);
  url.searchParams.set("oauth_error", reason);
  const res = NextResponse.redirect(url);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider)) return fail(req, "provider");

  // CSRF対策: 開始時に置いたstateと一致しなければ拒否
  const state = req.nextUrl.searchParams.get("state");
  const saved = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !saved || state !== saved) return fail(req, "state");

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return fail(req, "denied"); // ユーザーが認可画面でキャンセル等

  let hash: string;
  try {
    const sub = await exchangeCodeForSub(provider, code, req.nextUrl.origin);
    hash = providerHash(provider, sub); // sub はここで捨てる（保存しない）
  } catch (e) {
    console.error(`oauth ${provider} callback failed:`, e);
    return fail(req, "exchange");
  }

  const identity = await prisma.authIdentity.findUnique({
    where: { providerHash: hash },
    select: { userId: true },
  });
  const current = await getOptionalUser();

  let userId: string;
  let redirectTo = "/";

  if (identity) {
    if (current && current.id !== identity.userId) {
      // ログイン中に、別アカウント所属の身元を連携しようとした → 拒否（乗っ取り防止）
      const url = new URL("/mypage", req.nextUrl);
      url.searchParams.set("oauth_error", "already-linked");
      const res = NextResponse.redirect(url);
      res.cookies.delete(OAUTH_STATE_COOKIE);
      return res;
    }
    userId = identity.userId; // 既知の人 → ログイン
  } else if (current) {
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
    }
    userId = current.id;
    redirectTo =
      current.role === "GUEST" ? "/mypage?promoted=1" : "/mypage?linked=1";
  } else {
    // 新規: 匿名ユーザーを作成（メール・氏名なし。自動ハンドルは後から変更可能）
    const handle = await generateHandle();
    const user = await prisma.user.create({
      data: { name: handle, handle, role: "ENGINEER" },
    });
    await prisma.authIdentity.create({
      data: { userId: user.id, providerHash: hash, provider },
    });
    userId = user.id;
  }

  const token = await createAuthSession(userId);
  const res = NextResponse.redirect(new URL(redirectTo, req.nextUrl));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_DAYS * 86400,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
