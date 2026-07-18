"use client";

// LOADING宇宙人（Issue #7）: 待ち時間に20種の宇宙人からランダムで1体が登場し、
// 3アクション（ぱたぱた/にっこり/ジャンプ）のどれかを演じる。待ち時間の「ガチャ」化。
//
// 塩梅のルール: 体感1秒を超える待ち（ルート遷移 loading.tsx・AI待ちの SendingOverlay）
// にだけ出す。保存やトグル等の一瞬の待ちには出さない（毎回出ると新鮮味が消えるため）。
// 直前に出た子は sessionStorage で避けて連続登場を防ぐ。
// アニメーション定義は globals.css の「LOADING宇宙人」ブロック。

import { useMemo, useSyncExternalStore } from "react";
import Image from "next/image";

export const ALIEN_COUNT = 20;
const ACTIONS = ["patapata", "nikkori", "jump"] as const;
type Action = (typeof ACTIONS)[number];
const LAST_KEY = "alien-last-id";

function pickAlien(): { id: number; action: Action } {
  let id = 1 + Math.floor(Math.random() * ALIEN_COUNT);
  try {
    const last = Number(sessionStorage.getItem(LAST_KEY));
    if (id === last) id = (id % ALIEN_COUNT) + 1; // 連続同キャラ回避
    sessionStorage.setItem(LAST_KEY, String(id));
  } catch {
    // sessionStorage不可でも動作は変えない
  }
  return { id, action: ACTIONS[Math.floor(Math.random() * ACTIONS.length)] };
}

const subscribeNoop = () => () => {};

export function LoadingAlien(props: { size?: number }) {
  const size = props.size ?? 96;
  // SSRとの不一致を避けるため、抽選はクライアント確定後に行う（1フレームの空白は許容）
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const pick = useMemo(() => (isClient ? pickAlien() : null), [isClient]);

  if (!pick) {
    return <div style={{ width: size, height: size }} aria-hidden="true" />;
  }
  const id = String(pick.id).padStart(2, "0");
  const imgStyle = {
    imageRendering: "pixelated",
    position: "absolute",
    inset: 0,
  } as const;
  return (
    <div
      className={`alien-${pick.action}`}
      style={{ width: size, height: size, position: "relative" }}
      aria-hidden="true"
    >
      <Image
        src={`/aliens/alien-${id}-normal.png`}
        alt=""
        width={size}
        height={size}
        style={imgStyle}
        unoptimized
        priority
      />
      <Image
        src={`/aliens/alien-${id}-smile.png`}
        alt=""
        width={size}
        height={size}
        style={imgStyle}
        className="alien-smile-img"
        unoptimized
        priority
      />
    </div>
  );
}
