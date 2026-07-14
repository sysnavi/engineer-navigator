import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chatStream } from "@/lib/ai/client";
import { buildMentorMessages } from "@/lib/ai/mentor";

// メンターの返信をストリーミングする。
// body: { sessionId: string, content: string }
// ユーザーメッセージを永続化 → Claudeの返信をtext/plainで逐次返す → 完了時に永続化。

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const { sessionId, content } = (await req.json()) as {
    sessionId?: string;
    content?: string;
  };

  if (!sessionId || !content?.trim()) {
    return new Response("sessionId と content は必須です", { status: 400 });
  }

  const session = await prisma.mentorSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== user.id) {
    return new Response("セッションが見つかりません", { status: 404 });
  }

  // ユーザーメッセージを保存
  await prisma.mentorMessage.create({
    data: { sessionId, role: "USER", content: content.trim() },
  });

  const { system, messages } = await buildMentorMessages(sessionId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { text } = await chatStream({
          system,
          messages,
          onToken: (delta) => controller.enqueue(encoder.encode(delta)),
        });
        await prisma.mentorMessage.create({
          data: { sessionId, role: "ASSISTANT", content: text },
        });
      } catch (e) {
        console.error("mentor stream failed:", e);
        // ANTHROPIC_API_KEY 未設定などでも画面を壊さずメッセージを返す
        controller.enqueue(
          encoder.encode(
            "\n\n[メンターの応答に失敗しました。ANTHROPIC_API_KEY を確認してください]"
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
