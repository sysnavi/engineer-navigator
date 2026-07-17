import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PALETTES } from "@/lib/palettes";
import {
  setPalette,
  setDevUser,
  updateShareSettings,
  updateTargetDomains,
  setUserSuspended,
  createInviteLink,
  revokeInvite,
  logout,
} from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { ReportToggle } from "./report-toggle";
import { DOMAINS } from "@/lib/domains";
import { AI_LIMITS } from "@/lib/usage";
import { formatWeek } from "@/lib/week";

const ROLE_LABELS: Record<string, string> = {
  ENGINEER: "エンジニア",
  SALES: "営業",
  ADMIN: "管理者",
};

export default async function MyPage() {
  const user = await getCurrentUser();
  const devLogin = process.env.DEV_LOGIN_ENABLED === "true";
  const isAdmin = user.role === "ADMIN";
  const dayAgo = new Date(new Date().getTime() - 24 * 60 * 60_000);
  const [devUsers, submittedReports, adminUsers, usageByUser] =
    await Promise.all([
      devLogin
        ? prisma.user.findMany({ orderBy: { role: "asc" } })
        : Promise.resolve([]),
      prisma.weeklyReport.findMany({
        where: { userId: user.id, status: "SUBMITTED" },
        orderBy: { weekStart: "desc" },
        take: 12,
        select: { id: true, weekStart: true, isPublic: true },
      }),
      isAdmin
        ? prisma.user.findMany({
            orderBy: [{ suspendedAt: "desc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              role: true,
              suspendedAt: true,
              suspendReason: true,
            },
          })
        : Promise.resolve([]),
      isAdmin
        ? prisma.aiUsage.groupBy({
            by: ["userId"],
            where: { createdAt: { gte: dayAgo } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
  const usageMap = new Map(
    usageByUser.map((u) => [u.userId, u._count._all])
  );

  // 招待リンク一覧（管理者のみ）と、リンク組み立て用のオリジン
  const invites = isAdmin
    ? await prisma.invite.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, handle: true } } },
      })
    : [];
  let origin = "";
  if (isAdmin) {
    const h = await headers();
    const host = h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "http";
    origin = host ? `${proto}://${host}` : "";
  }

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>MY PAGE</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          マイページ
        </PixelTitle>
      </div>

      {user.suspendedAt && (
        <div className="rounded-lg border-[2.5px] border-pinkhot bg-quotebg px-4 py-3 shadow-hard-sm">
          <p className="font-pixel text-[13px] tracking-wide text-pinkhot">
            ⛔ ACCOUNT SUSPENDED — アカウント停止中
          </p>
          <p className="mt-1 text-[12.5px] text-ink">
            現在このアカウントではAI機能（週報解析・メンター・役割演習など）をご利用いただけません。
            {user.suspendReason ? `（理由: ${user.suspendReason}）` : ""}
            心当たりがない場合は管理者にご連絡ください。
          </p>
        </div>
      )}

      <Window title="PLAYER" titleEm=".dat">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-lg border-[2.5px] border-line8 bg-surface font-pixel text-2xl text-royal shadow-hard-sm"
            aria-hidden="true"
          >
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold">{user.name}</p>
            <p className="text-[12.5px] text-inksoft">
              {user.email ? `${user.email} ・ ` : ""}
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
            <p className="mt-0.5 font-pixel text-[11px] tracking-wide text-inksoft">
              {user.consentedAt
                ? `CONSENT ✓ ${user.consentedAt.toISOString().slice(0, 10)}（AI解析・閲覧範囲・評価不使用に同意済み）`
                : "CONSENT — 未同意（週報の初回起動時に確認します）"}
            </p>
          </div>
          <form action={logout}>
            <button className="btn8 shrink-0 px-3 py-1.5 text-[11px]">
              ログアウト
            </button>
          </form>
        </div>
      </Window>

      {/* 目指す技術領域（キャリアの方向性） */}
      <Window title="GOAL" titleEm=".cfg">
        <PixelLabel>目指す領域 — 伸ばしたいロールを選ぶ</PixelLabel>
        <p className="mt-2 text-[12.5px] text-inksoft">
          何を目指すか（複数可）で、メンターの提案や役割演習のアドバイスがその方向に寄ります。
        </p>
        <form action={updateTargetDomains} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {DOMAINS.map((d) => {
              const on = user.targetDomains.includes(d.id);
              return (
                <label key={d.id} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="domains"
                    value={d.id}
                    defaultChecked={on}
                    className="peer sr-only"
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-lg border-[2.5px] border-line8 bg-surface px-3 py-1.5 text-[12.5px] font-bold text-ink shadow-hard-sm transition-transform peer-checked:bg-royal peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-pinkhot">
                    <span aria-hidden="true">{d.emoji}</span>
                    {d.label}
                  </span>
                </label>
              );
            })}
          </div>
          <button className="btn8 btn8-start text-[12px]">▶ 保存</button>
        </form>
      </Window>

      {/* 公開共有の設定 */}
      <Window title="SHARE" titleEm=".cfg">
        <PixelLabel>PUBLIC PROFILE — 成長を公開して学び合う</PixelLabel>
        <form action={updateShareSettings} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-extrabold">
                ハンドル（公開URL用・ペンネーム可）
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-pixel text-[12px] text-inksoft">
                  /u/
                </span>
                <input
                  name="handle"
                  defaultValue={user.handle ?? ""}
                  placeholder="tsuyoshi_dev"
                  className="field8"
                />
              </div>
              <p className="mt-1 text-[11px] text-inksoft">
                半角英数字・ハイフン・アンダースコア 3〜20文字
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-extrabold">
                自己紹介（任意）
              </label>
              <textarea
                name="bio"
                rows={2}
                defaultValue={user.bio ?? ""}
                placeholder="例: SESでバックエンド中心。AWSと生成AI活用を勉強中。"
                className="field8"
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-[13px] font-bold">
            <input
              type="checkbox"
              name="isPublic"
              defaultChecked={user.isPublic}
              className="h-4 w-4 accent-[var(--pink-hot)]"
            />
            プロフィールを公開する（発見ページに載り、/u/ハンドル で見られます）
          </label>
          <p className="rounded-lg border-2 border-dashed border-royal2 bg-quotebg px-3 py-2 text-[11.5px] text-inksoft">
            🔒 公開されるのは<b>スキル・成長の道筋・実績・演習</b>と、あなたが個別に公開指定した週報の「やったこと／新技術／来週」だけです。
            <b>コンディション（気分・稼働・詰まり・メンター相談）は公開されません。</b>
          </p>
          <div className="flex items-center gap-3">
            <button className="btn8 btn8-start">▶ 保存</button>
            {user.isPublic && user.handle && (
              <Link
                href={`/u/${user.handle}`}
                className="font-pixel text-[11px] tracking-wide text-royal2 hover:text-pinkhot"
              >
                公開ページを見る →
              </Link>
            )}
          </div>
        </form>

        {submittedReports.length > 0 && (
          <div className="mt-5">
            <PixelLabel className="mb-2">週報の公開</PixelLabel>
            <div className="space-y-2">
              {submittedReports.map((r) => (
                <ReportToggle
                  key={r.id}
                  id={r.id}
                  label={`${formatWeek(r.weekStart)} の週報`}
                  initial={r.isPublic}
                />
              ))}
            </div>
          </div>
        )}
      </Window>

      <Window title="PALETTE" titleEm=".cfg">
        <div className="space-y-4">
          <p className="text-[12.5px] text-inksoft">
            セーブスロットを選ぶと全画面が着せ替わります。ホットピンク（実行ボタン）とレモン（バッジ）はどのパレットでも共通です。
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PALETTES.map((p) => {
              const active = p.id === user.palette;
              return (
                <form
                  key={p.id}
                  action={async () => {
                    "use server";
                    await setPalette(p.id);
                  }}
                >
                  <button
                    className={`flex w-full flex-col items-start gap-2 rounded-lg border-[2.5px] border-line8 p-3 text-left font-pixel text-[13px] tracking-wide shadow-hard-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                      active ? "bg-royal text-white" : "bg-surface text-ink"
                    }`}
                    aria-pressed={active}
                  >
                    <span className="flex gap-1" aria-hidden="true">
                      {p.swatches.map((c) => (
                        <i
                          key={c}
                          className="block h-4 w-4 rounded border-2 border-line8"
                          style={{ background: c }}
                        />
                      ))}
                    </span>
                    {p.name}
                    {active && " ★"}
                    <span
                      className={`font-sans text-[11px] ${active ? "text-peri" : "text-inksoft"}`}
                    >
                      {p.desc}
                    </span>
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      </Window>

      {isAdmin && (
        <Window title="ADMIN" titleEm=".sys">
          <PixelLabel>
            アカウント管理 — スパム・過剰なAI利用への対応
          </PixelLabel>
          <p className="mt-2 text-[12px] text-inksoft">
            「本日」は直近24時間のAI呼び出し回数。1日{AI_LIMITS.perDay}回で自動的に当日打ち止め、
            {AI_LIMITS.autoSuspendPerDay}回を超えると自動停止します。手動での停止・復帰もできます。
          </p>
          <div className="mt-3 space-y-2">
            {adminUsers.map((u) => {
              const count = usageMap.get(u.id) ?? 0;
              const suspended = !!u.suspendedAt;
              const isSelf = u.id === user.id;
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-lg border-2 border-line8 bg-surface px-3 py-2 shadow-hard-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold">
                      {u.name}
                      <span className="ml-1.5 font-pixel text-[10px] tracking-wide text-inksoft">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </p>
                    <p className="text-[11.5px] text-inksoft">
                      本日 {count} 回
                      {suspended && (
                        <span className="ml-1.5 text-pinkhot">
                          ・停止中
                          {u.suspendReason ? `（${u.suspendReason}）` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  {!isSelf && (
                    <form
                      action={setUserSuspended.bind(null, u.id, !suspended)}
                    >
                      <button
                        className={`btn8 shrink-0 px-3 py-1.5 text-[11px] ${
                          suspended ? "btn8-ok" : ""
                        }`}
                      >
                        {suspended ? "▶ 復帰" : "⛔ 停止"}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <PixelLabel className="mb-2">
              招待リンク — テスターを追加（個人情報は不要）
            </PixelLabel>
            <form
              action={createInviteLink}
              className="flex items-end gap-2"
            >
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
          </div>
        </Window>
      )}

      {devLogin && (
        <Window title="DEBUG" titleEm=".sys">
          <PixelLabel className="!text-inksoft">
            DEV ONLY — ユーザー切替（本番はGoogle SSOに置換）
          </PixelLabel>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {devUsers
              .filter((u) => u.email)
              .map((u) => (
              <form
                key={u.id}
                action={async () => {
                  "use server";
                  await setDevUser(u.email!);
                }}
              >
                <button
                  className={`btn8 px-4 py-2 text-[12px] ${
                    u.id === user.id ? "btn8-ok" : ""
                  }`}
                >
                  {u.name}（{ROLE_LABELS[u.role] ?? u.role}）
                  {u.id === user.id && " ★"}
                </button>
              </form>
            ))}
          </div>
        </Window>
      )}
    </div>
  );
}
