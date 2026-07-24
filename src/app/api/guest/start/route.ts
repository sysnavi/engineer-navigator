import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { createAuthSession, AUTH_SESSION_DAYS } from "@/lib/auth-session";
import { canIssueGuest, createGuestUser, recordGuestIssue } from "@/lib/guest";
import { getOptionalUser } from "@/lib/auth";

// ゲストセッションの発行（Issue #18）。/welcome の「▶ ためしてみる」から叩かれる。
// GETではなくPOSTなのは、リンクのプリフェッチやクローラでアカウントが
// 量産されるのを防ぐため。

export async function POST(req: NextRequest) {
  // 既にログイン済み（本アカウントでもゲストでも）なら発行しない
  const current = await getOptionalUser();
  if (current) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // 同一IPからの大量発行を弾く。プロキシ経由なので x-forwarded-for の先頭を見る
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!canIssueGuest(ip)) {
    const url = new URL("/welcome", req.nextUrl);
    url.searchParams.set("guest", "toomany");
    return NextResponse.redirect(url);
  }

  const user = await createGuestUser();
  recordGuestIssue(ip);

  const token = await createAuthSession(user.id);
  // 入口は「育てて潜る」のコアループ。まずマイホームでアバターに会わせる
  const res = NextResponse.redirect(new URL("/home", req.nextUrl));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_DAYS * 86400,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
