// OAuth登録の見張りを本番で実行し、異常があるときだけ Slack に流す（docs/analytics.md「6」）。
// GitHub Actions（.github/workflows/oauth-health.yml）が毎朝実行する。
//
//   APP_URL=https://... JOB_SECRET=... SLACK_BOT_TOKEN=... npx tsx scripts/oauth-health/post.ts [--always] [--dry-run]
//
// --always  異常なしでも投稿する（手動確認用）
// --dry-run 投稿せずログに出すだけ
// 異常あり・ジョブ自体の失敗はいずれも exit 1（Actions の実行も赤くなる）。

import { postText } from "../triage/slack";

async function main(): Promise<number> {
  // CI では Variables 未設定でも空文字が渡るので ?? ではなく || で既定に落とす（slack.ts と同じ）
  const appUrl = (process.env.APP_URL || "https://engineer-navigator.vercel.app").replace(/\/$/, "");
  const secret = process.env.JOB_SECRET;
  if (!secret) throw new Error("JOB_SECRET が未設定です");
  const always = process.argv.includes("--always");
  const dryRun = process.argv.includes("--dry-run");
  const post = async (text: string) => {
    if (dryRun) return;
    const r = await postText(text);
    if (r.skipped) console.log("(SLACK_BOT_TOKEN 未設定のため投稿はスキップ)");
  };

  let data: { ok: boolean; text: string };
  try {
    const res = await fetch(`${appUrl}/api/jobs/oauth-health`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    data = (await res.json()) as { ok: boolean; text: string };
  } catch (e) {
    // 見張り自体が動かないのも「気づけない」状態なので知らせる
    const msg = `🟧 *OAuth登録の見張り — ジョブ自体が失敗*\n${e instanceof Error ? e.message : String(e)}`;
    console.error(msg);
    await post(msg);
    return 1;
  }

  console.log(data.text);
  if (!data.ok || always) await post(data.text);
  return data.ok ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
