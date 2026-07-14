import type { ReactNode } from "react";

// 単価交渉で効くキーワード（経歴書ビューで自動ハイライト）。
// Lv4「本番リリース経験」は単価+10万〜15万円の分水嶺（docs/data-model.md）。
// 長い語を先にマッチさせるため長さ降順を維持すること。
export const RATE_KEYWORDS = [
  "パフォーマンス改善",
  "本番リリース",
  "本番デプロイ",
  "本番環境",
  "AIを活用",
  "生成AI",
  "AI活用",
  "顧客折衝",
  "リーダー",
  "テスト自動化",
] as const;

const PATTERN = new RegExp(
  `(${[...RATE_KEYWORDS]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`,
  "g"
);

/** テキスト中の単価交渉キーワードを <mark class="kw8"> で強調する */
export function highlightKeywords(text: string): ReactNode {
  const parts = text.split(PATTERN);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    (RATE_KEYWORDS as readonly string[]).includes(p) ? (
      <mark key={i} className="kw8">
        {p}
      </mark>
    ) : (
      p
    )
  );
}
