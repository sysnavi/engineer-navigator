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
        <PixelLabel>CONTACT — 運営へのご連絡</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          お問い合わせ
        </PixelTitle>
        <p className="mt-1.5 text-[13px] leading-relaxed text-inksoft">
          不具合のご報告・こうしてほしいというご要望をお寄せください。
          {user
            ? "返信はマイページの「運営とのやりとり」に届きます。"
            : "ログインしていただくと、返信をサイト内で受け取れます。"}
        </p>
      </div>

      <Window title="CONTACT" titleEm=".exe">
        <ContactForm loggedIn={!!user} />
      </Window>

      <Window title="PRIVACY" titleEm=".txt">
        <PixelLabel>個人情報について</PixelLabel>
        <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-inksoft">
          <li>
            ・このサイトは<b>メールアドレスや氏名を保存しない方針</b>で作られています。
            問い合わせでも返信先を聞かず、<b>返信はサイト内でお返しします</b>。
          </li>
          <li>
            ・未ログインでのご連絡は<b>サイトに保存せず</b>、運営への通知に流すだけです
            （そのため返信はできません）。
          </li>
          <li>
            ・本文に<b>本名やお客様の会社名などは書かないよう</b>お願いします。
          </li>
        </ul>
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
