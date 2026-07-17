import type { Metadata } from "next";
import Link from "next/link";
import { DotGothic16 } from "next/font/google";
import { getOptionalUser } from "@/lib/auth";
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
};

const NAV = [
  { href: "/report", label: "週報" },
  { href: "/skills", label: "スキルマップ" },
  { href: "/mentor", label: "メンター" },
  { href: "/plan", label: "学習プラン" },
  { href: "/roleplay", label: "役割演習" },
  { href: "/resume", label: "経歴書" },
  { href: "/discover", label: "発見" },
  { href: "/condition", label: "コンディション", roles: ["SALES", "ADMIN"] },
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
        <header className="no-print sticky top-0 z-10 border-b-[2.5px] border-line8 bg-royal shadow-hard-sm">
          <nav className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2.5">
            <span
              className="mr-1 inline-flex gap-1.5"
              aria-hidden="true"
            >
              <i className="h-3 w-3 rounded-full border-2 border-white bg-pinkhot" />
              <i className="h-3 w-3 rounded-full border-2 border-white bg-lemon" />
            </span>
            <Link
              href="/"
              className="whitespace-nowrap font-pixel text-[15px] tracking-wide text-white"
            >
              EngineerNavigator<span className="text-peri">.exe</span>
            </Link>
            <span className="flex-1" />
            <div className="flex flex-wrap justify-end gap-1 text-[13px]">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="whitespace-nowrap rounded-md border-2 border-transparent px-2.5 py-1 font-bold text-peri hover:border-peri hover:text-white"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
