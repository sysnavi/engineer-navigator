// サーバーサイド文字起こし（Speech to Text）。
// Claude APIは音声を受け取れないため、STTだけはOpenAI Whisperを使う。
// LLM呼び出し（client.ts）と同様、外部AIの呼び出し口はここに一元化する。
//
// OPENAI_API_KEY 未設定でもアプリは壊さない: sttEnabled() が false になり、
// クライアント側はネイティブ認識/Web Speech/テキスト入力にフォールバックする
// （ANTHROPIC_API_KEY と同じ「キーが無くても機能自体は失敗させない」流儀）。

const STT_MODEL = "whisper-1";

export function sttEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export class SttError extends Error {
  userMessage: string;
  constructor(userMessage: string) {
    super(`STT failed: ${userMessage}`);
    this.name = "SttError";
    this.userMessage = userMessage;
  }
}

function fileNameFor(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) {
    return "audio.mp4";
  }
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("wav")) return "audio.wav";
  return "audio.webm";
}

/** 音声データを日本語テキストに文字起こしする */
export async function transcribeAudio(
  audio: ArrayBuffer,
  mime: string
): Promise<string> {
  if (!sttEnabled()) {
    throw new SttError("サーバーの文字起こしは現在利用できません");
  }

  const form = new FormData();
  form.append(
    "file",
    new File([audio], fileNameFor(mime), { type: mime || "audio/webm" })
  );
  form.append("model", STT_MODEL);
  form.append("language", "ja");
  form.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`whisper failed (${res.status}):`, detail.slice(0, 500));
    throw new SttError("文字起こしに失敗しました。もう一度どうぞ");
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
