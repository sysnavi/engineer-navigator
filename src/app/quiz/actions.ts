"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireFullAccountUser } from "@/lib/guest";
import { isDomainId } from "@/lib/domains";

// 良問バンクのサーバーアクション。四択の採点はここ（サーバー）で行い、正解は
// クライアントに渡さない。AIは使わないのでトークン消費はゼロ。

const MAX_LEN = 500;

/** 四択問題を作成（作成者＝本人） */
export async function createQuizQuestion(formData: FormData) {
  const user = await requireFullAccountUser();
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };

  const topic = str("topic");
  const prompt = str("prompt");
  const choices = [0, 1, 2, 3].map((i) => str(`choice${i}`));
  const explanation = str("explanation");
  const answerIndex = Number(formData.get("answerIndex"));
  const domains = formData
    .getAll("domains")
    .filter((v): v is string => typeof v === "string")
    .filter(isDomainId);

  if (!topic) throw new Error("お題（トピック）を入力してください。");
  if (!prompt) throw new Error("問題文を入力してください。");
  if (choices.some((c) => !c)) throw new Error("選択肢は4つすべて入力してください。");
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    throw new Error("正解の選択肢を選んでください。");
  }
  if (prompt.length > MAX_LEN || choices.some((c) => c.length > MAX_LEN)) {
    throw new Error("入力が長すぎます。");
  }

  await prisma.quizQuestion.create({
    data: {
      authorId: user.id,
      topic: topic.slice(0, 80),
      prompt,
      choices,
      answerIndex,
      explanation: explanation || null,
      domains: Array.from(new Set(domains)),
    },
  });
  revalidatePath("/quiz");
  redirect("/quiz");
}

export type AnswerResult = {
  correct: boolean;
  answerIndex: number;
  explanation: string | null;
};

/** 解答を採点し履歴を記録して返す（正解はここで初めて開示） */
export async function submitQuizAnswer(
  questionId: string,
  chosenIndex: number
): Promise<AnswerResult> {
  const user = await getCurrentUser();
  const q = await prisma.quizQuestion.findUniqueOrThrow({
    where: { id: questionId },
    select: { answerIndex: true, explanation: true, choices: true, topic: true },
  });
  if (
    !Number.isInteger(chosenIndex) ||
    chosenIndex < 0 ||
    chosenIndex >= q.choices.length
  ) {
    throw new Error("不正な選択です。");
  }
  const correct = chosenIndex === q.answerIndex;
  await prisma.quizAttempt.create({
    data: { questionId, userId: user.id, chosenIndex, correct },
  });
  // トークンゼロの裏取り経路（Issue #25）: 正解が仮判定スキルの検証になる
  if (correct) {
    await promoteSkillsVerifiedByQuiz(user.id, q.topic).catch((e) =>
      console.error("promoteSkillsVerifiedByQuiz failed:", e)
    );
  }
  return { correct, answerIndex: q.answerIndex, explanation: q.explanation };
}

/** 仮判定スキルのうち、お題（topic）が一致する問題に累計2問正解したものを
 *  「腕試しで検証済み」へ昇格させる。AI費ゼロで検証が回る経路（Issue #25） */
async function promoteSkillsVerifiedByQuiz(userId: string, topic: string) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const topicNorm = norm(topic);

  // いま解いた問題のお題に関係する仮判定スキルだけを対象にする
  const provisional = await prisma.engineerSkill.findMany({
    where: { userId, verifiedBy: null },
    include: { skill: { select: { name: true, aliases: true } } },
  });
  const matched = provisional.filter((es) =>
    [es.skill.name, ...es.skill.aliases].some((n) => {
      const nn = norm(n);
      return nn.length >= 2 && (topicNorm.includes(nn) || nn.includes(topicNorm));
    })
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

/** 「もう表示しない」の設定（本人にだけ以後出題されなくなる） */
export async function setQuizHidden(questionId: string, hidden: boolean) {
  const user = await requireFullAccountUser();
  if (hidden) {
    await prisma.quizHidden.upsert({
      where: { questionId_userId: { questionId, userId: user.id } },
      create: { questionId, userId: user.id },
      update: {},
    });
  } else {
    await prisma.quizHidden.deleteMany({
      where: { questionId, userId: user.id },
    });
  }
}

/** 問題を0-10で評価（1人1票・上書き可）。全員分を集計して良問スコアに反映。 */
export async function rateQuiz(questionId: string, score: number) {
  const user = await requireFullAccountUser();
  const s = Math.max(0, Math.min(10, Math.round(score)));

  await prisma.$transaction(async (tx) => {
    await tx.quizRating.upsert({
      where: { questionId_userId: { questionId, userId: user.id } },
      create: { questionId, userId: user.id, score: s },
      update: { score: s },
    });
    const agg = await tx.quizRating.aggregate({
      where: { questionId },
      _sum: { score: true },
      _count: true,
    });
    await tx.quizQuestion.update({
      where: { id: questionId },
      data: { ratingSum: agg._sum.score ?? 0, ratingCount: agg._count },
    });
  });
  revalidatePath("/quiz");
}
