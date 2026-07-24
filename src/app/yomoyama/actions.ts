"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireFullAccountUser } from "@/lib/guest";
import { assertAiAllowed, AiBlockedError } from "@/lib/usage";
import { moderateYomoyama } from "@/lib/ai/moderation";

const MAX_LEN = 1000;

export type PostResult =
  | { ok: true }
  | { ok: false; error: string; issues?: string[] };

// 投稿はAI門番を通過したものだけ保存。ブロック時は理由を返してフォームに表示する
// （例外を投げるとエラー画面になるため、結果オブジェクトで返す）。
export async function postYomoyama(body: string): Promise<PostResult> {
  const user = await requireFullAccountUser();
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

// --- いいね（非AI・軽量レート制限） ---
const LIKE_MAX_PER_MIN = 40;

export type LikeResult = { liked: boolean; count: number };

/** いいねのトグル。連打はレート制限、停止中は不可。新しい状態と件数を返す。 */
export async function toggleLike(postId: string): Promise<LikeResult> {
  const user = await requireFullAccountUser();
  if (user.suspendedAt) {
    throw new Error("アカウントが停止中のため操作できません。");
  }

  const existing = await prisma.yomoyamaLike.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
    select: { id: true },
  });

  if (existing) {
    await prisma.yomoyamaLike.delete({ where: { id: existing.id } });
  } else {
    // 付与時のみ連打制限（直近1分のいいね数）
    const since = new Date(Date.now() - 60_000);
    const recent = await prisma.yomoyamaLike.count({
      where: { userId: user.id, createdAt: { gte: since } },
    });
    if (recent >= LIKE_MAX_PER_MIN) {
      throw new Error("少し時間をおいてね（いいねが多すぎます）。");
    }
    await prisma.yomoyamaLike.create({ data: { postId, userId: user.id } });
  }

  const count = await prisma.yomoyamaLike.count({ where: { postId } });
  revalidatePath("/yomoyama");
  return { liked: !existing, count };
}

// --- コメント（投稿と同じAI門番＋レート制限） ---
const COMMENT_MAX_LEN = 500;

/** コメント投稿。allowComments・レート制限・AI門番を通過したものだけ保存。 */
export async function addComment(
  postId: string,
  body: string
): Promise<PostResult> {
  const user = await requireFullAccountUser();
  const text = (body ?? "").trim();

  if (!text) return { ok: false, error: "コメントを入力してください。" };
  if (text.length > COMMENT_MAX_LEN) {
    return { ok: false, error: `コメントは${COMMENT_MAX_LEN}文字以内でお願いします。` };
  }

  const post = await prisma.yomoyamaPost.findUnique({
    where: { id: postId },
    select: { allowComments: true },
  });
  if (!post) return { ok: false, error: "投稿が見つかりません。" };
  if (!post.allowComments) {
    return { ok: false, error: "この投稿はコメントを受け付けていません。" };
  }

  try {
    await assertAiAllowed(user.id, "yomoyama-comment");
  } catch (e) {
    if (e instanceof AiBlockedError) return { ok: false, error: e.userMessage };
    throw e;
  }

  let verdict;
  try {
    verdict = await moderateYomoyama(text);
  } catch (e) {
    console.error("moderateYomoyama(comment) failed:", e);
    return {
      ok: false,
      error:
        "いまコメントを確認できませんでした（AIチェックに失敗）。時間をおいて再度お試しください。",
    };
  }
  if (!verdict.allow) {
    return {
      ok: false,
      error:
        "このコメントは掲載できません。個人・会社が特定できる内容や、著名人への言及、攻撃的な表現は避けてください。",
      issues: [...verdict.issues, verdict.advice].filter(Boolean),
    };
  }

  await prisma.yomoyamaComment.create({
    data: { postId, authorId: user.id, body: text },
  });
  revalidatePath("/yomoyama");
  return { ok: true };
}

/** 投稿者本人がコメント受付を切り替える */
export async function setAllowComments(postId: string, allow: boolean) {
  const user = await requireFullAccountUser();
  const post = await prisma.yomoyamaPost.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post || post.authorId !== user.id) {
    throw new Error("自分の投稿のみ設定できます。");
  }
  await prisma.yomoyamaPost.update({
    where: { id: postId },
    data: { allowComments: allow },
  });
  revalidatePath("/yomoyama");
}

/** 管理者がコメントをソフト削除する（監査のため削除者を記録） */
export async function deleteComment(commentId: string) {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") {
    throw new Error("この操作は管理者のみ実行できます。");
  }
  await prisma.yomoyamaComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date(), deletedById: me.id },
  });
  revalidatePath("/yomoyama");
}
