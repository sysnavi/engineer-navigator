// 目指す技術領域（キャリアの方向性）。マイページで複数選択でき、
// メンターの提案・ロールプレイ評価のアドバイスをこの方向性に寄せるために使う。
// id はDB保存値（安定）。label は表示名。emoji は8bit UIの識別用。

export type DomainDef = {
  id: string;
  label: string;
  emoji: string;
  hint: string;
};

export const DOMAINS: DomainDef[] = [
  { id: "web", label: "WEB", emoji: "🌐", hint: "フロント/バックのWebアプリ開発" },
  { id: "fullstack", label: "フルスタック", emoji: "🧩", hint: "設計から運用まで横断" },
  { id: "infra", label: "インフラ", emoji: "🖧", hint: "クラウド/ネットワーク/SRE" },
  { id: "embedded", label: "組み込み", emoji: "🔌", hint: "マイコン/ファームウェア" },
  { id: "control", label: "制御系", emoji: "🎛️", hint: "産業機器/リアルタイム制御" },
  { id: "semiconductor", label: "半導体", emoji: "🪛", hint: "回路/デバイス/EDA" },
  { id: "pm", label: "プロジェクトマネジメント", emoji: "📋", hint: "計画・進行・チーム運営" },
  { id: "qa", label: "品質保証", emoji: "🧪", hint: "テスト設計/品質プロセス" },
];

const BY_ID = new Map(DOMAINS.map((d) => [d.id, d]));

export function isDomainId(v: unknown): v is string {
  return typeof v === "string" && BY_ID.has(v);
}

export function domainLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

/** 保存済みID配列を表示ラベルの文字列に（AIコンテキスト用）。空なら null。 */
export function domainsToLabels(ids: string[]): string | null {
  const labels = ids.filter(isDomainId).map(domainLabel);
  return labels.length ? labels.join("、") : null;
}
