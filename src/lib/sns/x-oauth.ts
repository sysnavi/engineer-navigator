// X (Twitter) API 用の OAuth 1.0a 署名（HMAC-SHA1）。
// ライブラリを足さずに Node 標準の crypto だけで組む（依存を増やさない・監査しやすい）。
// 仕様: RFC 5849 / X Developer Docs "Creating a signature"。
//
// 使うのは「ユーザーコンテキスト」（Bot アカウントのアクセストークン）。
// OAuth 2.0 (PKCE) はリフレッシュトークンの寿命管理が要るので、
// 無人ルーティンには失効しない 1.0a のトークンのほうが向いている。

import { createHmac, randomBytes } from "node:crypto";

export type OAuthCreds = {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
};

/** RFC 3986 のパーセントエンコード（encodeURIComponent が逃す !'()* も変換） */
export function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * 署名ベース文字列を作る。params には oauth_* と（フォーム/クエリの）リクエストパラメータを
 * 全部入れる。multipart/form-data のボディは署名対象外（渡さない）。
 */
export function signatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>
): string {
  const normalized = Object.entries(params)
    .map(([k, v]) => [rfc3986(k), rfc3986(v)] as const)
    .sort(([ak, av], [bk, bv]) => (ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return [method.toUpperCase(), rfc3986(url), rfc3986(normalized)].join("&");
}

export function hmacSha1Signature(base: string, consumerSecret: string, tokenSecret: string): string {
  const key = `${rfc3986(consumerSecret)}&${rfc3986(tokenSecret)}`;
  return createHmac("sha1", key).update(base).digest("base64");
}

/**
 * Authorization ヘッダ（OAuth ...）を作る。
 * nonce / timestamp はテストで固定できるよう引数で差し替えられる。
 * @param requestParams クエリ or application/x-www-form-urlencoded のパラメータ（署名に含める）
 */
export function buildAuthorizationHeader(
  creds: OAuthCreds,
  method: string,
  url: string,
  requestParams: Record<string, string> = {},
  opts: { nonce?: string; timestamp?: string } = {}
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: opts.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: opts.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const base = signatureBaseString(method, url, { ...requestParams, ...oauth });
  oauth.oauth_signature = hmacSha1Signature(base, creds.consumerSecret, creds.accessSecret);
  const header = Object.entries(oauth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${rfc3986(k)}="${rfc3986(v)}"`)
    .join(", ");
  return `OAuth ${header}`;
}
