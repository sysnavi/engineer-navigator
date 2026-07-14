// 外部通知（Slack Incoming Webhook）。
// ANTHROPIC_API_KEY と同じ思想: SLACK_WEBHOOK_URL 未設定でも機能は失敗させず、
// console ログにフォールバックする。
//
// 【プライバシー】コンディションデータの閲覧は ADMIN と担当営業のみ（docs/roadmap.md）。
// Webhook の投稿先チャンネルはアプリ側で制御できないため、通知には
// 「レベル・トリガー・氏名・ダッシュボードへのリンク」だけを載せ、
// 週報本文由来のテキスト（reason 等）は絶対に含めないこと。
// 運用: 投稿先は営業・管理者のみの限定チャンネルにすること。

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function notify(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.log(`[notify:console] ${text}`);
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[notify] Slack webhook failed: ${res.status}`);
    }
  } catch (e) {
    console.error("[notify] Slack webhook error:", e);
  }
}

export async function notifyAlertCreated(params: {
  level: string;
  trigger: string;
  userName: string;
}): Promise<void> {
  const icon =
    params.level === "CRITICAL" ? "🟥" : params.level === "WARN" ? "🟧" : "🟦";
  await notify(
    `${icon} [${params.level}] ${params.trigger} — ${params.userName}\n詳細: ${APP_URL}/condition`
  );
}

export async function notifyReportReminder(userName: string): Promise<void> {
  await notify(
    `📝 ${userName} さんの先週分の週報が未提出です（リマインド）\n${APP_URL}/report`
  );
}
