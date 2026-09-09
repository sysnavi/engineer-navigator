import { prisma } from "@/lib/db";
import { recordReviewOutcome } from "./review";
import { markDailyAnswered } from "./daily";

// 解答の記録と、その副作用（復習ボックス・今日の一問・スキル検証）。
//
// 腕試し（/quiz）とダンジョンの戦闘が同じ経路を通る。どこで解いても
// 「間違えた問題は復習に入る」「正解は仮判定スキルの裏取りになる」を揃えるため。
// 出どころは source で区別し、EXP と したく の集計は "quiz" だけを数える（schema参照）。

export type AttemptSource = "quiz" | "dungeon";

export async function recordAttempt(params: {
  userId: string;
  questionId: string;
  chosenIndex: number;
  correct: boolean;
  topic: string;
  source: AttemptSource;
}): Promise<void> {
  const { userId, questionId, chosenIndex, correct, topic, source } = params;
  await prisma.quizAttempt.create({
    data: { questionId, userId, chosenIndex, correct, source },
  });
  // 副作用は失敗しても解答自体は成立させたいので握りつぶす
  await Promise.all([
    recordReviewOutcome(userId, questionId, correct).catch((e) =>
      console.error("recordReviewOutcome failed:", e)
    ),
    markDailyAnswered(userId, questionId, correct).catch((e) =>
      console.error("markDailyAnswered failed:", e)
    ),
  ]);
  // トークンゼロの裏取り経路（Issue #25）: 正解が仮判定スキルの検証になる
  if (correct) {
    await promoteSkillsVerifiedByQuiz(userId, topic).catch((e) =>
      console.error("promoteSkillsVerifiedByQuiz failed:", e)
    );
  }
}

/** お題の照合（"AWS IAM" ⊃ "IAM" のようなゆるい包含）。空白と大文字小文字を無視する */
export function topicMatches(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const na = norm(a);
  const nb = norm(b);
  return na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na));
}

/** 仮判定スキルのうち、お題（topic）が一致する問題に累計2問正解したものを
 *  「腕試しで検証済み」へ昇格させる。AI費ゼロで検証が回る経路（Issue #25） */
export async function promoteSkillsVerifiedByQuiz(userId: string, topic: string) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

  // いま解いた問題のお題に関係する仮判定スキルだけを対象にする
  const provisional = await prisma.engineerSkill.findMany({
    where: { userId, verifiedBy: null },
    include: { skill: { select: { name: true, aliases: true } } },
  });
  const matched = provisional.filter((es) =>
    [es.skill.name, ...es.skill.aliases].some((n) => topicMatches(topic, n))
  );
  if (matched.length === 0) return;

  // スキルごとに「お題が一致する問題への正解数（問題単位で重複排除）」を数える
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId, correct: true },
    select: { questionId: true, question: { select: { topic: true } } },
  });
  const byQuestion = new Map(attempts.map((a) => [a.questionId, norm(a.question.topic)]));

  for (const es of matched) {
    const names = [es.skill.name, ...es.skill.aliases]
      .map(norm)
      .filter((n) => n.length >= 2);
    const correctCount = [...byQuestion.values()].filter((t) =>
      names.some((n) => t.includes(n) || n.includes(t))
    ).length;
    if (correctCount >= 2) {
      await prisma.engineerSkill.update({
        where: { id: es.id },
        data: { verifiedBy: "quiz", verifiedAt: new Date() },
      });
    }
  }
}
