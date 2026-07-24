import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFullAccount } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { endRoleplay } from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { RoleplayChat } from "./chat";

type Feedback = {
  perObjective: { objective: string; good: string; improve: string }[];
  overall: string;
  advice: string;
  score: number;
};

function scoreColor(n: number): string {
  if (n >= 70) return "var(--good)";
  if (n >= 45) return "var(--warn)";
  return "var(--crit)";
}

export default async function RoleplaySessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireFullAccount();
  const session = await prisma.roleplaySession.findUnique({
    where: { id },
    include: { scenario: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session || session.userId !== user.id) notFound();

  const done = session.status === "COMPLETED";
  let fb: Feedback | null = null;
  if (done && session.feedback) {
    try {
      fb = JSON.parse(session.feedback) as Feedback;
    } catch {
      fb = null;
    }
  }
  const objectives = (session.scenario.objectives as string[]) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <PixelLabel>ROLEPLAY — {done ? "RESULT" : "IN PROGRESS"}</PixelLabel>
          <PixelTitle as="h1" className="text-2xl text-royal">
            {session.scenario.title}
          </PixelTitle>
        </div>
        <Link href="/roleplay" className="btn8 text-[12px]">
          ← 一覧
        </Link>
      </div>

      <p className="rounded-lg border-2 border-dashed border-royal2 bg-quotebg px-4 py-2.5 text-[12.5px] text-inksoft">
        {session.scenario.description}
      </p>

      {done && fb ? (
        <>
          <div className="ach8">
            <div className="flex flex-col items-center">
              <span
                className="font-pixel text-3xl"
                style={{ color: scoreColor(fb.score) }}
              >
                {fb.score}
              </span>
              <span className="font-pixel text-[10px] tracking-wide text-inksoft">
                SCORE
              </span>
            </div>
            <div>
              <div className="font-pixel text-[12px] tracking-[0.1em] text-pinkhot">
                ★ RESULT — 演習おつかれさま
              </div>
              <p className="mt-1 text-[13.5px]">{fb.overall}</p>
            </div>
          </div>

          <Window title="評価" titleEm=".log">
            <ul className="space-y-3">
              {fb.perObjective.map((o, i) => (
                <li
                  key={i}
                  className="rounded-lg border-2 border-line8 bg-surface p-3.5 shadow-hard-sm"
                >
                  <p className="text-[13px] font-extrabold">{o.objective}</p>
                  <p className="mt-1.5 text-[12.5px]">
                    <span className="badge8" style={{ background: "var(--good)", color: "#fff" }}>
                      GOOD
                    </span>{" "}
                    {o.good}
                  </p>
                  <p className="mt-1 text-[12.5px]">
                    <span className="badge8" style={{ background: "var(--warn)", color: "#12235f" }}>
                      NEXT
                    </span>{" "}
                    {o.improve}
                  </p>
                </li>
              ))}
            </ul>
            {fb.advice && (
              <p className="mt-4 rounded-lg border-2 border-line8 bg-surface2 p-3 text-[13px]">
                <span className="font-pixel text-[11px] tracking-wide text-pinkhot">
                  NEXT STEP:{" "}
                </span>
                {fb.advice}
              </p>
            )}
          </Window>

          <details>
            <summary className="cursor-pointer font-pixel text-[11.5px] tracking-wide text-inksoft">
              ▸ 会話ログを見る（{session.messages.length}）
            </summary>
            <div className="mt-3 space-y-2">
              {session.messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-md border-2 border-dashed border-grid8 px-3 py-2 text-[12.5px]"
                >
                  <b className="text-inksoft">
                    {m.role === "USER" ? "あなた" : "相手役"}:
                  </b>{" "}
                  {m.content}
                </div>
              ))}
            </div>
          </details>
        </>
      ) : (
        <Window title="SIMULATION" titleEm=".live" bodyClass="p-4 sm:p-5">
          <RoleplayChat
            sessionId={session.id}
            initial={session.messages.map((m) => ({
              role: m.role as "USER" | "ASSISTANT",
              content: m.content,
            }))}
            endAction={endRoleplay.bind(null, session.id)}
            objectives={objectives}
          />
        </Window>
      )}
    </div>
  );
}
