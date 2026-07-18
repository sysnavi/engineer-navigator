import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { DotGothic16 } from "next/font/google";
import { getOptionalUser } from "@/lib/auth";
import { recordVisit } from "@/lib/exp";
import { RegisterSW } from "@/components/register-sw";
import { AutosizeTextareas } from "@/components/autosize-textareas";
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

const NAV = [
  { href: "/report", label: "週報" },
  { href: "/skills", label: "スキルマップ" },
  { href: "/mentor", label: "メンター" },
  { href: "/plan", label: "学習プラン" },
  { href: "/quiz", label: "腕試し" },
  { href: "/roleplay", label: "役割演習" },
  { href: "/yomoyama", label: "よもやま" },
  { href: "/resume", label: "経歴書" },
  { href: "/discover", label: "発見" },
  { href: "/condition", label: "コンディション", roles: ["SALES", "ADMIN"] },
  { href: "/admin", label: "管理", roles: ["ADMIN"] },
  { href: "/mypage", label: "マイページ" },
];

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
  if (user) {
    palette = user.palette;
    role = user.role;
    // 訪問EXP: 1日1回だけ記録（skipDuplicatesで2回目以降は何もしない・失敗しても画面は出す）
    await recordVisit(user.id);
  }
  // 未ログイン（/welcome 等）ではナビを出さない
  const nav = loggedIn ? NAV.filter((n) => !n.roles || n.roles.includes(role)) : [];

  return (
    <html
      lang="ja"
      className={`h-full antialiased ${dotGothic.variable}`}
      {...(palette !== "sky" ? { "data-palette": palette } : {})}
    >
      <body className="min-h-full">
        <RegisterSW />
        <AutosizeTextareas />
        <header className="no-print sticky top-0 z-10 border-b-[2.5px] border-line8 bg-royal shadow-hard-sm">
          <div className="mx-auto flex max-w-4xl flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-2">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-pixel text-[15px] tracking-wide text-white"
            >
              <span className="inline-flex gap-1.5" aria-hidden="true">
                <i className="h-3 w-3 rounded-full border-2 border-white bg-pinkhot" />
                <i className="h-3 w-3 rounded-full border-2 border-white bg-lemon" />
              </span>
              EngineerNavigator<span className="text-peri">.exe</span>
            </Link>
            {nav.length > 0 && (
              <nav
                className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-0.5 text-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:ml-auto sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0 sm:pb-0"
                aria-label="メインナビゲーション"
              >
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="shrink-0 whitespace-nowrap rounded-md border-2 border-transparent px-2.5 py-1 font-bold text-peri hover:border-peri hover:text-white"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
