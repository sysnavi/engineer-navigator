// 流入元パラメータ（utm_*）だけを取り出す。
// 未ログインで `/` に来た人は middleware が /welcome へ飛ばすが、そのときクエリを丸ごと
// 捨てると SNS 投稿などに付けた utm_source が Vercel Analytics に届かない（docs/analytics.md 3.）。
// utm_* 以外は引き継がない（/welcome が読む guest= などを外から注入させないため）。
export function pickUtm(search: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of search) {
    if (k.startsWith("utm_") && v) out.set(k, v);
  }
  return out;
}
