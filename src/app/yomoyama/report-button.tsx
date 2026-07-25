"use client";

import { useState, useTransition } from "react";
import { reportPost } from "./actions";
import { REPORT_CATEGORIES } from "./report-categories";
import { notify } from "@/components/toast";

// 投稿の通報ボタン（Issue #16）。公開UGCの安全機構。押すと理由の選択を出し、
// 送信すると運営に届く（一覧はそのまま＝即時非表示にはしない。運営が確認して措置）。
export function ReportButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("spam");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <span className="font-pixel text-[10px] tracking-wide text-inksoft">
        通報しました
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-pixel text-[10px] tracking-wide text-inksoft underline-offset-2 hover:text-pinkhot hover:underline"
      >
        通報
      </button>
    );
  }

  const submit = () =>
    start(async () => {
      const r = await reportPost(postId, category, note);
      if (r.ok) {
        setDone(true);
        notify("ok", "通報を受け付けました。運営が確認します。");
      } else {
        notify("error", r.error ?? "通報できませんでした。");
      }
    });

  return (
    <div className="mt-2 w-full rounded-lg border-2 border-dashed border-pinkhot bg-quotebg px-3 py-2.5">
      <p className="font-pixel text-[10px] tracking-wide text-pinkhot">
        この投稿を通報
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(REPORT_CATEGORIES).map(([id, label]) => (
          <label key={id} className="flex items-center gap-1 text-[12px]">
            <input
              type="radio"
              name={`report-${postId}`}
              value={id}
              checked={category === id}
              onChange={() => setCategory(id)}
              className="accent-[var(--pink-hot)]"
            />
            {label}
          </label>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="補足（任意）"
        className="field8 mt-2 w-full text-[12px]"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="btn8 btn8-start px-3 py-1 text-[11px] disabled:opacity-50"
        >
          {pending ? "送信中…" : "通報する"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="btn8 px-3 py-1 text-[11px]"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
