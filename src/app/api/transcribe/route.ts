import { getCurrentUser } from "@/lib/auth";
import { sttEnabled, transcribeAudio, SttError } from "@/lib/ai/stt";
import { assertAiAllowed, AiBlockedError } from "@/lib/usage";

// サーバーSTTフォールバック（ボイスインタビュー用）。
// ネイティブ認識もWeb Speech APIも使えない環境が、録音した音声をここに送って
// テキストを受け取る。音声はSTTプロバイダへの中継のみで、DB・ディスクには保存しない
// （発話に顧客名が乗る可能性があるため。「実名をDBに入れない」の決まりと同じ扱い）。
//
// GET は能力プローブ: クライアントがフォールバック可否を判定するのに使う。

const MAX_BYTES = 15 * 1024 * 1024; // 60秒上限の録音には十分

export async function GET() {
  return Response.json({ enabled: sttEnabled() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.consentedAt) {
    return new Response("週報の利用にはオンボーディングでの同意が必要です", {
      status: 403,
    });
  }
  if (!sttEnabled()) {
    return new Response("サーバーの文字起こしは現在利用できません", {
      status: 501,
    });
  }

  const mime = req.headers.get("content-type") ?? "";
  if (!mime.startsWith("audio/")) {
    return new Response("音声データを送ってください", { status: 400 });
  }
  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) {
    return new Response("音声データが空です", { status: 400 });
  }
  if (audio.byteLength > MAX_BYTES) {
    return new Response("音声が長すぎます。60秒以内で話してください", {
      status: 413,
    });
  }

  // スパム・過剰利用対策: 外部APIを叩く前にレート制限・停止をチェック
  try {
    await assertAiAllowed(user.id, "transcribe");
  } catch (e) {
    if (e instanceof AiBlockedError) {
      return new Response(e.userMessage, { status: 429 });
    }
    throw e;
  }

  try {
    const text = await transcribeAudio(audio, mime);
    return Response.json({ text });
  } catch (e) {
    if (e instanceof SttError) {
      return new Response(e.userMessage, { status: 502 });
    }
    throw e;
  }
}
