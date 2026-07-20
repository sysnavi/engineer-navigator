import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PALETTES } from "@/lib/palettes";
import {
  setPalette,
  setUiShell,
  setDevUser,
  updateDisplayName,
  updateShareSettings,
  updateTargetDomains,
  logout,
} from "@/app/actions";
import { resolveShell } from "@/lib/shell";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { ReportToggle } from "./report-toggle";
import { InheritPanel } from "./inherit-panel";
import { DOMAINS } from "@/lib/domains";
import { ReplayTutorialButton } from "@/components/replay-tutorial";
import { InquiryThread } from "@/components/inquiry-thread";
import {
  enabledProviders,
  PROVIDER_LABELS,
  type OAuthProvider,
} from "@/lib/oauth";
import { formatWeek } from "@/lib/week";
import {
  getPlayerStats,
  getLineage,
  BEQUEST_RATE,
  REBIRTH_MIN_LEVEL,
} from "@/lib/exp";
import { PixelAvatar } from "@/components/pixel-avatar";

// 家系図の実績ハイライト用ラベル（EXPソース→日本語）
const COUNT_LABELS: Record<string, string> = {
  report: "週報",
  quizAuthored: "作問",
  roleplayCompleted: "演習",
  quizAttempt: "腕試し",
  quizRated: "評価",
  mentorSession: "相談",
  planCreated: "プラン",
  yomoyamaPost: "よもやま",
  suggestionApproved: "スキル承認",
};

const ROLE_LABELS: Record<string, string> = {
  ENGINEER: "エンジニア",
  SALES: "営業",
  ADMIN: "管理者",
};

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; oauth_error?: string }>;
}) {
  const user = await getCurrentUser();
  const { linked, oauth_error } = await searchParams;
  const devLogin = process.env.DEV_LOGIN_ENABLED === "true";
  const isAdmin = user.role === "ADMIN";
  const [devUsers, submittedReports, player, lineage, identities, inquiries] =
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
      getPlayerStats(user.id),
      getLineage(user.id),
      prisma.authIdentity.findMany({
        where: { userId: user.id },
        select: { provider: true, createdAt: true },
      }),
      prisma.inquiry.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
  // 運営とのやりとり（Issue #9）。返信はメールでなくマイページに届く
  const inquiryItems = inquiries.map((q) => ({
    id: q.id,
    category: q.category,
    body: q.body,
    status: q.status,
    adminReply: q.adminReply,
    createdAt: q.createdAt.toISOString().slice(0, 10),
    repliedAt: q.repliedAt ? q.repliedAt.toISOString().slice(0, 10) : null,
    unread: !!q.adminReply && !q.readAt,
  }));
  const unreadReplies = inquiryItems.filter((q) => q.unread).length;
  const linkableProviders = enabledProviders().filter(
    (p) => !identities.some((i) => i.provider === p)
  );

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
            <form
              action={updateDisplayName}
              className="flex items-center gap-1.5"
            >
              <input
                name="name"
                defaultValue={user.name}
                maxLength={40}
                required
                aria-label="表示名"
                className="field8 min-w-0 flex-1 py-1 text-[15px] font-extrabold"
              />
              <button className="btn8 shrink-0 px-2.5 py-1 text-[11px]">
                保存
              </button>
            </form>
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
          <div className="flex shrink-0 flex-col gap-1.5">
            {isAdmin && (
              <Link
                href="/admin"
                className="btn8 btn8-ok px-3 py-1.5 text-center text-[11px]"
              >
                管理ダッシュボード
              </Link>
            )}
            <ReplayTutorialButton />
            <form action={logout}>
              <button className="btn8 w-full px-3 py-1.5 text-[11px]">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </Window>

      {/* 運営とのやりとり（Issue #9）: 返信はメールでなくここに届く */}
      <Window title="SUPPORT" titleEm=".log" barClass={unreadReplies > 0 ? "!bg-pinkhot" : ""}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PixelLabel className={unreadReplies > 0 ? "!text-pinkhot" : ""}>
            運営とのやりとり
            {unreadReplies > 0 && ` — あたらしい返信が ${unreadReplies} 件`}
          </PixelLabel>
          <Link href="/contact" className="btn8 px-3 py-1.5 text-[11.5px]">
            ＋ 問い合わせる
          </Link>
        </div>
        <div className="mt-3">
          <InquiryThread items={inquiryItems} />
        </div>
      </Window>

      {/* ログイン連携（Issue #8）: OAuthの後付けリンク。PIIはハッシュのみ */}
      <Window title="AUTH" titleEm=".cfg">
        <PixelLabel>ログイン連携 — 端末が変わっても同じアカウントで</PixelLabel>
        {linked && (
          <p className="mt-2 rounded-lg border-2 border-line8 bg-quotebg px-3 py-1.5 font-pixel text-[11px] text-royal">
            ✓ 連携しました！次からこのアカウントでログインできます
          </p>
        )}
        {oauth_error === "already-linked" && (
          <p className="mt-2 rounded-lg border-2 border-pinkhot bg-quotebg px-3 py-1.5 text-[12px] text-ink">
            そのアカウントは既に別のユーザーに連携されています。
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {identities.map((i) => (
            <span
              key={i.provider}
              className="rounded-md border-2 border-line8 bg-surface px-2.5 py-1 font-pixel text-[11px]"
            >
              ✓ {PROVIDER_LABELS[i.provider as OAuthProvider] ?? i.provider} 連携済み
            </span>
          ))}
          {linkableProviders.map((p) => (
            <a
              key={p}
              href={`/api/auth/${p}/start`}
              className="btn8 px-3 py-1.5 text-[11px]"
            >
              ＋ {PROVIDER_LABELS[p]} を連携
            </a>
          ))}
          {identities.length === 0 && linkableProviders.length === 0 && (
            <span className="text-[12px] text-inksoft">
              現在利用できる連携先がありません（管理者がOAuth設定を行うと表示されます）。
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] text-inksoft">
          連携時にメールアドレスや名前は受け取りません。保存されるのは復元不能なハッシュだけです。
          招待リンクで始めた方も、連携しておくとリンクを失くしてもログインできます。
        </p>
      </Window>

      {/* アバター継承（転生）: 卵を産んで遺伝子を受け継ぐ（Issue #1） */}
      <Window title="INHERIT" titleEm=".sys">
        <PixelLabel>INHERIT — 継承（転生）と家系図</PixelLabel>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-lg border-[2.5px] border-line8 bg-surface">
            <PixelAvatar
              sprite={player.stage.sprite}
              px={6}
              accent={player.genes?.dominant.color}
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <p className="font-pixel text-[13px] tracking-wide text-royal">
              第{player.generation}世代 — Lv {player.level}・{player.stage.name}
            </p>
            {player.genes ? (
              <p className="mt-1 text-[12.5px]">
                遺伝子:{" "}
                <b style={{ color: player.genes.dominant.color }}>
                  {player.genes.dominant.name}
                </b>
                {player.genes.recessive && (
                  <>
                    {" "}
                    ×{" "}
                    <b style={{ color: player.genes.recessive.color }}>
                      {player.genes.recessive.name}
                    </b>
                  </>
                )}
                <span className="ml-1.5 rounded-md border-2 border-line8 bg-quotebg px-1.5 py-0.5 font-pixel text-[10.5px]">
                  {player.genes.title}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-[12.5px] text-inksoft">
                初代。マイスター（Lv{REBIRTH_MIN_LEVEL}）に到達すると「卵を産む」が解放され、
                遺伝子と遺産を次の世代へ受け継げます。
                <b>継承でしか出会えない姿</b>（けんじゃ・でんせつ…）も。
              </p>
            )}
            <p className="mt-1 text-[11.5px] text-inksoft">
              生涯EXP {player.lifetimeExp}（積み上げは転生しても消えません）
            </p>
          </div>
          <InheritPanel
            canRebirth={player.canRebirth}
            level={player.level}
            minLevel={REBIRTH_MIN_LEVEL}
            generation={player.generation}
            stageName={player.stage.name}
            bequestPreview={Math.round(player.exp * BEQUEST_RATE)}
          />
        </div>

        {lineage.length > 0 && (
          <div className="mt-5">
            <PixelLabel className="mb-2">FAMILY TREE — 家系図</PixelLabel>
            <div className="space-y-2">
              {lineage.map((g) => {
                const highlights = Object.entries(g.counts)
                  .filter(([k, n]) => n > 0 && COUNT_LABELS[k])
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3);
                return (
                  <div
                    key={g.gen}
                    className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2"
                  >
                    <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-md border-2 border-line8 bg-win">
                      <PixelAvatar
                        sprite={g.spriteAtEnd}
                        px={4}
                        accent={g.dominant?.color}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-pixel text-[11.5px] tracking-wide">
                        第{g.gen}世代 — Lv{g.levelAtEnd}・{g.stageAtEnd}で卵を産む
                        <span className="ml-2 text-inksoft">
                          {g.endedAt.toISOString().slice(0, 10)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-inksoft">
                        {g.dominant && (
                          <b style={{ color: g.dominant.color }}>
                            {g.dominant.short}
                          </b>
                        )}
                        {g.recessive && (
                          <>
                            ×
                            <b style={{ color: g.recessive.color }}>
                              {g.recessive.short}
                            </b>
                          </>
                        )}
                        {highlights.length > 0 && (
                          <>
                            {" ｜ "}
                            {highlights
                              .map(([k, n]) => `${COUNT_LABELS[k]}×${n}`)
                              .join("・")}
                          </>
                        )}
                        {" ｜ "}この世代のEXP {g.expInGen} ／ 遺産 +{g.bequest}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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

      {/* UIモード: デスクトップ/クラシックの切替（旧UIは削除せず選べるモードとして共存） */}
      <Window title="SHELL" titleEm=".cfg">
        <PixelLabel>UIモード — 画面の骨格を選ぶ</PixelLabel>
        <p className="mt-2 text-[12.5px] text-inksoft">
          「デスクトップ」はレトロOS風（アイコン＋下部スタートメニュー）、「クラシック」は従来の上部ナビ表示です。いつでも戻せます。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(
            [
              { id: "desktop", name: "デスクトップ", desc: "アイコンとスタートメニューのOS風" },
              { id: "classic", name: "クラシック", desc: "従来の上部ナビとタイル表示" },
            ] as const
          ).map((m) => {
            const active = resolveShell(user) === m.id;
            return (
              <form
                key={m.id}
                action={async () => {
                  "use server";
                  await setUiShell(m.id);
                }}
              >
                <button
                  className={`flex w-full flex-col items-start gap-1 rounded-lg border-[2.5px] border-line8 p-3 text-left font-pixel text-[13px] tracking-wide shadow-hard-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                    active ? "bg-royal text-white" : "bg-surface text-ink"
                  }`}
                  aria-pressed={active}
                >
                  {m.name}
                  {active && " ★"}
                  <span
                    className={`font-sans text-[11px] ${active ? "text-peri" : "text-inksoft"}`}
                  >
                    {m.desc}
                  </span>
                </button>
              </form>
            );
          })}
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
