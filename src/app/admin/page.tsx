import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  setUserSuspended,
  createInviteLink,
  revokeInvite,
} from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { AI_LIMITS } from "@/lib/usage";

const ROLE_LABELS: Record<string, string> = {
  ENGINEER: "エンジニア",
  SALES: "営業",
  ADMIN: "管理者",
};

function StatCard(props: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border-[2.5px] border-line8 bg-surface px-4 py-3 shadow-hard-sm">
      <p className="font-pixel text-[10px] tracking-wide text-inksoft">
        {props.label}
      </p>
      <p className="mt-1 font-pixel text-2xl text-royal">{props.value}</p>
      {props.hint && (
        <p className="mt-0.5 text-[10.5px] text-inksoft">{props.hint}</p>
      )}
    </div>
  );
}

export default async function AdminPage() {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") notFound();

  const dayAgo = new Date(new Date().getTime() - 24 * 60 * 60_000);
  const weekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60_000);

  const [users, usage24h, activeWeek, invites] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ suspendedAt: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        handle: true,
        role: true,
        suspendedAt: true,
        suspendReason: true,
        _count: {
          select: {
            reports: true,
            roleplaySessions: true,
            mentorSessions: true,
            studyPlans: true,
          },
        },
      },
    }),
    prisma.aiUsage.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: dayAgo } },
      _count: { _all: true },
    }),
    prisma.aiUsage.findMany({
      where: { createdAt: { gte: weekAgo } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, handle: true } } },
    }),
  ]);

  const usageMap = new Map(usage24h.map((u) => [u.userId, u._count._all]));
  const suspendedCount = users.filter((u) => u.suspendedAt).length;
  const ai24hTotal = usage24h.reduce((s, u) => s + u._count._all, 0);
  const totalReports = users.reduce((s, u) => s + u._count.reports, 0);
  const totalRoleplays = users.reduce((s, u) => s + u._count.roleplaySessions, 0);
  const totalMentors = users.reduce((s, u) => s + u._count.mentorSessions, 0);

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <PixelLabel>ADMIN CONSOLE</PixelLabel>
          <PixelTitle as="h1" className="text-3xl text-royal">
            管理ダッシュボード
          </PixelTitle>
          <p className="mt-1 text-[13px] text-inksoft">
            全ユーザーの活動・利用量の把握と、招待・アカウント管理。
          </p>
        </div>
        <Link href="/mypage" className="btn8 text-[12px]">
          ← マイページ
        </Link>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="USERS" value={users.length} hint="登録ユーザー" />
        <StatCard
          label="ACTIVE 7D"
          value={activeWeek.length}
          hint="週内にAI利用"
        />
        <StatCard
          label="SUSPENDED"
          value={suspendedCount}
          hint="停止中"
        />
        <StatCard label="AI 24H" value={ai24hTotal} hint="呼び出し総数" />
        <StatCard label="REPORTS" value={totalReports} hint="週報 累計" />
        <StatCard
          label="演習/相談"
          value={`${totalRoleplays}/${totalMentors}`}
          hint="役割演習/メンター"
        />
      </div>

      {/* ユーザー分析 + BAN */}
      <Window title="USERS" titleEm=".db">
        <p className="mb-3 text-[12px] text-inksoft">
          「AI/24h」は直近24時間の呼び出し回数。{AI_LIMITS.perDay}回で当日打ち止め・
          {AI_LIMITS.autoSuspendPerDay}回超で自動停止。手動の停止/復帰もここから。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b-2 border-line8 text-left font-pixel text-[10px] tracking-wide text-inksoft">
                <th className="py-2 pr-3">ユーザー</th>
                <th className="px-2">週報</th>
                <th className="px-2">演習</th>
                <th className="px-2">相談</th>
                <th className="px-2">AI/24h</th>
                <th className="px-2">状態</th>
                <th className="px-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const count = usageMap.get(u.id) ?? 0;
                const suspended = !!u.suspendedAt;
                const isSelf = u.id === me.id;
                return (
                  <tr key={u.id} className="border-b border-grid8">
                    <td className="py-2 pr-3">
                      <span className="font-extrabold">
                        {u.handle ?? u.name}
                      </span>
                      <span className="ml-1.5 font-pixel text-[9px] tracking-wide text-inksoft">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-2">{u._count.reports}</td>
                    <td className="px-2">{u._count.roleplaySessions}</td>
                    <td className="px-2">{u._count.mentorSessions}</td>
                    <td
                      className={`px-2 ${count >= AI_LIMITS.perDay ? "font-bold text-pinkhot" : ""}`}
                    >
                      {count}
                    </td>
                    <td className="px-2">
                      {suspended ? (
                        <span className="chip8 chip8-warn">停止中</span>
                      ) : (
                        <span className="chip8 chip8-info">有効</span>
                      )}
                    </td>
                    <td className="px-2 text-right">
                      {!isSelf && (
                        <form
                          action={setUserSuspended.bind(null, u.id, !suspended)}
                          className="inline"
                        >
                          <button
                            className={`btn8 px-2.5 py-1 text-[10px] ${suspended ? "btn8-ok" : ""}`}
                          >
                            {suspended ? "▶ 復帰" : "⛔ 停止"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Window>

      {/* 招待リンク */}
      <Window title="INVITES" titleEm=".cfg">
        <PixelLabel>招待リンク — テスターを追加（個人情報は不要）</PixelLabel>
        <form action={createInviteLink} className="mt-3 flex items-end gap-2">
          <input
            name="note"
            placeholder="目印（任意・例: Aさん用）"
            className="field8"
          />
          <button className="btn8 btn8-start shrink-0 text-[12px]">
            ＋ 発行
          </button>
        </form>
        <div className="mt-3 space-y-2">
          {invites.length === 0 && (
            <p className="text-[12px] text-inksoft">
              まだ招待リンクはありません。上のボタンで発行してください。
            </p>
          )}
          {invites.map((inv) => {
            const revoked = !!inv.revokedAt;
            const joinUrl = `${origin}/join/${inv.token}`;
            return (
              <div
                key={inv.id}
                className="rounded-lg border-2 border-line8 bg-surface px-3 py-2 shadow-hard-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[12.5px] font-bold">
                    {inv.note || "（目印なし）"}
                    {inv.user ? (
                      <span className="ml-1.5 font-pixel text-[10px] text-royal2">
                        使用中: {inv.user.handle ?? inv.user.name}
                      </span>
                    ) : (
                      <span className="ml-1.5 font-pixel text-[10px] text-inksoft">
                        未使用
                      </span>
                    )}
                    {revoked && (
                      <span className="ml-1.5 font-pixel text-[10px] text-pinkhot">
                        失効済み
                      </span>
                    )}
                  </p>
                  {!revoked && (
                    <form action={revokeInvite.bind(null, inv.id)}>
                      <button className="btn8 shrink-0 px-2.5 py-1 text-[10px]">
                        失効
                      </button>
                    </form>
                  )}
                </div>
                {!revoked && (
                  <p className="mt-1 break-all rounded border-2 border-dashed border-grid8 bg-win px-2 py-1 font-pixel text-[10.5px] text-inksoft">
                    {joinUrl}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Window>
    </div>
  );
}
