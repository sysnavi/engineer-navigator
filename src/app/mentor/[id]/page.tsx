import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFullAccount } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { MentorChat } from "./chat";

export default async function MentorSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireFullAccount();
  const session = await prisma.mentorSession.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session || session.userId !== user.id) notFound();

  const title = session.certification || session.topic || "相談";

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <PixelLabel>MENTOR.exe — SESSION</PixelLabel>
          <PixelTitle as="h1" className="text-2xl text-royal">
            {title}
          </PixelTitle>
        </div>
        <Link href="/mentor" className="btn8 text-[12px]">
          ← 一覧
        </Link>
      </div>

      <Window title="MENTOR" titleEm=".chat" bodyClass="p-4 sm:p-5">
        <MentorChat
          sessionId={session.id}
          initial={session.messages.map((m) => ({
            role: m.role as "USER" | "ASSISTANT",
            content: m.content,
          }))}
        />
      </Window>
    </div>
  );
}
