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

// 静的アセット・API・公開ルート・PWAアセット（manifest / sw.js / 各種アイコン）は
// 除外。それ以外の画面をゲート。
// - /contact は未ログインの訪問者からも声を受け取れるよう公開（Issue #9）
// - /u/ は公開プロフィール、/q/ は良問の公開ページ。未ログイン＝検索エンジンにも
//   見せるため除外（Issue #14）。ページ側が公開分だけ返し、答えはログイン段差で守る
// - sitemap.xml / robots.txt もクローラが認証なしで取れるよう除外
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|welcome|join|contact|u/|q/|sitemap.xml|robots.txt|manifest.webmanifest|sw.js|icon|apple-icon).*)",
  ],
};
