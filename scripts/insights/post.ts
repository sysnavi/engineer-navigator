// 週次テコ入れ提案を本番から取得して Slack に流す（docs/analytics.md）。
// GitHub Actions（.github/workflows/weekly-insights.yml）が土曜朝に実行する。
//
//   APP_URL=https://... JOB_SECRET=... SLACK_BOT_TOKEN=... npx tsx scripts/insights/post.ts [--no-ai] [--dry-run]
//
// 集計と文章化は本番の POST /api/jobs/weekly-insights（DB と Claude API があるのは Vercel 側だけ）。
// ここは取りに行って投稿するだけ。SLACK_BOT_TOKEN が無ければ console に出す（ローカル確認用）。

import { postText } from "../triage/slack";

async function main() {
  const appUrl = (process.env.APP_URL ?? "https://engineer-navigator.vercel.app").replace(/\/$/, "");
  const secret = process.env.JOB_SECRET;
  if (!secret) throw new Error("JOB_SECRET が未設定です");
  const noAi = process.argv.includes("--no-ai");
  const dryRun = process.argv.includes("--dry-run");

  const url = `${appUrl}/api/jobs/weekly-insights${noAi ? "?ai=0" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) {
    throw new Error(`weekly-insights が失敗: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { text: string; aiUsed: boolean; findings: unknown[] };
  console.log(`所見 ${data.findings.length}件 / AI ${data.aiUsed ? "使用" : "未使用"}`);
  console.log(data.text);

  if (dryRun) return;
  const r = await postText(data.text);
  if (r.skipped) console.log("(SLACK_BOT_TOKEN 未設定のため投稿はスキップ)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
