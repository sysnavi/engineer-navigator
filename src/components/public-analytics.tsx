"use client";

import { Analytics } from "@vercel/analytics/next";

// Vercel Web Analytics（docs/analytics.md）。cookie を使わず同意バナー不要。
// 送るのは **公開ページだけ**（LP・公開プロフィール・良問の公開ページ・問い合わせ・招待）。
// ログイン後の行動はサーバー側のイベント（src/lib/analytics/track.ts）と
// DB のテーブルで見るので、ここでは追わない（PII ゼロ方針・外部送信の最小化）。
// Vercel 側でプロジェクトの Analytics を有効にしていないと何も送られない（無害）。

const PUBLIC_PREFIXES = ["/welcome", "/u/", "/q/", "/contact", "/join/"];

export function PublicAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const path = new URL(event.url).pathname;
        return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))
          ? event
          : null;
      }}
    />
  );
}
