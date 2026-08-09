"use client";

// サーバーSTTフォールバック。ネイティブ認識もWeb Speech APIも使えない環境
// （Firefox等）向けに、MediaRecorderで録音して /api/transcribe に投げる。
// 部分認識テキストは出せない（onPartialは呼ばれない）ので、呼び出し側は
// 「録音中 → 停止 → 文字起こし待ち」のUIにすること。

import type { RecognitionHandle, RecognitionOpts } from "./recognition";

const MAX_RECORD_MS = 60_000;

export function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

let enabledCache: Promise<boolean> | null = null;

/** サーバー側STT（/api/transcribe）が有効かどうか（セッション中キャッシュ） */
export function serverSttEnabled(): Promise<boolean> {
  enabledCache ??= fetch("/api/transcribe", { method: "GET" })
    .then((res) => (res.ok ? res.json() : { enabled: false }))
    .then((d: { enabled?: boolean }) => !!d.enabled)
    .catch(() => false);
  return enabledCache;
}

function pickMimeType(): string {
  // Safari系は webm を録れない。mp4(AAC) を優先候補に含める
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export async function startRecording(
  opts: RecognitionOpts
): Promise<RecognitionHandle> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    opts.onError?.(
      "マイクが許可されていません。ブラウザの設定を確認してください"
    );
    return { stop() {}, cancel() {} };
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined
  );
  const chunks: Blob[] = [];
  let cancelled = false;

  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = async () => {
    release();
    if (cancelled) return;
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    if (blob.size === 0) {
      opts.onFinal("");
      return;
    }
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        opts.onError?.(message || "文字起こしに失敗しました");
        opts.onFinal("");
        return;
      }
      const data = (await res.json()) as { text?: string };
      opts.onFinal((data.text ?? "").trim());
    } catch {
      opts.onError?.("文字起こしに失敗しました。通信環境を確認してください");
      opts.onFinal("");
    }
  };

  recorder.start();
  // 録りっぱなし防止の上限
  const limitTimer = setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, MAX_RECORD_MS);

  return {
    stop: () => {
      clearTimeout(limitTimer);
      if (recorder.state === "recording") recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      clearTimeout(limitTimer);
      if (recorder.state === "recording") recorder.stop();
      else release();
    },
  };
}
