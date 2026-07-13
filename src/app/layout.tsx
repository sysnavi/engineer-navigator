import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engineer Navigator",
  description: "週報からスキルと成長をデータ化する、エンジニアの成長OS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-bold tracking-tight">
              Engineer Navigator
            </Link>
            <div className="flex gap-4 text-sm text-zinc-600">
              <Link href="/report" className="hover:text-zinc-900">
                週報
              </Link>
              <Link href="/skills" className="hover:text-zinc-900">
                スキルマップ
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
