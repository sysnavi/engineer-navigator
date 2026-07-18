"use client";

import { useState } from "react";
import { Window } from "@/components/retro";
import { PostForm } from "./post-form";

// 掲示板は「読む」が主役。普段はボタンだけ置き、押したら composer を開く。
// 投稿に成功したら自動で畳んでフィードに戻る。
export function Composer() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn8 btn8-start w-full py-3 text-[14px]"
      >
        ＋ 現場のできごとをつぶやく
      </button>
    );
  }

  return (
    <Window title="つぶやく" titleEm=".new">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-pixel text-[10px] tracking-wide text-inksoft">
          NEW POST
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-pixel text-[10px] tracking-wide text-inksoft hover:text-pinkhot"
        >
          × 閉じる
        </button>
      </div>
      <PostForm onPosted={() => setOpen(false)} />
      <p className="mt-2 rounded-lg border-2 border-dashed border-royal2 bg-quotebg px-3 py-2 text-[11.5px] text-inksoft">
        🛡 投稿前にAIが確認し、<b>個人名・会社名・案件名・著名人への言及・攻撃的な表現</b>
        を含む投稿はブロックされます。コメントも同じチェックを通ります。
      </p>
    </Window>
  );
}
