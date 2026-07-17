import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { ScenarioShuffle } from "./scenario-shuffle";

export default async function RoleplayListPage() {
  const user = await getCurrentUser();
  const [scenarios, sessions] = await Promise.all([
    prisma.roleplayScenario.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        emoji: true,
        title: true,
        description: true,
        domains: true,
      },
    }),
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

      <ScenarioShuffle scenarios={scenarios} userDomains={user.targetDomains} />

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
