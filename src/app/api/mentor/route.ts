import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chatStream } from "@/lib/ai/client";
import { buildMentorMessages } from "@/lib/ai/mentor";
import { searchLearningChunks, formatContextBlock } from "@/lib/ai/retrieval";
import { assertAiAllowed, AiBlockedError } from "@/lib/usage";

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

  // スパム・過剰利用対策: トークンを使う前にレート制限・停止をチェック
  try {
    await assertAiAllowed(user.id, "mentor-chat");
  } catch (e) {
    if (e instanceof AiBlockedError) {
      return new Response(`[${e.userMessage}]`, {
        status: 429,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    throw e;
  }

  // ユーザーメッセージを保存
  await prisma.mentorMessage.create({
    data: { sessionId, role: "USER", content: content.trim() },
  });

  const { system, messages } = await buildMentorMessages(sessionId);

  // RAG: 学習コンテンツから関連チャンクを検索し system に差し込む。
  // VOYAGE_API_KEY 未設定・該当なしなら空文字（メンターは知識ベースのみで回答）。
  const chunks = await searchLearningChunks(content.trim());
  const systemWithContext = system + formatContextBlock(chunks);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { text } = await chatStream({
          system: systemWithContext,
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
