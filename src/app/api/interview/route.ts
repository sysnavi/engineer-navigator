import { getCurrentUser } from "@/lib/auth";
import { chatStream, type ChatMessage } from "@/lib/ai/client";
import { buildInterviewSystem } from "@/lib/ai/interview";

// 週報インタビューの次の質問をストリーミングする。
// 会話はDBに保存しないステートレス設計: クライアントが transcript を毎回送る。
// body: { messages: { role: "user"|"assistant", content: string }[] }

const MAX_MESSAGES = 40;
const MAX_CONTENT = 2000;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.consentedAt) {
    return new Response("週報の利用にはオンボーディングでの同意が必要です", {
      status: 403,
    });
  }

  const { messages } = (await req.json()) as { messages?: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages は必須です", { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return new Response("インタビューが長すぎます。一度まとめてください", {
      status: 400,
    });
  }
  const sane = messages.every(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length <= MAX_CONTENT
  );
  if (!sane) {
    return new Response("messages の形式が不正です", { status: 400 });
  }

  const system = await buildInterviewSystem(user.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await chatStream({
          system,
          messages,
          maxTokens: 400,
          onToken: (delta) => controller.enqueue(encoder.encode(delta)),
        });
      } catch (e) {
        console.error("interview stream failed:", e);
        controller.enqueue(
          encoder.encode(
            "\n\n[質問の生成に失敗しました。ANTHROPIC_API_KEY を確認してください]"
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
