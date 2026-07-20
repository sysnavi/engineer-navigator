"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const REPLY_MAX = 2000;

async function assertAdmin() {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") throw new Error("管理者のみが操作できます");
  return me;
}

/** 問い合わせに返信する。返信はサイト内（マイページ）でユーザーに届く */
export async function replyToInquiry(inquiryId: string, formData: FormData) {
  await assertAdmin();
  const raw = formData.get("reply");
  const reply = typeof raw === "string" ? raw.trim().slice(0, REPLY_MAX) : "";
  if (!reply) throw new Error("返信内容を入力してください");

  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: {
      adminReply: reply,
      repliedAt: new Date(),
      status: "REPLIED",
      readAt: null, // 返信を書き換えたら未読に戻す
    },
  });
  revalidatePath("/admin/inquiries");
  revalidatePath("/mypage");
}

/** 対応不要・完了したものを閉じる（返信なしでも閉じられる） */
export async function closeInquiry(inquiryId: string) {
  await assertAdmin();
  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "CLOSED" },
  });
  revalidatePath("/admin/inquiries");
  revalidatePath("/mypage");
}

/** 閉じたものを未対応に戻す */
export async function reopenInquiry(inquiryId: string) {
  await assertAdmin();
  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "OPEN" },
  });
  revalidatePath("/admin/inquiries");
  revalidatePath("/mypage");
}
