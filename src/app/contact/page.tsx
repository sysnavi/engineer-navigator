// 問い合わせページ（Issue #9）。未ログインでも開ける（middlewareの除外に追加済み）。
// PII非保持方針のため、返信先メールは原則集めない。詳細は src/lib/inquiry.ts のコメント。

import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { ContactForm } from "./form";

export const metadata = {
  title: "お問い合わせ — Engineer Navigator",
};

export default async function ContactPage() {
  const user = await getOptionalUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <PixelLabel>CONTACT</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          お問い合わせ
        </PixelTitle>
        <p className="mt-1.5 text-[13px] leading-relaxed text-inksoft">
          不具合のご報告・こうしてほしいというご要望をお寄せください。
        </p>
      </div>

      <Window title="CONTACT" titleEm=".exe">
        <ContactForm loggedIn={!!user} />
      </Window>

      <p className="text-center">
        <Link
          href={user ? "/" : "/welcome"}
          className="font-pixel text-[11.5px] tracking-wide text-royal2 hover:text-pinkhot"
        >
          ← {user ? "ホームにもどる" : "トップにもどる"}
        </Link>
      </p>
    </div>
  );
}
