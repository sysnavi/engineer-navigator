import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startRoleplay } from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";

export default async function RoleplayListPage() {
  const user = await getCurrentUser();
  const [scenarios, sessions] = await Promise.all([
    prisma.roleplayScenario.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.roleplaySession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { scenario: true, _count: { select: { messages: true } } },
    }),
  ]);

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>ROLEPLAY.exe — {user.name}</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          役割シミュレーター
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          一歩先の役割（リーダーの難題）をAIとロールプレイ。終わると職務定義書ベースで評価が返ります。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {scenarios.map((s) => (
          <Window key={s.id} title="SCENARIO" titleEm=".sim">
            <p className="text-[14px] font-extrabold">{s.title}</p>
            <p className="mt-1.5 min-h-[64px] text-[12.5px] text-inksoft">
              {s.description}
            </p>
            <form
              action={async () => {
                "use server";
                await startRoleplay(s.id);
              }}
              className="mt-2"
            >
              <button className="btn8 btn8-start w-full text-[12px]">
                ▶ START
              </button>
            </form>
          </Window>
        ))}
      </div>

      <Window title="演習の履歴" titleEm={` (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-inksoft">
            まだ演習していません。上のシナリオから始めましょう。
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/roleplay/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border-2 border-line8 bg-surface px-4 py-3 shadow-hard-sm transition-transform hover:-translate-y-0.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-extrabold">
                      {s.scenario.title}
                    </span>
                    <span className="block text-[12px] text-inksoft">
                      {s.createdAt.toISOString().slice(0, 10)} ・ {s._count.messages} 往復
                    </span>
                  </span>
                  <span
                    className={`chip8 shrink-0 ${s.status === "COMPLETED" ? "chip8-info" : "chip8-warn"}`}
                  >
                    {s.status === "COMPLETED" ? "評価済み" : "進行中"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Window>
    </div>
  );
}
