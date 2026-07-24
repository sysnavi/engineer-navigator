import { prisma } from "@/lib/db";
import { completeJson, MODELS } from "./client";
import { searchKnowledge, formatContextBlock } from "./retrieval";
import { skillLevelRubricText } from "@/lib/skill-levels";
import { domainsToLabels } from "@/lib/domains";
import { feedbackStanceBlock, LOW_CONDITION_OVERRIDE, toStance } from "./stance";

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
  consultationSignals: string[]; // 運営がフォローすべきシグナル
  feedback: string; // 本人向け「今週の成長ポイント」（4-5文・良かった点の意味づけ+次の一手）
};

const SYSTEM_PROMPT = `あなたはエンジニアの成長を支援するアナリストです。
エンジニアの週報を解析し、指定されたJSONのみを出力してください（説明文は不要）。

## スキル抽出のルール
- **実績の根拠になるのは【今週やったこと】【新しく触れた技術・初めてやったこと】だけ**。
  【詰まったこと・モヤモヤ】は困りごと、【来週やること】は予定であり、**どちらも実績ではない**。
  この2欄だけを根拠にスキルを立ててはならない（例:「障害対応が続いていてきつい」は
  障害対応スキルの根拠にならない。「Terraformを勉強したい」も同様）。
- 困りごと欄に出てくる技術は、実施した行動が【今週やったこと】側から読み取れる場合にのみ、
  その行動が示すレベルで抽出する。苦戦・未解決の記述をレベルの根拠にしない。
- evidenceQuote は**【今週やったこと】【新しく触れた技術】からの原文引用**に限る（要約しない）。
  そこから引用できないものは、そもそも抽出しない。
- 技術名・工程・役割（リーダー経験、顧客折衝など）を抽出する
- 確実に読み取れるものだけを抽出し、推測で水増ししない
- 「本番リリース」「本番デプロイ」への関与は最重要。必ず kind=EXPERIENCE で抽出する
- 「AIを活用して生産性を上げた」実績も EXPERIENCE として抽出する
- evidenceQuote には週報からの原文引用を入れる（要約しない）
- suggestedLevel は次の10段階ルーブリックで判定する。**週報に書かれた観測可能な行動**が根拠になるレベルを選び、迷ったら低い方に倒す:
  ${skillLevelRubricText()}

## コンディション解析のルール
- 文章のトーンから 0-100 のスコアを付ける（100=良好、50=普通、30以下=要注意）
- ネガティブ語の存在ではなく、疲弊・孤立・停滞・諦めの兆候を重視する
- 技術的な苦戦（詰まった等）は健全な挑戦であり、それ自体は減点しない

## フィードバック（feedback）のルール — 最重要
本人が読んで「来週なにをするか」が変わる文章にする。**コーチとして、次の一手の提案に重心を置く**。
構成（この順・4〜5文）:
1. 良かった点を1つだけ。週報の言い換えではなく「なぜそれがキャリア資産になるか」を意味づける（1〜2文）。
2. 次の一手を1〜2つ。**来週すぐ実行できる粒度**まで具体化する（2〜3文）。
   - 本人の現在のスキルLvと目指す領域に接続する（例: PlaywrightがLv2なら「今のプロジェクトのスモークテストを1本だけE2E化してみる」まで落とす）。
   - 可能なら「これは経歴書・単価に効く」というSESキャリアの意味づけを一言添える。
   - 前週の「来週やること」が渡された場合、有言実行だったかに軽く触れてよい（詰問にはしない）。
   - 「過去のフィードバック」が渡された場合、同じ助言を繰り返さない。
禁止:
- 週報内容の要約・言い換え / 羅列的な称賛（「〜も素晴らしいです」の連発）
- 「相談してみましょう」「意識するとよいでしょう」等の、本人が動けない丸投げ・一般論
- 3つ以上の助言を並べること（次の一手は多くて2つ）
例外（トーンの自動調整）:
- コンディションスコアが低い週（目安40以下）は、提案を1つに絞り、ねぎらいと休養を優先した言葉にする。無理に発破をかけない。
  **これは本人が選んだ接し方（やさしめ/ふつう/きびしめ）より優先する。**

## 出力JSONスキーマ
{
  "skills": [{ "name": string, "category": "LANGUAGE"|"FRAMEWORK"|"CLOUD"|"DATABASE"|"AI"|"TOOL"|"PROCESS"|"SOFT"|"OTHER", "kind": "NEW_SKILL"|"LEVEL_UP"|"EXPERIENCE", "suggestedLevel": number|null, "reason": string, "evidenceQuote": string }],
  "conditionScore": number,
  "conditionReasons": [string],
  "consultationSignals": [string],
  "feedback": string
}

## 登録ノウハウの優先
参考として判定基準・対応ノウハウが与えられた場合は、一般論よりそれを優先して判断すること。
reason には、その基準に照らした根拠（例: 「判定基準のLv4条件である本番リリース経験に該当」）を書く。`;

/** 引用の照合用に、記号・空白の揺れを落として正規化する */
function normalizeQuote(text: string): string {
  return text.replace(/[\s「」『』（）()【】、。,.・…"'”’!?！？]/g, "").toLowerCase();
}

/**
 * 実績欄（やったこと／新しく触れた技術）から引用できない提案を落とす。
 * 「障害対応が続いていて正直きつい」のような困りごとや、来週の予定を
 * 実績として拾う誤抽出を、プロンプト任せにせず構造で止める（Issue #24）。
 * 言い換えで引用された場合まで落とすと正当な抽出を巻き込むので、
 * 「実績欄に無く、かつ困りごと／予定欄にある」ものだけを対象にする。
 */
export function isFoundedOnAchievement(
  quote: string,
  achievement: string,
  nonAchievement: string
): boolean {
  const q = normalizeQuote(quote ?? "");
  if (q.length < 6) return true; // 短すぎる引用は判定材料にしない
  return achievement.includes(q) || !nonAchievement.includes(q);
}

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

    // フィードバックを「次の一手」にするための材料（Issue #24）:
    // 目指す領域・前週の宣言（有言実行の対比）・直近の助言（繰り返し防止）を渡す
    const targetDomains = domainsToLabels(report.user.targetDomains);
    const [prevReport, pastFeedbacks] = await Promise.all([
      prisma.weeklyReport.findFirst({
        where: { userId: report.userId, weekStart: { lt: report.weekStart } },
        orderBy: { weekStart: "desc" },
        select: { nextText: true },
      }),
      prisma.reportAnalysis.findMany({
        where: {
          report: { userId: report.userId, weekStart: { lt: report.weekStart } },
          feedbackText: { not: null },
        },
        orderBy: { report: { weekStart: "desc" } },
        take: 3,
        select: { feedbackText: true },
      }),
    ]);
    const pastFeedbackBlock = pastFeedbacks.length
      ? `\n## 過去のフィードバック（同じ助言を繰り返さないこと）\n${pastFeedbacks
          .map((f, i) => `${i + 1}. ${f.feedbackText}`)
          .join("\n")}`
      : "";

    const userPrompt = `## 現在のスキルマップ
${currentSkills || "（未登録）"}

## 目指す領域（次の一手はここに接続する）
${targetDomains ?? "（未設定）"}

## 自己申告
コンディション: ${report.conditionSelf ?? "-"}/4、稼働の体感: ${report.workloadSelf ?? "-"}/4

## 先週の「来週やること」（有言実行だったか対比する材料）
${prevReport?.nextText ? maskSensitive(prevReport.nextText, []) : "（前週の記録なし）"}
${pastFeedbackBlock}

## 週報本文
【今週やったこと】
${maskSensitive(report.didText ?? "", [])}

【新しく触れた技術・初めてやったこと】
${maskSensitive(report.newText ?? "", [])}

【詰まったこと・モヤモヤ】
${maskSensitive(report.struggleText ?? "", [])}

【来週やること】
${maskSensitive(report.nextText ?? "", [])}

【AIメンターへの共有・相談】
${maskSensitive(report.shareText ?? "", [])}`;

    // 登録ノウハウRAG: 判定は一般論ではなく登録された基準で行う。
    // - スキル判定基準: 何をやったか（実績）から登録Lv定義に照らす
    // - コンディション対応ノウハウ: 詰まり/トーンの読み取りを登録事例に照らす
    // どちらも該当なし・キー未設定なら空文字（従来どおり動く）。
    const [skillKnow, condKnow] = await Promise.all([
      searchKnowledge({
        query: `${report.didText ?? ""} ${report.newText ?? ""}`.slice(0, 500),
        kinds: ["SKILL_CRITERIA"],
        k: 3,
      }),
      searchKnowledge({
        query: `${report.struggleText ?? ""} ${report.shareText ?? ""}`.slice(0, 500),
        kinds: ["CONDITION_PLAYBOOK"],
        k: 2,
      }),
    ]);
    const knowledgeBlock =
      formatContextBlock(skillKnow, "登録されたスキル判定基準（この基準で判定すること）") +
      formatContextBlock(
        condKnow,
        "登録されたコンディション対応ノウハウ（トーン解析・シグナル判断の参考）"
      );

    // 本人が選んだ接し方（Issue: メンタースタンス）。自己申告が低い週は
    // モデルの判定を待たずに安全側へ倒す（SYSTEM_PROMPT側の40以下ルールと二重の担保）。
    const stance = toStance(report.user.mentorStance);
    const selfLow =
      (report.conditionSelf ?? 4) <= 2 || (report.workloadSelf ?? 4) <= 1;
    const stanceBlock =
      feedbackStanceBlock(stance) + (selfLow ? LOW_CONDITION_OVERRIDE : "");

    const { data, usage } = await completeJson<AnalysisResult>({
      system: SYSTEM_PROMPT + stanceBlock + knowledgeBlock,
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
    const CATEGORIES = new Set([
      "LANGUAGE", "FRAMEWORK", "CLOUD", "DATABASE",
      "AI", "TOOL", "PROCESS", "SOFT",
    ]);
    const achievementText = normalizeQuote(
      `${report.didText ?? ""}\n${report.newText ?? ""}`
    );
    const nonAchievementText = normalizeQuote(
      `${report.struggleText ?? ""}\n${report.nextText ?? ""}`
    );
    const dropped: string[] = [];
    for (const s of data.skills) {
      if (!isFoundedOnAchievement(s.evidenceQuote, achievementText, nonAchievementText)) {
        // 困りごと／来週の予定を根拠にした提案は作らない（実績ではないため）
        dropped.push(s.name);
        continue;
      }
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
          // AIの出力はそのまま信じず、enumに無い値は OTHER に落とす
          category: CATEGORIES.has(s.category) ? s.category : "OTHER",
          suggestedLevel: s.suggestedLevel,
          reason: s.reason,
          evidenceQuote: s.evidenceQuote,
          sourceReportId: report.id,
        },
      });
    }
    if (dropped.length) {
      console.warn(
        `[analyzeReport] 実績欄から引用できないため提案を見送り: ${dropped.join(", ")} (report=${report.id})`
      );
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

    // コンディション検知ルール（他者向けアラート発火）は個人サービス化で撤去（Issue #19 方針A）。
    // conditionAi スコア自体は本人向けフィードバックの材料として引き続き保存する。
  } catch (e) {
    await prisma.reportAnalysis.update({
      where: { id: analysis.id },
      data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) },
    });
    throw e;
  }
}
