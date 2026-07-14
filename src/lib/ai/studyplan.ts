import { completeJson } from "./client";
import { searchLearningChunks, formatContextBlock } from "./retrieval";

// 資格別学習プラン（Phase 3）: 試験日から逆算した週次カリキュラムをClaudeが生成。
// 学習コンテンツRAGで裏付ける（社内教材があればそれに沿った計画になる）。

export type PlanItem = {
  weekLabel: string;
  title: string;
  detail: string;
};

/**
 * 資格と残り週数から週次の学習マイルストーンを生成する。
 * weeks は 1〜16 に丸めた前提で呼ぶこと。
 */
export async function generatePlanItems(params: {
  certification: string;
  weeks: number;
  currentSkills: string;
}): Promise<PlanItem[]> {
  const chunks = await searchLearningChunks(
    `${params.certification} 学習 試験 対策`,
    4
  );
  const context = formatContextBlock(chunks);

  const { data } = await completeJson<{ items: PlanItem[] }>({
    system: `あなたはSES企業の技術メンターです。資格試験に向けた「試験日から逆算した週次の学習計画」を作ります。
## ルール
- ちょうど ${params.weeks} 個のマイルストーン（週）を order 順で出す。
- 各週は weekLabel（例:"1週目""直前1週間"）, title（その週のテーマ）, detail（具体的にやること・2〜3文）を持つ。
- 序盤は基礎、中盤は頻出範囲の演習、終盤は模試と弱点復習、と逆算で配分する。最後の週は必ず直前対策（模試・総復習）にする。
- 相手の今のスキルを踏まえ、既に強い分野は軽く、弱い分野に時間を配る。
- 参考資料がある場合はその範囲を計画に織り込む。
- 出力はJSONのみ: { "items": [{ "weekLabel": string, "title": string, "detail": string }] }`,
    user: `## 資格
${params.certification}

## 期間
試験日まで約 ${params.weeks} 週間

## 相手の現在のスキル
${params.currentSkills || "（未登録）"}${context}`,
  });

  return (data.items ?? []).slice(0, params.weeks);
}
