import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";
import { completeJson, type ChatMessage } from "./client";

// 週報のインタビューモード（個人サービスのUX実験）。
// 「何を書けばいいかわからない」若手向けに、AIが1問ずつ聞いて材料を集め、
// 最後に7設問の週報ドラフトへ変換する。ドラフトは本人がフォームで確認・編集して提出する
// （AIは下書きまで、決めるのは本人 — スキル承認と同じ思想）。
//
// インタビューの会話はDBに保存しない（成果物はドラフト化された週報のみ）。

/** インタビュー完了をクライアントに伝えるマーカー（表示時には取り除く） */
export const READY_MARKER = "[READY]";

const INTERVIEW_SYSTEM = `あなたは週報づくりを手伝うインタビュアーです。相手は「何を書けばいいかわからない」ことが多い若手エンジニア。あなたが聞き役になって、話すだけで週報の材料が揃うようにします。

## 聞き方のルール（厳守）
- 1回の発言に質問は1つだけ。短く（2〜3文まで）、話し言葉で、テンポよく。
- 次の材料を順に集める:
  ①今週のコンディション（☀️好調/🌤普通/☁️モヤモヤ/🌧しんどい のどれに近いか）
  ②稼働の体感（余裕あり/ちょうどいい/忙しい/限界が近い）
  ③今週やったこと
  ④新しく触れた技術・初めてやったこと
  ⑤詰まったこと・モヤモヤしていること
  ⑥来週やりたいこと
  ⑦メンターに共有・相談しておきたいこと（任意。無ければ飛ばしてよい）
- 答えが曖昧なときだけ、1回だけ具体化を促す（「数字で言うと？」「技術名でいうと？」「それは本番環境？」）。深追いはしない。
- ③④で成果が出てきたら軽く喜んで、経歴書に効く要素（数字・技術名・本番への関与・初めてかどうか）をさりげなく拾う。
- 説教・アドバイス・長い解説はしない。あなたは聞き役。
- 前回の週報の「来週やること」が分かっている場合は、最初の質問でそれに触れる（「先週◯◯やるって言ってたけど、どうだった？」）。
- ①〜⑥の材料が一通り集まったら（⑦は任意）、ねぎらいの一言のあと、改行して ${READY_MARKER} とだけ書いて終える。`;

/** インタビュアーに渡す個人コンテキスト */
async function buildContext(userId: string): Promise<string> {
  const thisMonday = mondayOf(new Date());
  const [skills, prevReport] = await Promise.all([
    prisma.engineerSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: { level: "desc" },
      take: 10,
    }),
    prisma.weeklyReport.findFirst({
      where: { userId, status: "SUBMITTED", weekStart: { lt: thisMonday } },
      orderBy: { weekStart: "desc" },
      select: { nextText: true },
    }),
  ]);

  const skillLine = skills.length
    ? skills.map((s) => `${s.skill.name}(Lv${s.level})`).join(", ")
    : "（まだ登録なし）";

  return `## 相手の情報
スキル: ${skillLine}
前回の週報の「来週やること」: ${prevReport?.nextText || "（記載なし）"}`;
}

export async function buildInterviewSystem(userId: string): Promise<string> {
  const context = await buildContext(userId);
  return `${INTERVIEW_SYSTEM}\n\n${context}`;
}

export type InterviewDraft = {
  conditionSelf: number | null;
  workloadSelf: number | null;
  didText: string | null;
  newText: string | null;
  struggleText: string | null;
  nextText: string | null;
  shareText: string | null;
};

/** インタビューの会話ログを週報の7設問ドラフトに変換する */
export async function extractDraft(
  transcript: ChatMessage[]
): Promise<InterviewDraft> {
  const log = transcript
    .map((m) => `${m.role === "user" ? "本人" : "インタビュアー"}: ${m.content}`)
    .join("\n");

  const { data } = await completeJson<InterviewDraft>({
    system: `インタビューの会話ログから、週報の下書きをJSONで作ります。
## ルール
- 本人の発言だけを材料にする。話していないことを創作しない。
- conditionSelf: ☀️好調=4 🌤普通=3 ☁️モヤモヤ=2 🌧しんどい=1。読み取れなければ null。
- workloadSelf: 余裕あり=4 ちょうどいい=3 忙しい=2 限界が近い=1。読み取れなければ null。
- didText: 今週やったこと。「・」始まりの箇条書き。数字・技術名・本番関与は必ず残す。
- newText: 新しく触れた技術・初めてやったこと。無ければ null。
- struggleText: 詰まったこと・モヤモヤ。無ければ null。
- nextText: 来週やること。無ければ null。
- shareText: メンターへの共有・相談。無ければ null。
- 文体は本人の一人称で自然に。盛らない・要約しすぎない。
- 出力はJSONのみ:
{ "conditionSelf": number|null, "workloadSelf": number|null, "didText": string|null, "newText": string|null, "struggleText": string|null, "nextText": string|null, "shareText": string|null }`,
    user: `## 会話ログ\n${log}`,
  });
  return data;
}
