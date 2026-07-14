import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PALETTES } from "@/lib/palettes";
import { setPalette, setDevUser } from "@/app/actions";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";

const ROLE_LABELS: Record<string, string> = {
  ENGINEER: "エンジニア",
  SALES: "営業",
  ADMIN: "管理者",
};

export default async function MyPage() {
  const user = await getCurrentUser();
  const devLogin = process.env.DEV_LOGIN_ENABLED === "true";
  const devUsers = devLogin
    ? await prisma.user.findMany({ orderBy: { role: "asc" } })
    : [];

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>MY PAGE</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          マイページ
        </PixelTitle>
      </div>

      <Window title="PLAYER" titleEm=".dat">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-lg border-[2.5px] border-line8 bg-surface font-pixel text-2xl text-royal shadow-hard-sm"
            aria-hidden="true"
          >
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="text-[15px] font-extrabold">{user.name}</p>
            <p className="text-[12.5px] text-inksoft">
              {user.email} ・ {ROLE_LABELS[user.role] ?? user.role}
            </p>
            <p className="mt-0.5 font-pixel text-[11px] tracking-wide text-inksoft">
              {user.consentedAt
                ? `CONSENT ✓ ${user.consentedAt.toISOString().slice(0, 10)}（AI解析・閲覧範囲・評価不使用に同意済み）`
                : "CONSENT — 未同意（週報の初回起動時に確認します）"}
            </p>
          </div>
        </div>
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

      {devLogin && (
        <Window title="DEBUG" titleEm=".sys">
          <PixelLabel className="!text-inksoft">
            DEV ONLY — ユーザー切替（本番はGoogle SSOに置換）
          </PixelLabel>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {devUsers.map((u) => (
              <form
                key={u.id}
                action={async () => {
                  "use server";
                  await setDevUser(u.email);
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
