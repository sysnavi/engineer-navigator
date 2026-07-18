"use client";

import { useState, useTransition } from "react";
import { toggleLike } from "./actions";

// 8bitのドットハート型いいねボタン。楽観更新し、失敗したら元に戻す。
export function LikeButton(props: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(props.initialLiked);
  const [count, setCount] = useState(props.initialCount);
  const [pending, start] = useTransition();

  function onClick() {
    if (pending) return;
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));
    start(async () => {
      try {
        const res = await toggleLike(props.postId);
        setLiked(res.liked);
        setCount(res.count);
      } catch {
        setLiked(prevLiked);
        setCount(prevCount);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "いいねを取り消す" : "いいねする"}
      className={`inline-flex items-center gap-1 rounded-md border-2 border-line8 px-2 py-0.5 font-pixel text-[11px] shadow-hard-sm transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
        liked ? "bg-pinkhot text-white" : "bg-win text-inksoft hover:text-pinkhot"
      }`}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
