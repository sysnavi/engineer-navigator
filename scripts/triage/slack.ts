// バグトリアージ用の Slack 投稿（Bot Token 方式）。
// 既存の src/lib/notify.ts（Incoming Webhook）は画像を添付できないため、
// トリアージは files:write / chat:write / files:read を持つ Bot で投稿する。
//
// notify.ts と同じ思想で、SLACK_BOT_TOKEN 未設定なら console に出すだけで失敗させない
// （ローカルで dry-run できる）。
//
// CLI:  npx tsx scripts/triage/slack.ts --text "本文" [--file 画像パス] [--thread <ts>]
//       → 標準出力に {"ts": "..."} を出す（スレッド返信に使う）

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const TOKEN = process.env.SLACK_BOT_TOKEN;
// #engineer-navigator（private）。変える場合は環境変数で上書き
export const CHANNEL = process.env.SLACK_TRIAGE_CHANNEL ?? "C0C03HE4H2B";

export type PostResult = { ok: boolean; ts?: string; skipped?: boolean };

async function call<T extends { ok: boolean; error?: string }>(
  method: string,
  body: Record<string, unknown>,
  form = false
): Promise<T> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": form
        ? "application/x-www-form-urlencoded"
        : "application/json; charset=utf-8",
    },
    body: form
      ? new URLSearchParams(
          Object.fromEntries(
            Object.entries(body).map(([k, v]) => [k, String(v)])
          )
        ).toString()
      : JSON.stringify(body),
  });
  const json = (await res.json()) as T;
  if (!json.ok) {
    throw new Error(`Slack ${method} failed: ${json.error ?? res.status}`);
  }
  return json;
}

/** テキスト投稿（画像なし）。threadTs を渡すとスレッド返信になる */
export async function postText(
  text: string,
  threadTs?: string
): Promise<PostResult> {
  if (!TOKEN) {
    console.log(`[slack:console]${threadTs ? " (thread)" : ""} ${text}`);
    return { ok: true, skipped: true };
  }
  const r = await call<{ ok: boolean; ts: string }>("chat.postMessage", {
    channel: CHANNEL,
    text,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  });
  return { ok: true, ts: r.ts };
}

/**
 * 画像付き投稿。files.getUploadURLExternal → アップロード → completeUploadExternal の3段。
 * initial_comment が本文になり、画像がそのメッセージにインライン表示される。
 * 戻り値の ts は files.info の shares から引く（取れなければ undefined）。
 */
export async function postWithFile(
  text: string,
  filePath: string,
  threadTs?: string
): Promise<PostResult> {
  if (!TOKEN) {
    console.log(
      `[slack:console]${threadTs ? " (thread)" : ""} ${text}\n  📎 ${filePath}`
    );
    return { ok: true, skipped: true };
  }
  const bytes = readFileSync(filePath);
  const filename = basename(filePath);

  const up = await call<{ ok: boolean; upload_url: string; file_id: string }>(
    "files.getUploadURLExternal",
    { filename, length: bytes.byteLength },
    true
  );
  const putRes = await fetch(up.upload_url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes,
  });
  if (!putRes.ok) {
    throw new Error(`Slack upload failed: ${putRes.status}`);
  }
  await call("files.completeUploadExternal", {
    files: [{ id: up.file_id, title: filename }],
    channel_id: CHANNEL,
    initial_comment: text,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  });

  // 共有先メッセージの ts を取る（スレッド返信のため）。失敗しても投稿自体は成功扱い
  try {
    const info = await call<{
      ok: boolean;
      file: { shares?: Record<string, Record<string, { ts: string }[]>> };
    }>("files.info", { file: up.file_id }, true);
    for (const scope of Object.values(info.file.shares ?? {})) {
      const list = scope[CHANNEL];
      if (list?.[0]?.ts) return { ok: true, ts: list[0].ts };
    }
  } catch (e) {
    console.warn("[slack] files.info failed (ts unavailable):", e);
  }
  return { ok: true };
}

// ---- CLI ---------------------------------------------------------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && /slack\.ts$/.test(process.argv[1])) {
  const text = arg("text");
  if (!text) {
    console.error(
      'usage: tsx scripts/triage/slack.ts --text "..." [--file path] [--thread ts]'
    );
    process.exit(2);
  }
  const file = arg("file");
  const thread = arg("thread");
  (file ? postWithFile(text, file, thread) : postText(text, thread))
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
