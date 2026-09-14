import type { OAuthProvider, ProbeResponse } from "@/lib/oauth";

// OAuth登録の見張り（docs/analytics.md「6. OAuth登録の見張り」）。
// 毎朝 GitHub Actions が POST /api/jobs/oauth-health を叩き、異常があるときだけ Slack に流す。
//
// 見るものは2種類:
//  1. 本番設定（実ユーザー不要）: env の有無 / client_id・redirect_uri / client_secret
//     → src/lib/oauth.ts の probeAuthorize・probeToken の応答をここで判定する
//  2. 実ユーザーの結果: 直近24時間の oauth_start / oauth_result イベント
// ここは判定と文面だけの純ロジック（DBにもネットにも触らない・テストは oauth-health.test.ts）。

export type CheckStatus = "ok" | "warn" | "fail";

export type HealthCheck = {
  provider: OAuthProvider | null; // null = プロバイダ横断
  key: "enabled" | "authorize" | "token" | "events";
  status: CheckStatus;
  message: string;
};

const LABEL: Record<OAuthProvider, string> = { google: "Google", github: "GitHub" };

const PROBE_FIX: Record<string, string> = {
  invalid_client: "client_id か client_secret が無効（Vercel の env とプロバイダ側の設定を確認）",
  deleted_client: "OAuthクライアントが削除されている",
  disabled_client: "OAuthクライアントが無効化されている",
  redirect_uri_mismatch: "redirect_uri がプロバイダに登録されていない（APP_URL・ドメイン変更を確認）",
  incorrect_client_credentials: "client_secret が無効（再発行して Vercel の env を更新）",
};

function explain(code: string): string {
  return PROBE_FIX[code] ?? `想定外のエラー（${code}）`;
}

// ---------------------------------------------------------------------------
// 1. 本番設定
// ---------------------------------------------------------------------------

export function checkEnabled(provider: OAuthProvider, enabled: OAuthProvider[]): HealthCheck {
  return enabled.includes(provider)
    ? { provider, key: "enabled", status: "ok", message: "env 設定あり" }
    : {
        provider,
        key: "enabled",
        status: "fail",
        message: `${provider.toUpperCase()}_CLIENT_ID / _SECRET が未設定（登録ボタンが黙って消えている）`,
      };
}

/**
 * Google の設定不良時の 302 先 /signin/oauth/error?authError=… から理由コードを取り出す。
 * authError は base64url の protobuf で、先頭フィールドが理由コード文字列
 * （例: 0x0A <len> "redirect_uri_mismatch"）。2026-09 に実応答で確認。
 */
export function googleAuthError(location: string): string | null {
  let url: URL;
  try {
    url = new URL(location);
  } catch {
    return null;
  }
  if (!url.pathname.startsWith("/signin/oauth/error")) return null;
  const raw = url.searchParams.get("authError");
  if (!raw) return "unknown";
  const bytes = Buffer.from(raw, "base64url");
  if (bytes[0] === 0x0a && bytes.length >= 2 + bytes[1]) {
    const code = bytes.subarray(2, 2 + bytes[1]).toString("utf8");
    if (/^[a-z_]+$/.test(code)) return code;
  }
  return bytes.toString("utf8").match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "unknown";
}

export function classifyAuthorize(provider: OAuthProvider, res: ProbeResponse): HealthCheck {
  const base = { provider, key: "authorize" as const };
  if (provider === "github") {
    // 未ログインの GitHub は client_id も redirect_uri も検証せず /login へ飛ばすため判定不能。
    // GitHub の設定は token プローブ側で見る
    return { ...base, status: "ok", message: "（GitHub は token 側で判定）" };
  }
  if (res.status < 300 || res.status >= 400 || !res.location) {
    return { ...base, status: "warn", message: `認可URLが想定外の応答（HTTP ${res.status}）` };
  }
  const code = googleAuthError(res.location);
  if (code) return { ...base, status: "fail", message: explain(code) };
  return { ...base, status: "ok", message: "client_id / redirect_uri OK" };
}

function errorCode(body: string): string | null {
  try {
    const json = JSON.parse(body) as { error?: unknown };
    return typeof json.error === "string" ? json.error : null;
  } catch {
    return null;
  }
}

export function classifyToken(provider: OAuthProvider, res: ProbeResponse): HealthCheck {
  const base = { provider, key: "token" as const };
  const code = errorCode(res.body);

  // 無効な code を送っているので「code が不正」と返るのが正常（= クライアント認証は通った）
  const healthy = provider === "google" ? "invalid_grant" : "bad_verification_code";
  if (code === healthy) {
    return { ...base, status: "ok", message: "client_secret OK" };
  }
  if (provider === "github" && res.status === 404) {
    return { ...base, status: "fail", message: "client_id が見つからない（OAuth App が削除された？）" };
  }
  if (code && code in PROBE_FIX) {
    return { ...base, status: "fail", message: explain(code) };
  }
  return {
    ...base,
    status: "warn",
    message: `token エンドポイントが想定外の応答（HTTP ${res.status}${code ? ` / ${code}` : ""}）`,
  };
}

// ---------------------------------------------------------------------------
// 2. 実ユーザーの結果（直近24時間のイベント）
// ---------------------------------------------------------------------------

export type OAuthEventRow = { name: string; props: unknown };

export type EventSummary = {
  starts: Record<OAuthProvider, number>;
  successes: Record<OAuthProvider, number>;
  fails: Record<string, number>; // reason → 件数（denied=本人キャンセルは除く）
};

const SUCCESS = new Set(["new", "login", "linked", "promoted"]);

// しきい値。exchange は本番設定かプロバイダの異常なので1件でも出す。
// state は「10分以上放置」「別ブラウザで開いた」でも起きるので数件は許容
const FAIL_THRESHOLD: Record<string, { count: number; status: CheckStatus; label: string }> = {
  exchange: { count: 1, status: "fail", label: "code→ユーザーID の引換に失敗" },
  state: { count: 3, status: "warn", label: "state 不一致（cookie が消えている可能性）" },
  ticket: { count: 2, status: "warn", label: "アプリの引換券が無効（モバイルOAuth）" },
};
const MIN_STARTS_FOR_ZERO_SUCCESS = 3;

export function summarizeEvents(rows: OAuthEventRow[]): EventSummary {
  const zero = () => ({ google: 0, github: 0 });
  const s: EventSummary = { starts: zero(), successes: zero(), fails: {} };
  for (const row of rows) {
    const p = (row.props ?? {}) as { provider?: unknown; outcome?: unknown; reason?: unknown };
    const provider = p.provider === "google" || p.provider === "github" ? p.provider : null;
    if (row.name === "oauth_start" && provider) s.starts[provider]++;
    if (row.name !== "oauth_result") continue;
    if (provider && typeof p.outcome === "string" && SUCCESS.has(p.outcome)) {
      s.successes[provider]++;
    }
    if (p.outcome === "fail" && typeof p.reason === "string" && p.reason !== "denied") {
      s.fails[p.reason] = (s.fails[p.reason] ?? 0) + 1;
    }
  }
  return s;
}

export function checkEvents(s: EventSummary): HealthCheck[] {
  const checks: HealthCheck[] = [];
  for (const provider of ["google", "github"] as const) {
    if (s.starts[provider] >= MIN_STARTS_FOR_ZERO_SUCCESS && s.successes[provider] === 0) {
      checks.push({
        provider,
        key: "events",
        status: "fail",
        message: `24時間で開始 ${s.starts[provider]} 件なのに成功 0 件`,
      });
    }
  }
  for (const [reason, count] of Object.entries(s.fails)) {
    const rule = FAIL_THRESHOLD[reason];
    if (rule && count >= rule.count) {
      checks.push({
        provider: null,
        key: "events",
        status: rule.status,
        message: `${rule.label}: 24時間で ${count} 件`,
      });
    }
  }
  return checks;
}

// ---------------------------------------------------------------------------
// 文面
// ---------------------------------------------------------------------------

export function isHealthy(checks: HealthCheck[]): boolean {
  return checks.every((c) => c.status === "ok");
}

export function formatHealthSlack(params: {
  checks: HealthCheck[];
  summary: EventSummary;
  appUrl: string;
}): string {
  const { checks, summary: s, appUrl } = params;
  const starts = s.starts.google + s.starts.github;
  const successes = s.successes.google + s.successes.github;
  const fails = Object.values(s.fails).reduce((a, b) => a + b, 0);
  const numbers = `直近24h: 開始 ${starts} ／ 成功 ${successes} ／ 失敗 ${fails}（キャンセル除く）`;

  if (isHealthy(checks)) {
    return `✅ *OAuth登録の見張り — 異常なし*\n${numbers}`;
  }
  const icon = { fail: "🟥", warn: "🟧", ok: "" };
  const lines = [`🚨 *OAuth登録の見張り — 登録がコケている可能性*`];
  for (const c of checks.filter((c) => c.status !== "ok")) {
    const who = c.provider ? LABEL[c.provider] : "全体";
    lines.push(`${icon[c.status]} ${who} [${c.key}] ${c.message}`);
  }
  lines.push(``, numbers, `分析: ${appUrl.replace(/\/$/, "")}/admin/analytics`);
  return lines.join("\n");
}
