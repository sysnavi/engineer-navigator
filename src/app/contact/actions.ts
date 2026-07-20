"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import {
  INQUIRY_CATEGORIES,
  isInquiryCategory,
  validateBody,
  PER_DAY_LIMIT,
  BODY_MIN,
} from "@/lib/inquiry";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export type ContactResult = { ok: true; savedToAccount: boolean } | { ok: false; error: string };

/** 問い合わせを送る。
 *  ログイン済み → Inquiry に保存（返信はマイページで受け取る）＋Slack通知
 *  未ログイン   → **DBに保存せず** Slack通知のみ（PII非保持方針）。
 *                 任意メールも通知本文に載せるだけで保存しない。 */
export async function submitInquiry(formData: FormData): Promise<ContactResult> {
  const category = formData.get("category");
  if (!isInquiryCategory(category)) {
    return { ok: false, error: "種類を選んでください" };
  }
  const body = validateBody(formData.get("body"));
  if (!body) {
    return { ok: false, error: `内容は${BODY_MIN}文字以上で書いてください` };
  }

  const user = await getOptionalUser();
  const label = INQUIRY_CATEGORIES[category];

  // --- 未ログイン: 保存しない一方通行 ---
  if (!user) {
    const rawReply = formData.get("replyTo");
    const replyTo =
      typeof rawReply === "string" && rawReply.trim() ? rawReply.trim().slice(0, 120) : null;
    await notify(
      [
        `📮 未ログインからの問い合わせ（DB非保存）`,
        `種類: ${label}`,
        `内容: ${body}`,
        replyTo ? `返信先(保存していません): ${replyTo}` : `返信先: なし（一方通行）`,
      ].join("\n")
    );
    return { ok: true, savedToAccount: false };
  }

  // --- ログイン済み: アカウントに紐づけて保存 ---
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.inquiry.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  if (recent >= PER_DAY_LIMIT) {
    return {
      ok: false,
      error: `24時間に送れるのは${PER_DAY_LIMIT}件までです。少し時間をおいてからお願いします`,
    };
  }

  const inquiry = await prisma.inquiry.create({
    data: { userId: user.id, category, body },
  });
  await notify(
    [
      `📮 問い合わせが届きました`,
      `種類: ${label}`,
      `送信者: ${user.handle ?? user.name}`,
      `内容: ${body}`,
      `対応: ${APP_URL}/admin/inquiries`,
    ].join("\n")
  );

  revalidatePath("/mypage");
  revalidatePath("/admin/inquiries");
  return { ok: true, savedToAccount: !!inquiry };
}

/** 運営からの返信を既読にする（マイページで開いたとき） */
export async function markInquiryRead(inquiryId: string) {
  const user = await getOptionalUser();
  if (!user) return;
  await prisma.inquiry.updateMany({
    where: { id: inquiryId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/mypage");
}
