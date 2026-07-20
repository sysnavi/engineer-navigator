import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { enabledProviders, PROVIDER_LABELS } from "@/lib/oauth";

// 公開ランディング。ログイン手段は OAuth（Google/GitHub・PIIゼロ）と招待リンクの併存。

const OAUTH_ERRORS: Record<string, string> = {
  state: "確認情報が一致しませんでした。もう一度お試しください。",
  denied: "ログインがキャンセルされました。",
  exchange: "プロバイダとの通信に失敗しました。時間をおいてお試しください。",
  provider: "このログイン方法は現在利用できません。",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string; oauth_error?: string }>;
}) {
  const { invalid, oauth_error } = await searchParams;
  const providers = enabledProviders();

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="text-center">
        <PixelLabel>ENGINEER NAVIGATOR</PixelLabel>
        <PixelTitle as="h1" className="mt-1 text-3xl text-royal">
          エンジニアの成長OS
        </PixelTitle>
        <p className="mt-2 text-[13px] text-inksoft">
          週報もクイズもよもやまも、ここでの頑張りが全部つながって育つ。
          <br />
          遊びと学びのいいとこどりを目指した、エンジニアの成長サービス（テスト公開中）
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

      <Window title="ACCESS" titleEm=".txt">
        <p className="text-[13.5px] leading-relaxed">
          <b>招待リンク</b>（
          <span className="font-pixel text-[12px] text-royal2">/join/…</span>
          ）をお持ちの方は、そのURLを開くだけで利用を開始できます。
        </p>
        <ul className="mt-3 space-y-1.5 text-[12.5px] text-inksoft">
          <li>・メールアドレスやパスワードは登録不要です。</li>
          <li>・表示名はあなたが決めるハンドル（ペンネーム可）だけ。</li>
          <li>・本名や客先の実名は入力しないでください。</li>
        </ul>
      </Window>
    </div>
  );
}
