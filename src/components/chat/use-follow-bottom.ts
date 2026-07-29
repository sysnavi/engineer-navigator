"use client";

import { useEffect, useRef, useState } from "react";

// チャットの自動スクロール追従。
// 最下部付近にいる間だけ新着に追従し、ユーザーが上へ読み戻したら追従を止める
// （ストリーミング中に画面を持っていかれるストレスを消す）。
// behavior未指定(=instant)でスクロールする。smoothだと更新毎のアニメが衝突してガタつく。

const NEAR_BOTTOM_PX = 120;

export function useFollowBottom(dep: unknown) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false); // ユーザーが上へ読み戻している
  const awayRef = useRef(false);

  useEffect(() => {
    function onScroll() {
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
      awayRef.current = !nearBottom;
      setAway(!nearBottom);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // dep（メッセージ列）が変わるたび、追従中なら最下部へ
  useEffect(() => {
    if (!awayRef.current) bottomRef.current?.scrollIntoView();
  }, [dep]);

  function jumpToBottom() {
    // scrollイベントでも解除されるが、押した瞬間にピルを消したいので即時反映
    awayRef.current = false;
    setAway(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return { bottomRef, away, jumpToBottom };
}
