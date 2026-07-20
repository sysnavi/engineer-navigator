// マイページの「運営とのやりとり」（Issue #9）。
// 返信はメールではなくここに届く。開いた時点で既読にする。

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { markInquiryRead } from "@/app/contact/actions";
import {
  INQUIRY_CATEGORIES,
  STATUS_LABELS,
  type InquiryCategory,
  type InquiryStatus,
} from "@/lib/inquiry";

export type ThreadItem = {
  id: string;
  category: string;
  body: string;
  status: string;
  adminReply: string | null;
  createdAt: string;
  repliedAt: string | null;
  unread: boolean;
};

export function InquiryThread(props: { items: ThreadItem[] }) {
  const unreadIds = props.items.filter((i) => i.unread).map((i) => i.id);

  // 返信が表示された＝読んだとみなして既読にする（バッジを消すため）
  useEffect(() => {
    if (unreadIds.length === 0) return;
    const t = setTimeout(() => {
      unreadIds.forEach((id) => void markInquiryRead(id));
    }, 1200);
    return () => clearTimeout(t);
    // 依存はIDの中身。配列参照の変化では再実行しない
  }, [unreadIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (props.items.length === 0) {
    return (
      <p className="text-[12.5px] text-inksoft">
        まだやりとりはありません。不具合や要望は{" "}
        <Link href="/contact" className="font-bold text-royal2 hover:text-pinkhot">
          お問い合わせ
        </Link>{" "}
        からどうぞ（返信はここに届きます）。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {props.items.map((q) => (
        <div
          key={q.id}
          className={`rounded-lg border-2 px-3 py-2.5 ${
            q.unread ? "border-pinkhot bg-quotebg" : "border-dashed border-peri bg-surface"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-pixel tracking-wide text-royal2">
              {INQUIRY_CATEGORIES[q.category as InquiryCategory] ?? q.category}
            </span>
            <span className="text-inksoft">{q.createdAt}</span>
            <span className="ml-auto font-pixel text-[10px] text-inksoft">
              {STATUS_LABELS[q.status as InquiryStatus] ?? q.status}
            </span>
            {q.unread && (
              <span className="rounded-md border-2 border-line8 bg-pinkhot px-1.5 py-0.5 font-pixel text-[9.5px] text-white">
                NEW
              </span>
            )}
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed">{q.body}</p>
          {q.adminReply && (
            <div className="mt-2 rounded-md border-2 border-line8 bg-win px-2.5 py-2">
              <p className="font-pixel text-[10px] tracking-wide text-royal">
                運営より{q.repliedAt ? `（${q.repliedAt}）` : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed">
                {q.adminReply}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
