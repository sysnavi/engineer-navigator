import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { createAuthSession, AUTH_SESSION_DAYS } from "@/lib/auth-session";
import { SESSION_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/session";
import { resolveOAuthLogin } from "@/lib/oauth-login";
import {
  MOBILE_DEEPLINK,
  MOBILE_OAUTH_COOKIE,
  createMobileLoginTicket,
  isMobileState,
  verifyMobileState,
} from "@/lib/mobile-login";
import {
  exchangeCodeForSub,
  isOAuthProvider,
  providerHash,
} from "@/lib/oauth";

// OAuthコールバック。state検証 → code→sub引換 → ハッシュで身元解決。
// 身元解決の規則（ログイン/連携追加/新規作成）は src/lib/oauth-login.ts に共通化。
//
// モバイルフロー（stateが署名付きの m.〜 形式）: この画面はアプリ内ブラウザで
// 開いており、cookieはWebViewと別世界なうえOAuthリダイレクト連鎖では保持すら
// 保証されない。cookieには一切依存せず、stateの署名検証だけで正当性を確認し、
// 身元ハッシュを一回使い切りの引換券に載せてディープリンクでアプリへ返す。

function cleanupCookies(res: NextResponse) {
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.delete(MOBILE_OAUTH_COOKIE); // 旧方式の残骸掃除
  return res;
}

function fail(req: NextRequest, reason: string) {
  // モバイルフローの失敗はアプリへ戻す（ブラウザシートに置き去りにしない）。
  // 判定はstateパラメータの形式で行う（cookieに依存しない）
  const state = req.nextUrl.searchParams.get("state");
  const dest = isMobileState(state)
    ? `${MOBILE_DEEPLINK}?error=${encodeURIComponent(reason)}`
    : (() => {
        const url = new URL("/welcome", req.nextUrl);
        url.searchParams.set("oauth_error", reason);
        return url.toString();
      })();
  return cleanupCookies(NextResponse.redirect(dest));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider)) return fail(req, "provider");

  const state = req.nextUrl.searchParams.get("state");

  // state検証。モバイルは署名・期限の検証、Webは開始時に置いたcookieとの一致
  let mobileVerifierHash: string | null = null;
  if (isMobileState(state)) {
    mobileVerifierHash = state ? verifyMobileState(state) : null;
    if (!mobileVerifierHash) return fail(req, "state");
  } else {
    const saved = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
    if (!state || !saved || state !== saved) return fail(req, "state");
  }

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

  // モバイル: 身元解決はWebView側のexchangeに委ねる（ゲスト昇格等のcookie文脈が
  // あちらにしかないため）。ここは引換券を発行してアプリへ戻るだけ。
  if (mobileVerifierHash) {
    const ticket = await createMobileLoginTicket(
      provider,
      hash,
      mobileVerifierHash
    );
    return cleanupCookies(
      NextResponse.redirect(`${MOBILE_DEEPLINK}?token=${ticket}`)
    );
  }

  const current = await getOptionalUser();
  const result = await resolveOAuthLogin(provider, hash, current);

  if (!result.ok) {
    // ログイン中に、別アカウント所属の身元を連携しようとした → 拒否（乗っ取り防止）
    const url = new URL("/mypage", req.nextUrl);
    url.searchParams.set("oauth_error", "already-linked");
    return cleanupCookies(NextResponse.redirect(url));
  }

  const token = await createAuthSession(result.userId);
  const res = NextResponse.redirect(new URL(result.redirectTo, req.nextUrl));
  cleanupCookies(res);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_DAYS * 86400,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
