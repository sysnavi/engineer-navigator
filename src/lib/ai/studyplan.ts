import { completeJson } from "./client";
import { searchLearningChunks, formatContextBlock } from "./retrieval";
import { studyPlanStanceBlock, toStance } from "./stance";
import { findCert, chapterCatalogBlock } from "@/lib/certifications";
import { prisma } from "@/lib/db";
import { planWeeks, itemTargetDate } from "@/lib/plan-dates";

// 資格別学習プラン（Phase 3）: 試験日から逆算した週次カリキュラムをClaudeが生成。
// 学習コンテンツRAGで裏付ける（社内教材があればそれに沿った計画になる）。
//
// カタログ（src/lib/certifications.ts）に載っている資格なら、各週に章の topic を
// 割り当てさせる。これが /plan → /quiz の導線になり、プランが「チェックリスト」から
// 「その週やる腕試しの入口」に変わる。カタログ外の資格は topic なしで従来どおり動く。

export type PlanItem = {
  weekLabel: string;
  title: string;
  detail: string;
  /** 対応する章のお題（カタログの topic）。選べなかった週は null */
  topic?: string | null;
};

/**
 * 資格と残り週数から週次の学習マイルストーンを生成する。
 * weeks は 1〜16 に丸めた前提で呼ぶこと。
 */
export async function generatePlanItems(params: {
  certification: string;
  weeks: number;
  currentSkills: string;
  stance?: string | null;
}): Promise<PlanItem[]> {
  const chunks = await searchLearningChunks(
    `${params.certification} 学習 試験 対策`,
    4
  );
  const context = formatContextBlock(chunks);

  const cert = findCert(params.certification);
  const catalog = cert ? chapterCatalogBlock(cert) : "";
  const topicRule = cert
    ? `- 各週に、その週で扱う章の topic を1つ割り当てる。**topic は上の章立てにある文字列をそのまま使う**（勝手に言い換えない）。総復習など特定の章に紐づかない週は topic を null にする。
- 全ての章が最低1回はどこかの週に登場するようにする（週数が章数より少ない場合は、重要度の高い章を優先する）。`
    : `- topic は常に null にする。`;

  const { data } = await completeJson<{ items: PlanItem[] }>({
    system: `あなたはSES企業の技術メンターです。資格試験に向けた「試験日から逆算した週次の学習計画」を作ります。
## ルール
- ちょうど ${params.weeks} 個のマイルストーン（週）を order 順で出す。
- 各週は weekLabel（例:"1週目""直前1週間"）, title（その週のテーマ）, detail（具体的にやること・2〜3文）, topic を持つ。
- 序盤は基礎、中盤は頻出範囲の演習、終盤は模試と弱点復習、と逆算で配分する。最後の週は必ず直前対策（模試・総復習）にする。
- 相手の今のスキルを踏まえ、既に強い分野は軽く、弱い分野に時間を配る。
- 参考資料がある場合はその範囲を計画に織り込む。
${topicRule}
- 出力はJSONのみ: { "items": [{ "weekLabel": string, "title": string, "detail": string, "topic": string|null }] }
${studyPlanStanceBlock(toStance(params.stance))}`,
    user: `## 資格
${params.certification}

## 期間
試験日まで約 ${params.weeks} 週間

## 相手の現在のスキル
${params.currentSkills || "（未登録）"}${catalog}${context}`,
  });

  // AIが章名を言い換えたり存在しないtopicを返すことがあるので、カタログに無い値は捨てる。
  // ここを緩めると /quiz?topic= が空振りするリンクになるため、必ず突き合わせる。
  const valid = new Set(cert?.chapters.map((c) => c.topic) ?? []);
  return (data.items ?? []).slice(0, params.weeks).map((it) => ({
    ...it,
    topic: it.topic && valid.has(it.topic) ? it.topic : null,
  }));
}

/**
 * GENERATING状態のプランに週次項目を生成して詰める（バックグラウンド実行の本体）。
 * 提出actionと再生成actionの両方から `after()` 経由で呼ぶため、必要な材料は
 * すべてplanIdから引き直す。失敗したら FAILED にして画面の「再生成」に委ねる
 * （ANTHROPIC_API_KEY未設定でも「プランの受付」自体は成功する流儀）。
 */
export async function runPlanGeneration(planId: string): Promise<void> {
  const plan = await prisma.studyPlan.findUnique({
    where: { id: planId },
    include: { user: { select: { mentorStance: true } } },
  });
  if (!plan) return;

  try {
    const now = new Date();
    const weeks = planWeeks(plan.examDate, now);
    const skills = await prisma.engineerSkill.findMany({
      where: { userId: plan.userId },
      include: { skill: true },
      orderBy: { level: "desc" },
      take: 15,
    });
    const currentSkills = skills
      .map((s) => `${s.skill.name}(Lv${s.level})`)
      .join(", ");

    const items = await generatePlanItems({
      certification: plan.certification,
      weeks,
      currentSkills,
      stance: plan.user.mentorStance,
    });

    await prisma.$transaction([
      // 再生成でも冪等になるよう、前回の生成物は捨ててから入れ直す
      prisma.studyPlanItem.deleteMany({ where: { planId } }),
      prisma.studyPlanItem.createMany({
        data: items.map((it, i) => ({
          planId,
          order: i,
          weekLabel: it.weekLabel,
          title: it.title,
          detail: it.detail,
          topic: it.topic ?? null,
          targetDate: itemTargetDate({
            index: i,
            total: items.length,
            examDate: plan.examDate,
            now,
          }),
        })),
      }),
      prisma.studyPlan.update({
        where: { id: planId },
        data: { generationStatus: "READY", generationError: null },
      }),
    ]);
  } catch (e) {
    console.error(`[studyplan] 生成失敗 (plan=${planId}):`, e);
    await prisma.studyPlan
      .update({
        where: { id: planId },
        data: {
          generationStatus: "FAILED",
          generationError: e instanceof Error ? e.message : String(e),
        },
      })
      .catch(() => {}); // 記録すら失敗したらログだけ残す
  }
}
