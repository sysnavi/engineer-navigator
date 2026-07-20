import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

// OAuthログイン（Issue #8 竹マイナス: Google + GitHub）。
//
// 設計の肝（PIIゼロ）: OAuthを「メールをもらう仕組み」ではなく
// 「同じ人が戻ってきたことを確認する仕組み」としてだけ使う。
// - Google は scope=openid のみ（メール非要求）。id_token の sub だけ使う
// - GitHub は scope なし。/user API の id だけ使う
// - DBに保存するのは SHA-256("provider:sub") のハッシュのみ（AuthIdentity）
// 依存ライブラリなしの標準コードフロー（state cookie でCSRF対策）。

export const OAUTH_PROVIDERS = ["google", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(v: string): v is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(v);
}

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

/** env にクライアントID/Secretが揃っているプロバイダだけ有効 */
export function enabledProviders(): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter(
    (p) =>
      env(`${p.toUpperCase()}_CLIENT_ID`) &&
      env(`${p.toUpperCase()}_CLIENT_SECRET`)
  );
}

function credentials(provider: OAuthProvider) {
  const id = env(`${provider.toUpperCase()}_CLIENT_ID`);
  const secret = env(`${provider.toUpperCase()}_CLIENT_SECRET`);
  if (!id || !secret) throw new Error(`${provider} のOAuth設定がありません`);
  return { id, secret };
}

/** コールバックURL。本番は APP_URL、無ければリクエストのオリジンから組み立てる */
export function redirectUri(provider: OAuthProvider, origin: string): string {
  const base = env("APP_URL") ?? origin;
  return `${base.replace(/\/$/, "")}/api/auth/${provider}/callback`;
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

/** プロバイダの認可画面URL（スコープは最小: Google=openidのみ / GitHub=なし） */
export function authorizeUrl(
  provider: OAuthProvider,
  origin: string,
  state: string
): string {
  const { id } = credentials(provider);
  const redirect = redirectUri(provider, origin);
  if (provider === "google") {
    const q = new URLSearchParams({
      client_id: id,
      redirect_uri: redirect,
      response_type: "code",
      scope: "openid",
      state,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    state,
    // scope 指定なし = 公開プロフィールのみ（メール非要求）
  });
  return `https://github.com/login/oauth/authorize?${q}`;
}

/** 認可コードをプロバイダ内ユーザーID(sub)に引き換える。メール等は取得しない */
export async function exchangeCodeForSub(
  provider: OAuthProvider,
  code: string,
  origin: string
): Promise<string> {
  const { id, secret } = credentials(provider);
  const redirect = redirectUri(provider, origin);

  if (provider === "google") {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
    const data = (await res.json()) as { id_token?: string };
    if (!data.id_token) throw new Error("google: id_token がありません");
    // id_token はGoogleのtokenエンドポイントからTLS直取得なので、ペイロードのsubを直接使える
    const payload = JSON.parse(
      Buffer.from(data.id_token.split(".")[1], "base64url").toString("utf8")
    ) as { sub?: string };
    if (!payload.sub) throw new Error("google: sub がありません");
    return payload.sub;
  }

  // GitHub
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirect,
    }),
  });
  if (!res.ok) throw new Error(`github token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("github: access_token がありません");
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!userRes.ok) throw new Error(`github /user failed: ${userRes.status}`);
  const gh = (await userRes.json()) as { id?: number };
  if (!gh.id) throw new Error("github: id がありません");
  return String(gh.id);
}

/** DBに保存する唯一の識別子。sub は保存せずハッシュだけ残す */
export function providerHash(provider: OAuthProvider, sub: string): string {
  return createHash("sha256").update(`${provider}:${sub}`).digest("hex");
}

// ---------------------------------------------------------------------------
// 自動ハンドル生成（新規OAuthユーザー用・8bitの世界観・重複回避つき）
// ---------------------------------------------------------------------------
const HANDLE_A = [
  "pixel", "retro", "dot", "chip", "neon", "turbo", "mega", "hyper",
  "cyber", "logic", "async", "quantum",
];
const HANDLE_B = [
  "fox", "cat", "owl", "wolf", "duck", "crab", "gecko", "otter",
  "panda", "falcon", "beaver", "lynx",
];

export async function generateHandle(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const a = HANDLE_A[Math.floor(Math.random() * HANDLE_A.length)];
    const b = HANDLE_B[Math.floor(Math.random() * HANDLE_B.length)];
    const n = Math.floor(Math.random() * 900) + 100;
    const handle = `${a}-${b}-${n}`;
    const taken = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    });
    if (!taken) return handle;
  }
  // 20回衝突は実質起きないが、保険で完全ランダム
  return `player-${randomBytes(4).toString("hex")}`;
}
