import type { Metadata, Viewport } from "next";
import { DotGothic16 } from "next/font/google";
import { getOptionalUser } from "@/lib/auth";
import { recordVisit, getPlayerStats } from "@/lib/exp";
import { getDungeonState } from "@/lib/dungeon/run";
import { resolveShell } from "@/lib/shell";
import { appsForRole, resolveDock } from "@/lib/apps";
import { RegisterSW } from "@/components/register-sw";
import { AutosizeTextareas } from "@/components/autosize-textareas";
import { Tutorial } from "@/components/tutorial";
import { TipsToast } from "@/components/tips-toast";
import { Toaster } from "@/components/toast";
import { Taskbar } from "@/components/shell/taskbar";
import { GuardedLink } from "@/components/nav-guard";
import { Visitor } from "@/components/pets/visitor";
import { PresenceHint } from "@/components/pets/presence-hint";
import {
  ensureTodayEncounter,
  getPendingVisitor,
  getPresenceHint,
} from "@/lib/pets/encounter";
import "./globals.css";

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Engineer Navigator",
  description: "週報からスキルと成長をデータ化する、エンジニアの成長OS",
  manifest: "/manifest.webmanifest",
  applicationName: "Engineer Navigator",
  appleWebApp: {
    capable: true,
    title: "EngNavi",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#004aad",
  // キーボード出現時はレイアウトを縮めてリサイズ（Android Chromeのガタつき軽減）
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // きせかえパレット: ユーザー設定をSSRで<html>に刻む（チラつき防止）。
  // 未ログイン/未シード時はデフォルトにフォールバック。
  let palette = "sky";
  let role = "ENGINEER";
  const user = await getOptionalUser();
  const loggedIn = !!user;
  let visitor: Awaited<ReturnType<typeof getPendingVisitor>> = null;
  let presence: Awaited<ReturnType<typeof getPresenceHint>> = null;
  if (user) {
    palette = user.palette;
    role = user.role;
    // 訪問EXP: 1日1回だけ記録（skipDuplicatesで2回目以降は何もしない・失敗しても画面は出す）
    await recordVisit(user.id);
    // レアキャラ来訪（Issue #2）: きょうの抽選を確定→PENDINGならフローティング表示。
    // 来訪者がいない日は「気配」（あしあと）で翌日への引きを作る
    try {
      await ensureTodayEncounter(user.id);
      visitor = await getPendingVisitor(user.id);
      if (!visitor) presence = await getPresenceHint(user.id);
    } catch (e) {
      console.error("encounter check failed:", e);
    }
  }
  // ナビの項目は src/lib/apps.ts（機能レジストリ）から。未ログイン（/welcome 等）では出さない
  const nav = loggedIn ? appsForRole(role) : [];
  // 新規期間（登録3日以内）。TIPSの頻度と内容を切り替える材料（Issue #20）
  const isNewcomer =
    !!user && new Date().getTime() - user.createdAt.getTime() < 3 * 86400_000;
  // UIシェル: desktop（レトロOSデスクトップ・下部タスクバー）/ classic（従来の上部ナビ）。
  // 切替はマイページの「UIモード」または UI_SHELL_DEFAULT（ロールバックはgitでなくこの設定で）
  const shell = loggedIn ? resolveShell(user) : "classic";
  const shellData =
    shell === "desktop" && user
      ? await (async () => {
          const [stats, dungeon] = await Promise.all([
            getPlayerStats(user.id),
            getDungeonState(user.id),
          ]);
          return {
            player: {
              displayName: user.handle ?? user.name,
              sprite: stats.stage.sprite,
              accent: stats.genes?.dominant.color,
              level: stats.level,
              stageName: stats.stage.name,
              generation: stats.generation,
              geneTitle: stats.genes?.title ?? null,
            },
            dungeonOk: dungeon.canDive,
            streak: stats.currentStreak,
          };
        })()
      : null;

  return (
    <html
      lang="ja"
      className={`h-full antialiased ${dotGothic.variable}`}
      {...(palette !== "sky" ? { "data-palette": palette } : {})}
    >
      {/* data-shell: .chat-dock がタスクバーの有無で下端位置を変えるために参照 */}
      <body className="min-h-full" data-shell={shell}>
        <RegisterSW />
        <AutosizeTextareas />
        {loggedIn && (
          <Tutorial
            defaultOpen={!user?.tutorialCompletedAt}
            guest={role === "GUEST"}
          />
        )}
        {/* TIPS（Issue #20）: チュートリアル完了者のみ（初日はチュートリアルと被せない）。
            ゲストは専用ツアーがあり、TIPSは行けない機能に誘導するので出さない。
            設定でオフにした人にも出さない。新規期間(登録3日以内)は頻度と内容を変える。 */}
        {loggedIn &&
          user?.tutorialCompletedAt &&
          role !== "GUEST" &&
          user.tipsEnabled && <TipsToast newcomer={isNewcomer} />}
        <Toaster />{/* 保存/送信結果（右上）。発火は notify / ActionForm */}
        {shell === "classic" && (
          <header className="no-print sticky top-0 z-10 border-b-[2.5px] border-line8 bg-royal shadow-hard-sm">
            <div className="mx-auto flex max-w-4xl flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-2">
              <GuardedLink
                href="/"
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-pixel text-[15px] tracking-wide text-white"
              >
                <span className="inline-flex gap-1.5" aria-hidden="true">
                  <i className="h-3 w-3 rounded-full border-2 border-white bg-pinkhot" />
                  <i className="h-3 w-3 rounded-full border-2 border-white bg-lemon" />
                </span>
                EngineerNavigator<span className="text-peri">.exe</span>
              </GuardedLink>
              {nav.length > 0 && (
                <nav
                  className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-0.5 text-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:ml-auto sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0 sm:pb-0"
                  aria-label="メインナビゲーション"
                >
                  {nav.map((n) => (
                    <GuardedLink
                      key={n.href}
                      href={n.href}
                      className="shrink-0 whitespace-nowrap rounded-md border-2 border-transparent px-2.5 py-1 font-bold text-peri hover:border-peri hover:text-white"
                    >
                      {n.name}
                    </GuardedLink>
                  ))}
                </nav>
              )}
            </div>
          </header>
        )}
        <main
          className={`mx-auto max-w-4xl px-4 py-6 sm:py-8 ${
            shell === "desktop" ? "pb-24 sm:pb-24" : ""
          }`}
        >
          {children}
        </main>
        {shell === "desktop" && shellData && (
          <Taskbar
            apps={nav}
            dock={resolveDock(role, user?.dockApps ?? [])}
            player={shellData.player}
            dungeonOk={shellData.dungeonOk}
            streak={shellData.streak}
          />
        )}
        {visitor && (
          <Visitor
            encounterId={visitor.encounterId}
            speciesId={visitor.species.id}
            aiEnabled={!!process.env.ANTHROPIC_API_KEY}
            revisit={visitor.revisit}
          />
        )}
        {!visitor && presence && <PresenceHint kind={presence} />}
      </body>
    </html>
  );
}
