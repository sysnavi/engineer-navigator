"use client";

// 来訪者がいない日の「気配」演出。Visitorと同じ左下の定位置に小さな🐾だけ置き、
// タップでひとことが出る。あくまで空気づくりなので、モーダルは出さず邪魔をしない。
//
// - return: きょう逃した子が、あした確定で戻ってくる（encounter.tsの再訪保証と連動。
//   確定情報があるときだけ出す＝嘘の期待を作らない）
// - rumor:  ペット0匹の高頻度期間。「近いうちに来そう」の空気だけ

import { useState } from "react";

const LINES: Record<"return" | "rumor", string> = {
  return: "あしあとが のこっている……。あした、また来てくれるかも。",
  rumor: "どこかで ちいさな気配がする……。",
};

export function PresenceHint(props: { kind: "return" | "rumor" }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="no-print fixed bottom-16 left-3 z-20 flex flex-col items-start gap-0.5 sm:bottom-20"
      aria-label="なにかの気配がする"
    >
      {open && (
        <span className="max-w-[220px] rounded-md border-2 border-line8 bg-win px-2 py-1 text-left text-[11px] leading-relaxed text-inksoft shadow-hard-sm">
          {LINES[props.kind]}
        </span>
      )}
      <span className="text-[20px] opacity-60 drop-shadow-[2px_2px_0_rgba(18,35,95,0.25)]">
        🐾
      </span>
    </button>
  );
}
