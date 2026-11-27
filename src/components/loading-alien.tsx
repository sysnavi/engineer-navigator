"use client";

// LOADING宇宙人（Issue #7）: 待ち時間に20種の宇宙人からランダムで1体が登場し、
// 3アクション（ぱたぱた/にっこり/ジャンプ）のどれかを演じる。待ち時間の「ガチャ」化。
// 絵は public/aliens/vox/alien-NN.vox（3D の原本。MagicaVoxel で直せる）。2D の PNG は読み込み中の代わり。
//
// 塩梅のルール: 体感1秒を超える待ち（ルート遷移 loading.tsx・AI待ちの SendingOverlay）
// にだけ出す。保存やトグル等の一瞬の待ちには出さない（毎回出ると新鮮味が消えるため）。
// 直前に出た子は sessionStorage で避けて連続登場を防ぐ。
// アニメーション定義は globals.css の「LOADING宇宙人」ブロック。

import { useMemo, useSyncExternalStore } from "react";
import { StackSprite, type StackAction } from "@/components/stack-sprite";

export const ALIEN_COUNT = 20;
const ACTIONS = ["patapata", "nikkori", "jump"] as const;
type Action = (typeof ACTIONS)[number];
const LAST_KEY = "alien-last-id";
const STACK_ACTION: Record<Action, StackAction> = { patapata: "turn", nikkori: "smile", jump: "idle" };

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
  // 3D（スプライトスタッキング）で描く。読み込むまでは2Dの絵を出しておく。
  // ぱたぱた＝その場でくるっと回る / にっこり＝笑顔になる / ジャンプ＝跳ねる（跳ねは globals.css の器の動き）
  return (
    <div className={`alien-${pick.action}`} style={{ width: size, height: size }} aria-hidden="true">
      <StackSprite
        src={`/aliens/vox/alien-${id}.vox`}
        fallback={`/aliens/alien-${id}-normal.png`}
        size={size}
        action={STACK_ACTION[pick.action]}
      />
    </div>
  );
}
