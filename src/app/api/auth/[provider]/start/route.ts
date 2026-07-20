import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/session";
import {
  authorizeUrl,
  generateState,
  isOAuthProvider,
  enabledProviders,
} from "@/lib/oauth";

// OAuth開始: state(CSRF対策の乱数)をcookieに置いてプロバイダの認可画面へ。

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !enabledProviders().includes(provider)) {
    return NextResponse.redirect(new URL("/welcome?invalid=1", req.nextUrl));
  }

  const state = generateState();
  const res = NextResponse.redirect(
    authorizeUrl(provider, req.nextUrl.origin, state)
  );
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10分（認可画面での操作時間）
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
