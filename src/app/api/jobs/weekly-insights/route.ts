import { type NextRequest } from "next/server";
import { buildWeeklyInsights } from "@/lib/analytics/weekly-insights";

// 週次テコ入れ提案（docs/analytics.md）。本番DBと Claude API があるのは Vercel 側だけなので、
// 集計と文章化はここで行い、Slack への投稿は呼び出し元（GitHub Actions・
// scripts/insights/post.ts）が既存の Bot Token で行う。
//
// 認証: Authorization: Bearer <JOB_SECRET>（Vercel と GitHub Secrets に同じ値を置く）。
// 未設定なら 503（誤って誰でも叩ける状態にしない）。
// ?ai=0 でルール診断だけ（API を使わない確認用）。

export const maxDuration = 60; // AI 呼び出し込みで既定の 10 秒を超えるため

export async function POST(req: NextRequest) {
  const secret = process.env.JOB_SECRET;
  if (!secret) {
    return Response.json({ error: "JOB_SECRET が未設定です" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const useAi = req.nextUrl.searchParams.get("ai") !== "0";
  const result = await buildWeeklyInsights({ appUrl, useAi });
  return Response.json(result);
}
