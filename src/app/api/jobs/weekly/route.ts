import { runWeeklyScan } from "@/lib/condition";

// 週次ジョブ（月曜朝実行想定）: 未提出リマインド + 連続未提出アラート + 全員再スキャン
//
// cron 設定例（月曜 9:00）:
//   0 9 * * 1  curl -s -X POST -H "x-job-secret: $JOB_SECRET" https://<host>/api/jobs/weekly
//
// JOB_SECRET が未設定の場合は 503（誤って無認証で公開しない）

export async function POST(req: Request) {
  const secret = process.env.JOB_SECRET;
  if (!secret) {
    return Response.json(
      { error: "JOB_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (req.headers.get("x-job-secret") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runWeeklyScan();
  console.log("[jobs/weekly]", result);
  return Response.json({ ok: true, ...result });
}
