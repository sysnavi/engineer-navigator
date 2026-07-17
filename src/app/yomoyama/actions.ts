"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { assertAiAllowed, AiBlockedError } from "@/lib/usage";
import { moderateYomoyama } from "@/lib/ai/moderation";

const MAX_LEN = 1000;

export type PostResult =
  | { ok: true }
  | { ok: false; error: string; issues?: string[] };

// 投稿はAI門番を通過したものだけ保存。ブロック時は理由を返してフォームに表示する
// （例外を投げるとエラー画面になるため、結果オブジェクトで返す）。
export async function postYomoyama(body: string): Promise<PostResult> {
  const user = await getCurrentUser();
  const text = (body ?? "").trim();

  if (!text) return { ok: false, error: "本文を入力してください。" };
  if (text.length > MAX_LEN) {
    return { ok: false, error: `本文は${MAX_LEN}文字以内でお願いします。` };
  }

  // レート制限・停止チェック（トークンを使う前に）
  try {
    await assertAiAllowed(user.id, "yomoyama-moderation");
  } catch (e) {
    if (e instanceof AiBlockedError) return { ok: false, error: e.userMessage };
    throw e;
  }

  // AI門番。失敗時は fail-closed（安全側）でブロックする
  let verdict;
  try {
    verdict = await moderateYomoyama(text);
  } catch (e) {
    console.error("moderateYomoyama failed:", e);
    return {
      ok: false,
      error:
        "いま投稿内容を確認できませんでした（AIチェックに失敗）。時間をおいて再度お試しください。",
    };
  }

  if (!verdict.allow) {
    return {
      ok: false,
      error:
        "この投稿は掲載できません。個人・会社が特定できる内容や、著名人への言及、攻撃的な表現は避けてください。",
      issues: [...verdict.issues, verdict.advice].filter(Boolean),
    };
  }

  await prisma.yomoyamaPost.create({
    data: { authorId: user.id, body: text },
  });
  revalidatePath("/yomoyama");
  return { ok: true };
}
