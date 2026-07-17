"use client";

import { useState, useTransition } from "react";
import { toggleReportPublic } from "@/app/actions";

// 提出済み週報の公開トグル（マイページの共有設定内）。
// 公開しても、コンディション等の非公開項目は公開ビューに含まれない。

export function ReportToggle(props: {
  id: string;
  label: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(props.initial);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    start(async () => {
      try {
        await toggleReportPublic(props.id, next);
      } catch {
        setOn(!next); // 失敗したら戻す
      }
    });
  }

  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border-2 border-line8 bg-surface px-3 py-2 shadow-hard-sm">
      <span className="text-[12.5px]">{props.label}</span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className={`shrink-0 rounded border-2 border-line8 px-2.5 py-1 font-pixel text-[11px] shadow-hard-sm ${
          on ? "bg-royal text-white" : "bg-win text-inksoft"
        }`}
      >
        {on ? "公開中" : "非公開"}
      </button>
    </label>
  );
}
