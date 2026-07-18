import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, DEV_COOKIE } from "@/lib/session";

// 未認証アクセスのゲート（edge）。cookie の有無だけを見る軽量チェックで、
// トークンの正当性は各ページの getCurrentUser が DB で検証する。
// ローカル開発(DEV_LOGIN_ENABLED=true)ではゲートしない。

export function middleware(req: NextRequest) {
  if (process.env.DEV_LOGIN_ENABLED === "true") {
    return NextResponse.next();
  }
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;
  const hasDev = !!req.cookies.get(DEV_COOKIE)?.value;
  if (hasSession || hasDev) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = "/welcome";
  url.search = "";
  return NextResponse.redirect(url);
}

// 静的アセット・API・公開ルート（/welcome, /join）・PWAアセット
// （manifest / sw.js / 各種アイコン）は除外。それ以外の画面をゲート。
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|welcome|join|manifest.webmanifest|sw.js|icon|apple-icon).*)",
  ],
};
