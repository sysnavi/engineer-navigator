import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicQuestion, loadQuestionAnswer } from "@/lib/public-question";
import { getOptionalUser } from "@/lib/auth";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";

// 良問の公開ページ（Issue #14 Phase 2）。検索資産にする＝問題文と選択肢は
// 誰でも見られる。正解と解説は「登録/ログインの見返り」として段差を付ける。

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const q = await loadPublicQuestion(id);
  if (!q) return { title: "問題が見つかりません" };

  // 「AWS IAM 四択 問題」系のロングテールを狙う
  const title = `${q.topic} の四択問題 — Engineer Navigator`;
  const description = `${q.prompt} エンジニア向けの四択問題。登録すると解答と解説が見られます。`;

  return {
    title,
    description,
    alternates: { canonical: `/q/${q.id}` },
    // 良問だけをインデックス対象にする（薄い/未評価のUGCは載せない）
    robots: q.indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "article", siteName: "Engineer Navigator" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const q = await loadPublicQuestion(id);
  if (!q) notFound();

  // 段差: ログイン済みだけ正解・解説を取得（未ログインのHTMLには答えを混ぜない）
  const viewer = await getOptionalUser();
  const answer = viewer ? await loadQuestionAnswer(q.id) : null;

  // 構造化データ: schema.org Question。選択肢は suggestedAnswer に載せるが、
  // acceptedAnswer（正解）は入れない＝答えを漏らさない。
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Question",
    name: q.topic,
    text: q.prompt,
    suggestedAnswer: q.choices.map((c) => ({ "@type": "Answer", text: c })),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div>
        <PixelLabel>良問バンク — {q.topic}</PixelLabel>
        <PixelTitle as="h1" className="mt-1 text-2xl leading-snug text-royal">
          {q.prompt}
        </PixelTitle>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-inksoft">
          {q.avg !== null && (
            <span className="font-pixel text-royal2">★{q.avg.toFixed(1)}</span>
          )}
          {q.author ? (
            <>
              出題:{" "}
              <Link
                href={`/u/${q.author.handle}`}
                className="font-bold text-royal2 hover:text-pinkhot"
              >
                {q.author.name}
              </Link>
            </>
          ) : (
            <span>出題: 匿名</span>
          )}
        </p>
      </div>

      <Window title="Q" titleEm=".dat">
        <ol className="space-y-2">
          {q.choices.map((c, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-lg border-2 border-line8 bg-surface px-3 py-2.5 text-[13.5px] shadow-hard-sm"
            >
              <span className="font-pixel text-[12px] text-royal2">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
      </Window>

      {/* 段差: ログイン済みには正解＋解説、未ログインには登録CTA */}
      {viewer && answer ? (
        <Window title="ANSWER" titleEm=".txt" barClass="!bg-pinkhot">
          <PixelLabel className="!text-pinkhot">正解</PixelLabel>
          <p className="mt-1.5 text-[14px] font-extrabold">
            {String.fromCharCode(65 + answer.answerIndex)}.{" "}
            {q.choices[answer.answerIndex]}
          </p>
          {answer.explanation && (
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
              {answer.explanation}
            </p>
          )}
          <Link
            href="/quiz/play"
            className="btn8 btn8-start mt-3 inline-block text-[12px]"
          >
            ▶ 腕試しで解いてEXPを貯める
          </Link>
        </Window>
      ) : (
        <Window title="LOCKED" titleEm=".cfg">
          <PixelLabel>解答と解説は登録すると見られます</PixelLabel>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
            登録なしで<b>腕試しを試す</b>こともできます。四択に答えるとEXPが貯まって、
            アバターが育つよ。メールも本名も不要です。
          </p>
          <Link
            href="/welcome"
            className="btn8 btn8-start mt-3 inline-block text-[12px]"
          >
            ▶ はじめる（登録・お試し）
          </Link>
        </Window>
      )}

      <p className="text-center font-pixel text-[11px] tracking-[0.1em] text-royal2">
        ▶ ENGINEER NAVIGATOR — 良問バンク
      </p>
    </div>
  );
}
