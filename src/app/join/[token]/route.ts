import { NextResponse, type NextRequest } from "next/server";
import { redeemToken } from "@/lib/invite";
import { SESSION_COOKIE } from "@/lib/session";

// 招待リンクの引き換え。/join/<token> を開くとログイン扱いになる。
// トークンが有効なら（必要ならユーザーを作成して）セッション cookie を張り、トップへ。

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const user = await redeemToken(token);

  const url = req.nextUrl.clone();
  if (!user) {
    url.pathname = "/welcome";
    url.search = "?invalid=1";
    return NextResponse.redirect(url);
  }

  url.pathname = "/";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180日
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
