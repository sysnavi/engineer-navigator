import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/session";
import { MOBILE_OAUTH_COOKIE, isVerifierHash } from "@/lib/mobile-login";
import {
  authorizeUrl,
  generateState,
  isOAuthProvider,
  enabledProviders,
} from "@/lib/oauth";

// OAuth開始: state(CSRF対策の乱数)をcookieに置いてプロバイダの認可画面へ。
//
// モバイルアプリ（Capacitor）からは ?client=mobile&vh=<verifierのSHA-256> で始まる。
// このときcallbackはセッションを発行せず、引換券をディープリンクでアプリへ返す
// （src/lib/mobile-login.ts のフロー解説を参照）。

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
  if (isMobile && !isVerifierHash(vh)) {
    return NextResponse.redirect(new URL("/welcome?oauth_error=state", req.nextUrl));
  }

  const state = generateState();
  const res = NextResponse.redirect(
    authorizeUrl(provider, req.nextUrl.origin, state)
  );
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10分（認可画面での操作時間）
    secure: process.env.NODE_ENV === "production",
  } as const;
  res.cookies.set(OAUTH_STATE_COOKIE, state, cookieOpts);
  if (isMobile) {
    res.cookies.set(MOBILE_OAUTH_COOKIE, vh, cookieOpts);
  } else {
    // 直前にモバイルフローが中断していた場合の残骸を掃除
    res.cookies.delete(MOBILE_OAUTH_COOKIE);
  }
  return res;
}
