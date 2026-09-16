import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { createAuthSession, AUTH_SESSION_DAYS } from "@/lib/auth-session";
import { canIssueGuest, createGuestUser, recordGuestIssue } from "@/lib/guest";
import { getOptionalUser } from "@/lib/auth";
import { track, EVENT } from "@/lib/analytics/track";
import { loadWelcomeQuestion } from "@/lib/public-question";
import { parseChoice } from "@/lib/welcome-quiz";
import { recordAttempt } from "@/lib/quiz/attempt";

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

  // /welcome の「いきなり1問」に答えてから来た場合、その解答を最初の腕試しとして記録する
  // （EXPを持ったまま始められる）。受け付けるのは今日の問題だけ＝任意IDの採点には使えない。
  const answer = await heroAnswerFrom(req);

  const user = await createGuestUser();
  recordGuestIssue(ip);
  let quizProps: { quiz: boolean; correct?: boolean } = { quiz: false };
  if (answer) {
    const correct = answer.chosen === answer.q.answerIndex;
    await recordAttempt({
      userId: user.id,
      questionId: answer.q.id,
      chosenIndex: answer.chosen,
      correct,
      topic: answer.q.topic,
      source: "quiz",
    }).catch((e) => console.error("welcome quiz recordAttempt failed:", e));
    quizProps = { quiz: true, correct };
  }
  await track(EVENT.guestStart, { userId: user.id, props: quizProps });

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

/** フォームの q/a を検証して、今日の問題への解答なら返す（それ以外・本文なしは null） */
async function heroAnswerFrom(req: NextRequest) {
  let q: string | null = null;
  let a: string | null = null;
  try {
    const form = await req.formData();
    const fq = form.get("q");
    const fa = form.get("a");
    q = typeof fq === "string" ? fq : null;
    a = typeof fa === "string" ? fa : null;
  } catch {
    return null; // 本文なし・形式違いは「答えていない」扱い
  }
  if (!q || a === null) return null;
  const today = await loadWelcomeQuestion();
  if (!today || today.id !== q) return null;
  const chosen = parseChoice(a, today.choices.length);
  return chosen === null ? null : { q: today, chosen };
}
