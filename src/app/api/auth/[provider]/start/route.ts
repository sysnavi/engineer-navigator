import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/session";
import { isVerifierHash, signMobileState } from "@/lib/mobile-login";
import {
  authorizeUrl,
  generateState,
  isOAuthProvider,
  enabledProviders,
} from "@/lib/oauth";

// OAuth開始。
// - Web: state(CSRF対策の乱数)をcookieに置いてプロバイダの認可画面へ。
// - モバイル（?client=mobile&vh=<verifierのSHA-256>）: cookieは使わず、
//   署名付きstate（m.〜）をプロバイダと往復させる。アプリ内ブラウザの
//   cookie jarはOAuthリダイレクト連鎖で信用できないため（src/lib/mobile-login.ts）。

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !enabledProviders().includes(provider)) {
    return NextResponse.redirect(new URL("/welcome?invalid=1", req.nextUrl));
  }

  const isMobile = req.nextUrl.searchParams.get("client") === "mobile";
  const vh = req.nextUrl.searchParams.get("vh") ?? "";
  if (isMobile) {
    if (!isVerifierHash(vh)) {
      return NextResponse.redirect(
        new URL("/welcome?oauth_error=verifier", req.nextUrl)
      );
    }
    return NextResponse.redirect(
      authorizeUrl(provider, req.nextUrl.origin, signMobileState(vh))
    );
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
