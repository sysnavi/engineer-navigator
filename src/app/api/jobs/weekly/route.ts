// 週次ジョブ（未提出リマインド + コンディション再スキャン + Slack通知）は
// 個人サービス化に伴い廃止（Issue #19 方針A）。
// コンディションは本人のみ閲覧で、運営・営業がアラートを受け取る運用が存在しないため。
// 残っている cron 設定が叩いても安全なよう 410 Gone を返す。
// 検知ロジック自体は src/lib/condition.ts に温存（将来の本人向けセルフケア機能用）。

export async function POST() {
  return Response.json(
    { error: "この週次ジョブは個人サービス化に伴い廃止されました (Issue #19)" },
    { status: 410 }
  );
}
