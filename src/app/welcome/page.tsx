import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { enabledProviders, PROVIDER_LABELS } from "@/lib/oauth";
import { PixelAvatar } from "@/components/pixel-avatar";

// 公開ランディング。ログイン手段は OAuth（Google/GitHub・PIIゼロ）と招待リンクの併存。

// ヒーローに並べる進化段階（src/lib/exp.ts の STAGES から代表を抜粋）。
// 画像ではなく実際のスプライトを描くので、アバターを更新すればここも自動で揃う。
const HERO_STAGES = [
  { sprite: "egg", name: "たまご" },
  { sprite: "chick", name: "ひよこ" },
  { sprite: "minarai", name: "みならい" },
  { sprite: "ichininmae", name: "いちにんまえ" },
  { sprite: "meister", name: "マイスター" },
];

// 「何ができるか」を3枚で。機能名の羅列ではなく、行動→見返りの形で書く。
const FEATURES = [
  {
    title: "書けば、経歴書になる",
    body: "今週やったことを5分書くだけ。AIがスキルを見つけ、経歴書が育ちます。",
    tag: "週報 → スキル → 経歴書",
  },
  {
    title: "解けば、腕が上がる",
    body: "現場で使える四択の良問バンク。解くのも作るのもEXPになります。",
    tag: "腕試し / 良問バンク",
  },
  {
    title: "潜れば、戦利品が増える",
    body: "育てたアバターがフルオートでダンジョンを探索。持ち帰ったガジェットはマイホームに飾れます。",
    tag: "ダンジョン / マイホーム",
  },
];

const OAUTH_ERRORS: Record<string, string> = {
  state: "確認情報が一致しませんでした。もう一度お試しください。",
  denied: "ログインがキャンセルされました。",
  exchange: "プロバイダとの通信に失敗しました。時間をおいてお試しください。",
  provider: "このログイン方法は現在利用できません。",
};

// SNSからの流入が主戦場なので、このページ固有のOGPを持たせる（Issue #15）。
// カード画像は opengraph-image.tsx で動的生成。
export const metadata = {
  title: "がんばりは、ぜんぶ経験値になる。— Engineer Navigator",
  description:
    "週報・腕試し・ダンジョン。エンジニアの日々のがんばりがEXPになって、アバターとスキルマップと経歴書が同時に育つ。メールも本名も不要、登録なしで試せます。",
  openGraph: {
    title: "がんばりは、ぜんぶ経験値になる。",
    description:
      "週報を書く。四択を解く。現場の話をシェアする。その全部がEXPになって、あなたのアバターが育つ。",
    siteName: "Engineer Navigator",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{
    invalid?: string;
    oauth_error?: string;
    guest?: string;
  }>;
}) {
  const { invalid, oauth_error, guest } = await searchParams;
  const providers = enabledProviders();

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      {/* ヒーロー（Issue #15）。スクショ画像を置かず、実際のアバターを
          そのまま並べている — 画像素材の管理が要らず、世界観とも一致する。 */}
      <div className="text-center">
        <PixelLabel>ENGINEER NAVIGATOR</PixelLabel>
        <PixelTitle as="h1" className="mt-1 text-[28px] leading-tight text-royal sm:text-3xl">
          がんばりは、
          <br className="sm:hidden" />
          ぜんぶ経験値になる。
        </PixelTitle>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink">
          週報を書く。四択を解く。現場の話をシェアする。
          <br />
          その全部がEXPになって、<b>あなたのアバターが育つ</b>。
        </p>

        <div className="mt-5 flex items-end justify-center gap-1.5 sm:gap-3">
          {HERO_STAGES.map((s, i) => (
            <div key={s.sprite} className="flex flex-col items-center gap-1">
              <PixelAvatar sprite={s.sprite} px={i === HERO_STAGES.length - 1 ? 4 : 3} />
              <span className="font-pixel text-[9px] tracking-wide text-inksoft sm:text-[10px]">
                {s.name}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 font-pixel text-[10px] tracking-wide text-royal2">
          LV.1 → LV.12 … その先は「継承」へ
        </p>
      </div>

      {invalid && (
        <div className="rounded-lg border-[2.5px] border-pinkhot bg-quotebg px-4 py-3">
          <p className="font-pixel text-[12px] tracking-wide text-pinkhot">
            ⚠ INVALID LINK
          </p>
          <p className="mt-1 text-[12.5px] text-ink">
            この招待リンクは無効か、失効しています。発行者にご確認ください。
          </p>
        </div>
      )}
      {oauth_error && (
        <div className="rounded-lg border-[2.5px] border-pinkhot bg-quotebg px-4 py-3">
          <p className="font-pixel text-[12px] tracking-wide text-pinkhot">
            ⚠ LOGIN ERROR
          </p>
          <p className="mt-1 text-[12.5px] text-ink">
            {OAUTH_ERRORS[oauth_error] ?? OAUTH_ERRORS.exchange}
          </p>
        </div>
      )}

      {/* 登録前にコア体験を触ってもらう入口（Issue #18）。
          GETだとプリフェッチやクローラでアカウントが量産されるためPOSTで叩く。 */}
      <Window title="TRY" titleEm=".exe">
        <p className="text-[13.5px] leading-relaxed">
          登録なしで、いますぐ<b>アバターを育てて、ダンジョンに潜る</b>ところまで試せます。
        </p>
        <form action="/api/guest/start" method="post" className="mt-3">
          <button className="btn8 btn8-start w-full text-center text-[13px]">
            ▶ ためしてみる（登録なし）
          </button>
        </form>
        <p className="mt-2 text-[11px] leading-relaxed text-inksoft">
          お試し中は腕試し・ダンジョン・マイホームが使えます（週報やAIメンターは登録後）。
          あとから連携すると、<b>育てたアバターや戦利品はそのまま引き継がれます</b>。
          30日つかわないと消えます。
        </p>
        {guest === "toomany" && (
          <p className="mt-2 text-[12px] font-bold text-pinkhot">
            お試しの発行が続いています。しばらく時間をおいてからお試しください。
          </p>
        )}
      </Window>

      {providers.length > 0 && (
        <Window title="LOGIN" titleEm=".exe">
          <p className="text-[13.5px] leading-relaxed">
            お持ちのアカウントでログインできます。
            <b>メールアドレスや名前は受け取りません</b>——「同じ人が戻ってきた」
            ことの確認にだけ使います。
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {providers.map((p) => (
              <a
                key={p}
                href={`/api/auth/${p}/start`}
                data-oauth-start={p}
                className="btn8 btn8-start block text-center text-[13px]"
              >
                ▶ {PROVIDER_LABELS[p]} でログイン / はじめる
              </a>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-inksoft">
            はじめての方はアカウントが自動で作られます（ハンドル名は後から変更できます）。
          </p>
        </Window>
      )}

      {/* 何ができるか（Issue #15）。CTAの後ろに置き、迷った人が読んで戻れる順序にする */}
      {FEATURES.map((f) => (
        <Window key={f.title} title={f.tag.split(" ")[0]} titleEm=".exe">
          <PixelLabel className="!text-pinkhot">{f.tag}</PixelLabel>
          <p className="mt-2 text-[15px] font-extrabold leading-snug text-ink">
            {f.title}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-inksoft">
            {f.body}
          </p>
        </Window>
      ))}

      {/* 安心材料。個人情報を持たない設計は最大の差別化なので独立した枠で見せる */}
      <Window title="PRIVACY" titleEm=".txt">
        <PixelLabel>あなたの情報は、ほとんど預かりません</PixelLabel>
        <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink">
          <li>
            ・<b>メール・本名・パスワード不要</b>。連携で受け取るのも、本人確認のハッシュだけ。
          </li>
          <li>
            ・表示されるのは<b>あなたが決めるハンドル</b>（ペンネーム可）だけです。
          </li>
          <li>
            ・週報やコンディションは<b>あなた以外に見えません</b>。公開は1件ずつ選べます。
          </li>
        </ul>
        <p className="mt-3 border-t-2 border-dashed border-grid8 pt-2.5 text-[12px] text-inksoft">
          <b>招待リンク</b>（
          <span className="font-pixel text-[12px] text-royal2">/join/…</span>
          ）はURLを開くだけで始められます。本名や客先の実名は入力しないでください。
        </p>
      </Window>
    </div>
  );
}
