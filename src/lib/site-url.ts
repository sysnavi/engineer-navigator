// 公開URLの起点（sitemap/robots/OGPの絶対URL用・Issue #14）。
// 本番は Vercel 環境変数 APP_URL を設定する。未設定ならローカル既定。
// 末尾スラッシュは付けない（結合時の // を避ける）。
export function siteUrl(): string {
  const raw = process.env.APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
