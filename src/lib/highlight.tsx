import type { ReactNode } from "react";

// 単価交渉で効くキーワード（経歴書ビューで自動ハイライト）。
// 内容は社内ノウハウ「シスナビ 単価交渉の勝ちパターン」
// (content/knowledge/rate-evidence/) に対応させている。実際に交渉で効いた
// パターンが更新されたら、この配列も合わせて更新すること。
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
  // 上流工程（実装のみのエンジニアとの差別化）
  "要件定義",
  "基本設計",
  // 後輩指導（リーダー枠での提案に効く）
  "後輩指導",
  "メンバー育成",
] as const;

const PATTERN = new RegExp(
  `(${[...RATE_KEYWORDS]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`,
  "g"
);

/**
 * テキストをキーワード境界で分割する（PDF出力など、web以外の描画で使う）。
 * 例: "本番リリースを担当" → [{text:"本番リリース",isKeyword:true},{text:"を担当",isKeyword:false}]
 */
export function splitByKeywords(
  text: string
): { text: string; isKeyword: boolean }[] {
  return text
    .split(PATTERN)
    .filter((p) => p !== "")
    .map((p) => ({
      text: p,
      isKeyword: (RATE_KEYWORDS as readonly string[]).includes(p),
    }));
}

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
