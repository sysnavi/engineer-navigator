// 週次テコ入れ提案（docs/analytics.md）。来訪者分析の数字から所見を作り、
// AI で「今週やること3つ」に絞った文章にして Slack 用の本文を返す。
// 実行は POST /api/jobs/weekly-insights（GitHub Actions が土曜朝に叩く）。
//
// AI（src/lib/ai/client.ts 経由）は文章化だけ。数字と診断はルール（insights.ts）で決まる
// ので、ANTHROPIC_API_KEY が無い・失敗したときはルール診断の本文にフォールバックする
// （機能自体は失敗させない、の流儀）。

import { completeJson, MODELS } from "@/lib/ai/client";
import { getVisitorAnalytics, type VisitorAnalytics } from "./queries";
import { diagnose, fallbackProposal, formatSlack, type Finding, type Proposal } from "./insights";

const DAY_MS = 86400_000;

const SYSTEM = `あなたは小さなWebサービス「Engineer Navigator」（エンジニアの週報・腕試し・ダンジョンで
アバターが育つ。登録なしのゲストで試せて、Google/GitHub連携で本登録）のグロース担当です。
来訪者分析の数字とルール診断の所見を渡すので、運営者が今週やることを最大3つに絞って提案してください。

守ること:
- 数字は渡されたものだけを使う。推測で数字を作らない
- 所見（findings）の根拠と行動を土台にし、順番を入れ替えたり統合してよい。所見に無い提案を足すなら「仮説」と明記
- 行動は「何をどこで変えるか」まで具体的に。抽象的な助言（「改善しましょう」）は禁止
- 日本語、です・ます調でなく簡潔な常体。1項目 = title（20字以内）/ why（根拠、60字以内）/ action（80字以内）
- headline は今週の総括を1行（40字以内）

出力は次のJSONのみ:
{"headline": string, "priorities": [{"title": string, "why": string, "action": string}]}`;

function summarize(a: VisitorAnalytics, p: VisitorAnalytics) {
  return {
    wau: { now: a.wau.guest + a.wau.member, prev: p.wau.guest + p.wau.member },
    mau: a.mau.guest + a.mau.member,
    members: a.members,
    new30: { direct: a.newDirect30, promoted: a.promoted30, guests: a.newGuests30 },
    funnel: a.funnel.steps.map((s) => ({ step: s.label, users: s.users })),
    gateByApp: a.funnel.gateByApp.slice(0, 5),
    oauthOutcomes: a.funnel.oauthOutcomes,
    medianDaysToPromote: a.funnel.medianDaysToPromote,
    retention: a.retention.slice(-4),
    features: a.features.map((f) => ({ feature: f.label, users: f.users, ofMembers: a.members ? Math.round((f.users / a.members) * 100) : 0 })),
  };
}

async function proposeWithAi(summary: unknown, findings: Finding[]): Promise<Proposal | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { data } = await completeJson<Proposal>({
      system: SYSTEM,
      user: JSON.stringify({ numbers: summary, findings }, null, 1),
      model: MODELS.analysis,
      maxTokens: 1200,
    });
    if (!data || typeof data.headline !== "string" || !Array.isArray(data.priorities)) return null;
    const priorities = data.priorities
      .filter((x) => x && typeof x.title === "string" && typeof x.action === "string")
      .slice(0, 3)
      .map((x) => ({ title: x.title, why: String(x.why ?? ""), action: x.action }));
    return { headline: data.headline, priorities };
  } catch (e) {
    console.error("weekly-insights: AI proposal failed, falling back:", e);
    return null;
  }
}

export type WeeklyInsights = {
  text: string; // Slack 本文（mrkdwn）
  aiUsed: boolean;
  findings: Finding[];
  proposal: Proposal;
};

export async function buildWeeklyInsights(opts: { appUrl: string; now?: Date; useAi?: boolean }): Promise<WeeklyInsights> {
  const now = opts.now ?? new Date();
  const [current, previous] = await Promise.all([
    getVisitorAnalytics(now),
    getVisitorAnalytics(new Date(now.getTime() - 7 * DAY_MS)),
  ]);
  const findings = diagnose(current, previous);
  const ai = opts.useAi === false ? null : await proposeWithAi(summarize(current, previous), findings);
  const proposal = ai ?? fallbackProposal(findings);
  const text = formatSlack({ current, previous, proposal, appUrl: opts.appUrl, aiUsed: !!ai });
  return { text, aiUsed: !!ai, findings, proposal };
}
