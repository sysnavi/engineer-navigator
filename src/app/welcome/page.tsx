import Link from "next/link";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { enabledProviders, PROVIDER_LABELS } from "@/lib/oauth";
import { PixelAvatar } from "@/components/pixel-avatar";
import { getOptionalUser } from "@/lib/auth";
import { track, EVENT } from "@/lib/analytics/track";
import { loadWelcomeQuestion } from "@/lib/public-question";
import { parseChoice } from "@/lib/welcome-quiz";
import { GuestStartForm, HeroQuiz } from "./hero-quiz";

// 公開ランディング。ログイン手段は OAuth（Google/GitHub・PIIゼロ）と招待リンクの併存。
//
// 並び順の方針: 「読ませてから試させる」ではなく「触らせてから読ませる」。
//  1. 見出し → いきなり1問（答えるとEXPが出る） → 進化段階
//  2. ためしてみる（ゲスト発行）
//  3. 何ができるか（4枚・1文ずつ）
//  4. 個人情報を持たない設計（バッジ）
//  5. ログイン（アカウントを持っている人向け・最後）
// 文字量は各枠1〜2文に抑える（説明の多さが離脱の一因という仮説。効果は
// welcome 表示数 → guest_start の比で見る。docs/analytics.md）。

// ヒーローに並べる進化段階（src/lib/exp.ts の STAGES から代表を抜粋）。
// 画像ではなく実際のスプライトを描くので、アバターを更新すればここも自動で揃う。
const HERO_STAGES = [
  { sprite: "egg", name: "たまご" },
  { sprite: "chick", name: "ひよこ" },
  { sprite: "minarai", name: "みならい" },
  { sprite: "ichininmae", name: "いちにんまえ" },
  { sprite: "meister", name: "マイスター" },
];

// 「何ができるか」。機能名の羅列ではなく、行動→見返りの形で1文ずつ。
const FEATURES = [
  {
    tag: "週報",
    title: "書けば、経歴書になる",
    body: "今週やったことを5分。AIがスキルを見つけ、経歴書が育つ。",
  },
  {
    tag: "腕試し",
    title: "解けば、腕が上がる",
    body: "現場で使える四択。解くのも作るのもEXP。",
  },
  {
    tag: "ダンジョン",
    title: "潜れば、戦利品が増える",
    body: "迷路を歩き、問いに答えて敵を倒す。持ち帰ったガジェットはマイホームに。",
  },
  {
    tag: "げんば",
    title: "働けば、ENが貯まる",
    body: "案件を選び、面接を突破し、現場を乗り切る。稼いだENで家具をそろえる。",
  },
];

const OAUTH_ERRORS: Record<string, string> = {
  state: "確認情報が一致しませんでした。もう一度お試しください。",
  denied: "ログインがキャンセルされました。",
  exchange: "プロバイダとの通信に失敗しました。時間をおいてお試しください。",
  provider: "このログイン方法は現在利用できません。",
  // モバイルアプリ限定の2つ（切り分けのためstateと分けている）
  verifier: "アプリ側の確認コードが見つかりませんでした。もう一度お試しください。",
  ticket: "ログインの引き換えに失敗しました。もう一度お試しください。",
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
    tr?: string;
    q?: string;
    a?: string;
  }>;
}) {
  const { invalid, oauth_error, guest, tr, q, a } = await searchParams;
  const providers = enabledProviders();

  // ゲストがログインしたままここに来るケース（登録限定の機能で弾かれた／ロゴから戻った）。
  // お試し中の人には「連携すれば引き継がれる」ことと、そのボタンだけを見せる。
  const current = await getOptionalUser();
  const asGuest = current?.role === "GUEST";
  const needsAccount = asGuest && guest === "needsaccount";
  if (needsAccount) {
    await track(EVENT.guestNeedsAccount, { userId: current!.id });
  }

  // いきなり1問（未ログインの初見にだけ出す）。q が今日の問題と一致するときだけ
  // 結果を描く＝任意IDの答えを /welcome 経由で引き出せない。
  const heroQ = current ? null : await loadWelcomeQuestion();
  const chosen = heroQ && q === heroQ.id ? parseChoice(a, heroQ.choices.length) : null;

  const loginBox = providers.length > 0 && (
    <Window title={asGuest ? "REGISTER" : "LOGIN"} titleEm=".exe">
      <p className="text-[13.5px] leading-relaxed">
        {asGuest ? (
          <>
            連携して登録します。<b>メールアドレスや名前は受け取りません</b>。
          </>
        ) : (
          <>アカウントをお持ちの方はこちら。</>
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {providers.map((p) => (
          <a
            key={p}
            href={`/api/auth/${p}/start`}
            data-oauth-start={p}
            className={`btn8 block text-center text-[13px] ${asGuest ? "btn8-start" : ""}`}
          >
            ▶ {PROVIDER_LABELS[p]} で{asGuest ? "連携して登録" : "ログイン"}
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-inksoft">
        {asGuest
          ? "いまのゲストがそのまま本アカウントになります（別のデータに置き換わることはありません）。"
          : "はじめての方は、上の「ためしてみる」からどうぞ（連携でアカウントが自動で作られます）。"}
      </p>
    </Window>
  );

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      {/* ヒーロー。スクショ画像を置かず、実際のアバターをそのまま並べる */}
      <div className="text-center">
        <PixelLabel>ENGINEER NAVIGATOR</PixelLabel>
        <PixelTitle as="h1" className="mt-1 text-[28px] leading-tight text-royal sm:text-3xl">
          がんばりは、
          <br className="sm:hidden" />
          ぜんぶ経験値になる。
        </PixelTitle>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink">
          四択を解く。ダンジョンに潜る。週報を書く。
          <br />
          その全部がEXPになって、<b>あなたのアバターが育つ</b>。
        </p>
      </div>

      {heroQ && <HeroQuiz q={heroQ} chosen={chosen} />}

      <div className="text-center">
        <div className="flex items-end justify-center gap-1.5 sm:gap-3">
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
          {/* モバイルOAuthの失敗理由コード（不具合報告用） */}
          {tr && (
            <p className="mt-1 font-pixel text-[10px] tracking-wide text-inksoft">
              code: {tr}
            </p>
          )}
        </div>
      )}

      {asGuest && (
        <Window title="UNLOCK" titleEm=".cfg" barClass="!bg-pinkhot">
          <PixelLabel className="!text-pinkhot">
            {needsAccount ? "その機能は、登録すると使えます" : "お試し中です"}
          </PixelLabel>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
            {needsAccount
              ? "週報・AIメンター・経歴書・げんば本番は登録後に開きます。"
              : "いまはゲストとして遊んでいます。"}
            下の <b>Google / GitHub</b> で連携するだけで登録できます。
            <b>育てたアバター・戦利品・腕試しの記録はそのまま引き継がれます</b>。
          </p>
          <Link href="/" className="btn8 mt-3 inline-block text-[12px]">
            ← お試しを続ける
          </Link>
        </Window>
      )}

      {/* ゲストには登録ボタンを上に（弾かれて来た人の次の一手） */}
      {asGuest && loginBox}

      {/* 登録前にコア体験を触ってもらう入口（Issue #18）。
          GETだとプリフェッチやクローラでアカウントが量産されるためPOSTで叩く。
          すでにゲストの人には出さない（押しても / に戻るだけで意味がない）。
          中身は「ゲストが実際に遊べるもの」だけを書く（げんばは はじめかた の中の味見まで） */}
      {!asGuest && (
        <Window title="TRY" titleEm=".exe">
          <p className="text-[14px] font-bold leading-snug text-ink">
            登録なしで、いますぐ遊べます。
          </p>
          <ul className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-ink">
            <li>
              <b>腕試し</b> — 四択に答えてEXP。アバターが育つ
            </li>
            <li>
              <b>ダンジョン</b> — 迷路を歩き、問いに答えて敵を倒す。戦利品はマイホームに飾れる
            </li>
            <li>
              <b>げんばの味見</b> — 案件→面接→現場→精算まで、はじめかたの中でひと通り
            </li>
          </ul>
          <GuestStartForm
            q={heroQ?.id}
            a={chosen}
            label="▶ ためしてみる（登録なし）"
            className="mt-3"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-inksoft">
            メール不要。あとから連携すればそのまま引き継ぎ（30日つかわないと消えます）。
          </p>
          {guest === "toomany" && (
            <p className="mt-2 text-[12px] font-bold text-pinkhot">
              お試しの発行が続いています。しばらく時間をおいてからお試しください。
            </p>
          )}
        </Window>
      )}

      {/* 何ができるか。CTAの後ろに置き、迷った人が読んで戻れる順序にする */}
      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Window key={f.tag} title={f.tag} titleEm=".exe" bodyClass="p-4">
            <p className="text-[14.5px] font-extrabold leading-snug text-ink">{f.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-inksoft">{f.body}</p>
          </Window>
        ))}
      </div>

      {/* 安心材料。個人情報を持たない設計は最大の差別化なのでバッジで一目に */}
      <Window title="PRIVACY" titleEm=".txt">
        <div className="flex flex-wrap gap-2">
          <span className="badge8">メール不要</span>
          <span className="badge8">本名不要</span>
          <span className="badge8">パスワード不要</span>
          <span className="badge8">週報は自分だけ</span>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink">
          連携で受け取るのは本人確認のハッシュだけ。表示は<b>あなたが決めるハンドル</b>（ペンネーム可）。
        </p>
        <p className="mt-2 border-t-2 border-dashed border-grid8 pt-2 text-[11.5px] text-inksoft">
          招待リンク（<span className="font-pixel text-royal2">/join/…</span>）はURLを開くだけで始められます。本名や客先の実名は入力しないでください。
        </p>
      </Window>

      {/* 初見には不要なので最後。アカウントを持っている人はここまでスクロールして戻る */}
      {!asGuest && loginBox}
    </div>
  );
}
