import { prisma } from "@/lib/db";
import { completeJson, MODELS } from "./client";

// 週報提出時のAI解析パイプライン（docs/weekly-report.md の設計に対応）
//  ① スキル抽出 → SkillSuggestion 生成
//  ② トーン解析 → conditionAi / divergence
//  ③ 相談検知 → signals
//  ④ 本人向けフィードバック生成

type ExtractedSkill = {
  name: string;
  category:
    | "LANGUAGE"
    | "FRAMEWORK"
    | "CLOUD"
    | "DATABASE"
    | "AI"
    | "TOOL"
    | "PROCESS"
    | "SOFT"
    | "OTHER";
  kind: "NEW_SKILL" | "LEVEL_UP" | "EXPERIENCE";
  suggestedLevel: number | null;
  reason: string;
  evidenceQuote: string;
};

type AnalysisResult = {
  skills: ExtractedSkill[];
  conditionScore: number; // 0-100（100=良好）
  conditionReasons: string[];
  consultationSignals: string[]; // 会社が対応すべきシグナル
  feedback: string; // 本人向け「今週の成長ポイント」（2-3文）
};

const SYSTEM_PROMPT = `あなたはSES企業のエンジニア育成を支援するアナリストです。
エンジニアの週報を解析し、指定されたJSONのみを出力してください（説明文は不要）。

## スキル抽出のルール
- 技術名・工程・役割（リーダー経験、顧客折衝など）を抽出する
- 確実に読み取れるものだけを抽出し、推測で水増ししない
- 「本番リリース」「本番デプロイ」への関与は最重要。必ず kind=EXPERIENCE で抽出する
- 「AIを活用して生産性を上げた」実績も EXPERIENCE として抽出する
- evidenceQuote には週報からの原文引用を入れる（要約しない）
- suggestedLevel の目安: 1=学習中 2=指導下で実務 3=一人で実務可 4=本番リリース経験/指導可 5=技術選定をリード

## コンディション解析のルール
- 文章のトーンから 0-100 のスコアを付ける（100=良好、50=普通、30以下=要注意）
- ネガティブ語の存在ではなく、疲弊・孤立・停滞・諦めの兆候を重視する
- 技術的な苦戦（詰まった等）は健全な挑戦であり、それ自体は減点しない

## 出力JSONスキーマ
{
  "skills": [{ "name": string, "category": "LANGUAGE"|"FRAMEWORK"|"CLOUD"|"DATABASE"|"AI"|"TOOL"|"PROCESS"|"SOFT"|"OTHER", "kind": "NEW_SKILL"|"LEVEL_UP"|"EXPERIENCE", "suggestedLevel": number|null, "reason": string, "evidenceQuote": string }],
  "conditionScore": number,
  "conditionReasons": [string],
  "consultationSignals": [string],
  "feedback": string
}`;

/** 顧客名などの固有名詞をマスキングする前処理（守りのAI武装） */
function maskSensitive(text: string, aliases: { real?: string | null }[]): string {
  // MVPでは Project.clientAlias 運用で実名がDBに入らない前提。
  // 将来: NERベースの検出をここに追加する。
  void aliases;
  return text;
}

export async function analyzeReport(reportId: string): Promise<void> {
  const report = await prisma.weeklyReport.findUniqueOrThrow({
    where: { id: reportId },
    include: { user: { include: { skills: { include: { skill: true } } } } },
  });

  const analysis = await prisma.reportAnalysis.upsert({
    where: { reportId },
    update: { status: "RUNNING", error: null },
    create: { reportId, status: "RUNNING" },
  });

  try {
    const currentSkills = report.user.skills
      .map((es) => `${es.skill.name}(Lv${es.level})`)
      .join(", ");

    const userPrompt = `## 現在のスキルマップ
${currentSkills || "（未登録）"}

## 自己申告
コンディション: ${report.conditionSelf ?? "-"}/4、稼働の体感: ${report.workloadSelf ?? "-"}/4

## 週報本文
【今週やったこと】
${maskSensitive(report.didText ?? "", [])}

【新しく触れた技術・初めてやったこと】
${maskSensitive(report.newText ?? "", [])}

【詰まったこと・モヤモヤ】
${maskSensitive(report.struggleText ?? "", [])}

【来週やること】
${maskSensitive(report.nextText ?? "", [])}

【会社への共有・相談】
${maskSensitive(report.shareText ?? "", [])}`;

    const { data, usage } = await completeJson<AnalysisResult>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      model: MODELS.analysis,
    });

    // 自己申告(1-4)を0-100に正規化してAIスコアとの乖離を計算
    const selfNorm =
      report.conditionSelf != null ? ((report.conditionSelf - 1) / 3) * 100 : null;
    const divergence =
      selfNorm != null ? Math.abs(selfNorm - data.conditionScore) : null;

    // スキル提案を生成（既存マスタと名寄せ）
    const masterSkills = await prisma.skill.findMany();
    for (const s of data.skills) {
      const matched = masterSkills.find(
        (m) =>
          m.name.toLowerCase() === s.name.toLowerCase() ||
          m.aliases.some((a) => a.toLowerCase() === s.name.toLowerCase())
      );
      await prisma.skillSuggestion.create({
        data: {
          userId: report.userId,
          kind: s.kind,
          skillId: matched?.id,
          skillName: s.name,
          suggestedLevel: s.suggestedLevel,
          reason: s.reason,
          evidenceQuote: s.evidenceQuote,
          sourceReportId: report.id,
        },
      });
    }

    await prisma.reportAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "DONE",
        extractedSkills: JSON.parse(JSON.stringify(data.skills)),
        conditionAi: data.conditionScore,
        divergence,
        signals: {
          conditionReasons: data.conditionReasons,
          consultationSignals: data.consultationSignals,
        },
        feedbackText: data.feedback,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      },
    });

    // 「営業に直接相談したい」チェックは解析結果を待たず即アラート
    if (report.wantsConsultation) {
      await prisma.conditionAlert.create({
        data: {
          userId: report.userId,
          level: "WARN",
          trigger: "相談フラグ",
          reason: "週報で「営業に直接相談したい」にチェックがありました。",
        },
      });
    }
  } catch (e) {
    await prisma.reportAnalysis.update({
      where: { id: analysis.id },
      data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) },
    });
    throw e;
  }
}
