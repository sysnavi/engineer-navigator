"use client";

import { useCallback, useEffect, useRef } from "react";

// 演出用の「◯秒後に〜する」をコンポーネントで安全に書くための共通フック。
// 生の setTimeout は、アンマウント後に setState が走ったり、連打でタイマーが重なったりする。
// ここで予約したタイマーはアンマウント時にまとめて解除される。
//
//   const { schedule, clearAll } = useTimeout();
//   schedule(() => setBubble(null), 3600);          // 戻り値の cancel() で個別に取り消せる
//
// eslint.config.mjs の no-restricted-syntax が、生の setTimeout をここへ誘導している。

export function useTimeout() {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const clearAll = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
  }, []);

  useEffect(() => clearAll, [clearAll]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
    return () => {
      clearTimeout(t);
      timers.current.delete(t);
    };
  }, []);

  return { schedule, clearAll };
}
