import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { createAuthSession, AUTH_SESSION_DAYS } from "@/lib/auth-session";
import { SESSION_COOKIE } from "@/lib/session";
import { resolveOAuthLogin } from "@/lib/oauth-login";
import { consumeMobileLoginTicket } from "@/lib/mobile-login";
import { isOAuthProvider } from "@/lib/oauth";

// モバイルOAuthの最終段: アプリのWebViewが引換券(token)とverifier生値をPOSTし、
// 通常のセッションcookieを受け取る。ここはWebViewのcookie文脈で動くので、
// ゲスト昇格・連携追加の判定（resolveOAuthLogin）もここで行う。
// 券は一回使い切り・2分で失効（src/lib/mobile-login.ts）。

export async function POST(req: NextRequest) {
  let body: { token?: unknown; verifier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const { token, verifier } = body;
  if (typeof token !== "string" || typeof verifier !== "string") {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const consumed = await consumeMobileLoginTicket(token, verifier);
  const identity = consumed.ok ? consumed : null;
  if (!identity || !isOAuthProvider(identity.provider)) {
    // 失敗理由をエラー画面に小さく出す（実機の不具合はここでしか切り分けられない）
    const reason = consumed.ok ? "provider" : consumed.reason;
    return NextResponse.json(
      {
        error: "invalid-ticket",
        redirectTo: `/welcome?oauth_error=ticket&tr=${encodeURIComponent(reason)}`,
      },
      { status: 401 }
    );
  }

  const current = await getOptionalUser();
  const result = await resolveOAuthLogin(
    identity.provider,
    identity.providerHash,
    current
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "already-linked", redirectTo: "/mypage?oauth_error=already-linked" },
      { status: 409 }
    );
  }

  const session = await createAuthSession(result.userId);
  const res = NextResponse.json({ redirectTo: result.redirectTo });
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_DAYS * 86400,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
