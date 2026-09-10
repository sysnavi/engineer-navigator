// 「今日の1枚」を X に投稿し、控えとして Slack にも流す（docs/sns-bot.md）。
// 入力: sns-results/post.json（tests/sns/scenes.spec.ts が書く）
//
//  - X のキー（X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET）が無ければ
//    dry-run（console に出すだけ）。SNS_DRY_RUN=1 でも同様
//  - Slack（SLACK_BOT_TOKEN）は投稿の控え。人が「今日は何が出たか」を朝の Slack で見られる。
//    こちらも未設定なら console のみ
//  - GitHub Actions では $GITHUB_OUTPUT に url を出す

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { postWithFile } from "../triage/slack";
import { loadCreds, postWithImage } from "./x";

const INPUT = "sns-results/post.json";

type Post = { scene: string; caption: string; text: string; file: string; takenAt: string };

async function main() {
  if (!existsSync(INPUT)) {
    throw new Error(`${INPUT} がない（npm run sns:capture が失敗している）`);
  }
  const post = JSON.parse(readFileSync(INPUT, "utf8")) as Post;
  if (!existsSync(post.file)) throw new Error(`画像がない: ${post.file}`);

  // X のキーが無い間は「Slack に今日の1枚を届けて、人が手で X に投稿する」運用。
  // SNS_DRY_RUN=1 はキーがあっても投稿しない確認用
  const manual = !loadCreds();
  const dry = process.env.SNS_DRY_RUN === "1" || manual;
  let url: string | undefined;
  if (dry) {
    console.log(`[sns] ${manual ? "手動投稿モード（X のキー未設定）" : "dry-run（SNS_DRY_RUN=1）"}\n${post.text}\n  📎 ${post.file}`);
  } else {
    const r = await postWithImage(post.text, post.file);
    url = r.url;
    console.log(`[sns] posted: ${url}`);
  }

  // Slack に控え（画像つき）。失敗しても X への投稿は済んでいるので落とさない
  const head = manual
    ? "📸 今日の1枚（X へは手動で投稿してください。画像を保存して、下の本文をコピー）"
    : dry
      ? "📸 SNS投稿（dry-run・投稿していません）"
      : `📸 SNS投稿（X）: ${url}`;
  const runUrl = process.env.RUN_URL ? `\n${process.env.RUN_URL}` : "";
  try {
    // 本文はコードブロックで（Slack 上でそのままコピーできる。> 引用だとハッシュタグやURLが装飾される）
    await postWithFile(`${head}\nシーン: ${post.scene}\n\`\`\`\n${post.text}\n\`\`\`${runUrl}`, post.file);
  } catch (e) {
    console.warn("[sns] Slack への控え投稿に失敗:", e);
  }

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `url=${url ?? ""}\nscene=${post.scene}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## 📸 SNS投稿\n\n- シーン: \`${post.scene}\`\n- ${url ? `[投稿を見る](${url})` : "dry-run（投稿していない）"}\n\n\`\`\`\n${post.text}\n\`\`\`\n`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
