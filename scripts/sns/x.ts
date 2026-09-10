// X (Twitter) への画像付き投稿（API v2 + OAuth 1.0a ユーザーコンテキスト）。
//  1. POST https://api.x.com/2/media/upload（multipart・media_category=tweet_image）→ media id
//  2. POST https://api.x.com/2/tweets（JSON・media.media_ids）→ tweet id
// 旧 v1.1 の upload.twitter.com は 2025 年に廃止されたので v2 の media エンドポイントを使う。
//
// 4つのキーが揃っていなければ console に出すだけで失敗させない（dry-run）。
// scripts/triage/slack.ts と同じ思想で、ローカルでは実投稿なしで一周できる。
//
// CLI: npx tsx scripts/sns/x.ts --text "本文" --file 画像パス
//      → 標準出力に {"id": "...", "url": "..."} を出す

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { buildAuthorizationHeader, type OAuthCreds } from "@/lib/sns/x-oauth";

const API = "https://api.x.com/2";

export function loadCreds(): OAuthCreds | null {
  const c = {
    consumerKey: process.env.X_API_KEY ?? "",
    consumerSecret: process.env.X_API_SECRET ?? "",
    accessToken: process.env.X_ACCESS_TOKEN ?? "",
    accessSecret: process.env.X_ACCESS_SECRET ?? "",
  };
  return Object.values(c).every(Boolean) ? c : null;
}

export type PostResult = { ok: boolean; id?: string; url?: string; skipped?: boolean };

async function request<T>(
  creds: OAuthCreds,
  method: string,
  url: string,
  body: FormData | string,
  contentType?: string
): Promise<T> {
  // multipart は署名対象外なので requestParams は空。JSON ボディも同様
  const auth = buildAuthorizationHeader(creds, method, url);
  const res = await fetch(url, {
    method,
    headers: { Authorization: auth, ...(contentType ? { "Content-Type": contentType } : {}) },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`X ${method} ${url} failed: ${res.status} ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

/** 画像をアップロードして media id を返す */
export async function uploadMedia(creds: OAuthCreds, filePath: string): Promise<string> {
  const bytes = readFileSync(filePath);
  const form = new FormData();
  form.append("media", new Blob([bytes], { type: "image/png" }), basename(filePath));
  form.append("media_category", "tweet_image");
  const r = await request<{ data?: { id?: string }; id?: string; media_id_string?: string }>(
    creds,
    "POST",
    `${API}/media/upload`,
    form
  );
  const id = r.data?.id ?? r.id ?? r.media_id_string;
  if (!id) throw new Error(`X media upload: id がない ${JSON.stringify(r).slice(0, 300)}`);
  return id;
}

/** 画像付きでポストする。creds が無ければ dry-run */
export async function postWithImage(text: string, filePath: string): Promise<PostResult> {
  const creds = loadCreds();
  if (!creds) {
    console.log(`[x:console] ${text}\n  📎 ${filePath}`);
    return { ok: true, skipped: true };
  }
  const mediaId = await uploadMedia(creds, filePath);
  const r = await request<{ data: { id: string } }>(
    creds,
    "POST",
    `${API}/tweets`,
    JSON.stringify({ text, media: { media_ids: [mediaId] } }),
    "application/json"
  );
  const id = r.data.id;
  // 投稿URLはユーザー名が無くても i/web/status で開ける
  return { ok: true, id, url: `https://x.com/i/web/status/${id}` };
}

// ---- CLI ---------------------------------------------------------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && /[\\/]x\.ts$/.test(process.argv[1])) {
  const text = arg("text");
  const file = arg("file");
  if (!text || !file) {
    console.error('usage: tsx scripts/sns/x.ts --text "..." --file 画像パス');
    process.exit(2);
  }
  postWithImage(text, file)
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
