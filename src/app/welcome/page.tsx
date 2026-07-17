import { Window, PixelTitle, PixelLabel } from "@/components/retro";

// 公開ランディング。招待リンクが無い訪問者はここに来る。個人情報は集めない。

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="text-center">
        <PixelLabel>ENGINEER NAVIGATOR</PixelLabel>
        <PixelTitle as="h1" className="mt-1 text-3xl text-royal">
          エンジニアの成長OS
        </PixelTitle>
        <p className="mt-2 text-[13px] text-inksoft">
          週報から、スキル・経歴・コンディションをデータ化する（テスト公開中）
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

      <Window title="ACCESS" titleEm=".txt">
        <p className="text-[13.5px] leading-relaxed">
          このアプリは<b>招待リンク制</b>です。運営から受け取ったリンク（
          <span className="font-pixel text-[12px] text-royal2">
            /join/…
          </span>
          ）を開くと利用を開始できます。
        </p>
        <ul className="mt-3 space-y-1.5 text-[12.5px] text-inksoft">
          <li>・メールアドレスやパスワードは登録不要です。</li>
          <li>・表示名はあなたが決めるハンドル（ペンネーム可）だけ。</li>
          <li>・本名や客先の実名は入力しないでください。</li>
        </ul>
      </Window>

      <p className="text-center text-[11.5px] text-inksoft">
        招待リンクをお持ちの方はそのURLを開いてください。
      </p>
    </div>
  );
}
