import { completeJson, type LlmUsage } from "./client";
import { searchLearningChunks, formatContextBlock } from "./retrieval";

// 腕試しのAI出題（バッチ生成）。
//
// なぜバッチか: リクエストのたびに生成するとAIの日次上限（Issue #17）を食い潰し、
// 「解こうとしたら上限で出せません」が起きる。問題は作り置きできる資産なので、
// 運営が scripts/generate-quiz.ts で先に作ってDBに貯める方式にしている。
// 解く側（submitQuizAnswer）は今までどおりトークン消費ゼロのまま。
//
// 品質基準は prisma/seed-quizzes.ts の「良問の条件」と同じものをプロンプトに入れ、
// 機械的に検査できる分（選択肢4つ・重複なし・解説の長さ）は validate で弾く。

export type GeneratedQuiz = {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

const MAX_LEN = 500; // createQuizQuestion と同じ上限
const MIN_EXPLANATION = 40; // check-content.ts の警告ラインに合わせる

/** 生成結果の機械チェック。落ちた問題は捨てる（直させるより作り直した方が安い） */
export function validateQuiz(q: unknown): q is GeneratedQuiz {
  if (!q || typeof q !== "object") return false;
  const c = q as Partial<GeneratedQuiz>;
  if (typeof c.prompt !== "string" || !c.prompt.trim() || c.prompt.length > MAX_LEN) return false;
  if (!Array.isArray(c.choices) || c.choices.length !== 4) return false;
  if (c.choices.some((s) => typeof s !== "string" || !s.trim() || s.length > MAX_LEN)) return false;
  if (new Set(c.choices).size !== 4) return false;
  if (!Number.isInteger(c.answerIndex) || c.answerIndex! < 0 || c.answerIndex! > 3) return false;
  if (typeof c.explanation !== "string" || c.explanation.length < MIN_EXPLANATION) return false;
  return true;
}

/**
 * 正解の位置をばらす。LLMは正解を特定の位置に置く癖があり、そのまま入れると
 * 「なんとなく2番」で当たる問題群になる（check-content.ts が警告する偏り）。
 */
export function shuffleChoices(q: GeneratedQuiz): GeneratedQuiz {
  const answer = q.choices[q.answerIndex];
  const shuffled = [...q.choices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { ...q, choices: shuffled, answerIndex: shuffled.indexOf(answer) };
}

const norm = (s: string) => s.toLowerCase().replace(/[\s　。、,.？?！!]/g, "");

/** 既存問題と実質同じかを判定（完全一致＋文字の重なり率）。ゆるめの重複除去 */
export function isDuplicate(prompt: string, existing: string[]): boolean {
  const a = norm(prompt);
  if (!a) return true;
  for (const e of existing) {
    const b = norm(e);
    if (a === b) return true;
    // 短い方が長い方にほぼ含まれる＝言い回しを変えただけ、とみなす
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (short.length >= 12 && long.includes(short)) return true;
  }
  return false;
}

/**
 * お題について四択問題をまとめて生成する。
 * 既存の問題文を渡すと、同じ問題を作らないように避ける（完全ではないので
 * 呼び出し側でも isDuplicate で最終チェックすること）。
 */
export async function generateQuizQuestions(params: {
  topic: string;
  /** その章で押さえること（CertChapter.focus）。出題範囲を絞るのに効く */
  focus?: string | null;
  /** 資格名。文脈として渡すと出題の粒度が試験に寄る */
  certLabel?: string | null;
  count: number;
  existingPrompts?: string[];
}): Promise<{ questions: GeneratedQuiz[]; usage: LlmUsage }> {
  const chunks = await searchLearningChunks(
    `${params.topic} ${params.focus ?? ""}`.trim(),
    4
  );
  const context = formatContextBlock(chunks);

  const avoid = (params.existingPrompts ?? []).slice(0, 40);
  const avoidBlock = avoid.length
    ? `\n\n## すでにある問題（これらと同じ論点は避ける）\n${avoid.map((p) => `- ${p}`).join("\n")}`
    : "";

  const { data, usage } = await completeJson<{ questions: GeneratedQuiz[] }>({
    system: `あなたはSES企業のベテランエンジニアで、若手向けの四択問題を作ります。

## 良問の条件（必ず守る）
- 現場で実際に判断を迫られる場面から作る。用語の言い換えを当てるだけの暗記クイズにしない。
- 誤答の選択肢は「ありがちな誤解」にする。明らかに変な選択肢を並べない（消去法で解けてしまう）。
- explanation には、正解の理由に加えて「なぜ他がダメか」まで書く。最低でも80字。
- 問題文・選択肢はそれぞれ200字以内。選択肢は必ず4つで、内容が重複しないこと。
- 「上記すべて」「該当なし」のような逃げの選択肢は使わない。
- 参考資料がある場合は、その記述と矛盾しないようにする。

## 出力
JSONのみ: { "questions": [{ "prompt": string, "choices": [string,string,string,string], "answerIndex": number, "explanation": string }] }
ちょうど ${params.count} 問。`,
    user: `## お題
${params.topic}${params.certLabel ? `（${params.certLabel} の出題範囲）` : ""}

## この回で押さえたい範囲
${params.focus ?? "（指定なし。お題の中心的な論点を選ぶ）"}${avoidBlock}${context}`,
    maxTokens: 8192,
  });

  const questions = (data.questions ?? [])
    .filter(validateQuiz)
    .map(shuffleChoices)
    .slice(0, params.count);

  return { questions, usage };
}
