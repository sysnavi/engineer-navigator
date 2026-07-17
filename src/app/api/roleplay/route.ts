import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chatStream } from "@/lib/ai/client";
import { buildRoleplayMessages } from "@/lib/ai/roleplay";
import { assertAiAllowed, AiBlockedError } from "@/lib/usage";

// ロールプレイの相手役の返信をストリーミングする。
// body: { sessionId, content }

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const { sessionId, content } = (await req.json()) as {
    sessionId?: string;
    content?: string;
  };
  if (!sessionId || !content?.trim()) {
    return new Response("sessionId と content は必須です", { status: 400 });
  }

  const session = await prisma.roleplaySession.findUnique({
    where: { id: sessionId },
    select: { userId: true, status: true },
  });
  if (!session || session.userId !== user.id) {
    return new Response("セッションが見つかりません", { status: 404 });
  }
  if (session.status === "COMPLETED") {
    return new Response("この演習は終了済みです", { status: 409 });
  }

  // スパム・過剰利用対策: トークンを使う前にレート制限・停止をチェック
  try {
    await assertAiAllowed(user.id, "roleplay-chat");
  } catch (e) {
    if (e instanceof AiBlockedError) {
      return new Response(`[${e.userMessage}]`, {
        status: 429,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    throw e;
  }

  await prisma.roleplayMessage.create({
    data: { sessionId, role: "USER", content: content.trim() },
  });

  const { system, messages } = await buildRoleplayMessages(sessionId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { text } = await chatStream({
          system,
          messages,
          maxTokens: 500,
          onToken: (delta) => controller.enqueue(encoder.encode(delta)),
        });
        await prisma.roleplayMessage.create({
          data: { sessionId, role: "ASSISTANT", content: text },
        });
      } catch (e) {
        console.error("roleplay stream failed:", e);
        controller.enqueue(
          encoder.encode("\n\n[応答に失敗しました。ANTHROPIC_API_KEY を確認してください]")
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
