"use client";

// 宝箱の開封演出（一人称ビューの上に重ねる）。
//
// 以前は「宝箱を見つけた！」「〇〇を手に入れた！」の文字だけで、画面には何も映っていなかった
// （宝箱の上に立つと宝箱の描画ごと消えていた）。ガチャの気持ちよさは「開く瞬間」にあるので、
//  found: 宝箱がガタガタ揺れてタメる（DivePlayer がこのログの後に少し間を置く）
//  open : フタが跳ね上がり、レア度の色の光が漏れ、ガジェットが弧を描いて飛び出す →
//         レア度バッジが「ドン」と押され、flavor が1行出る。空っぽ（ミミック）なら「304」が浮いて消える
// 動きは全部 CSS（globals.css の .cr-*）。reduced-motion では最終状態だけを出す。

import type { BattleLog } from "@/lib/dungeon/battle";

type Chest = NonNullable<BattleLog["chest"]>;
type Rarity = "N" | "R" | "SR" | "SSR" | "UR";

/** 光とバッジの色（ビューは常に暗い背景なのでテーマに依らず固定色） */
const RARITY_GLOW: Record<Rarity, string> = {
  N: "#e8f0ff",
  R: "#7cc8ff",
  SR: "#b98cff",
  SSR: "#ffd84d",
  UR: "#ff5bb0",
};
const HIGH: Rarity[] = ["SR", "SSR", "UR"];

/** 32×24 のドット宝箱。フタは別グループにして開閉させる */
function ChestSprite(props: { open: boolean }) {
  return (
    <svg viewBox="0 0 32 24" className="cr-chest-svg" shapeRendering="crispEdges" aria-hidden>
      {/* 中身の暗がり（フタが開くと見える） */}
      <rect x="3" y="11" width="26" height="3" fill="#0a0e24" />
      {/* 箱 */}
      <rect x="2" y="13" width="28" height="10" fill="#7a4e28" />
      <rect x="2" y="13" width="28" height="2" fill="#96623a" />
      <rect x="2" y="21" width="28" height="2" fill="#5a3818" />
      <rect x="7" y="13" width="2" height="10" fill="#e0b440" />
      <rect x="23" y="13" width="2" height="10" fill="#e0b440" />
      <rect x="14" y="14" width="4" height="4" fill="#ffd84d" />
      <rect x="15" y="16" width="2" height="1" fill="#5a3818" />
      {/* フタ */}
      <g className={props.open ? "cr-lid cr-lid-open" : "cr-lid"}>
        <rect x="3" y="4" width="26" height="2" fill="#b07444" />
        <rect x="2" y="6" width="28" height="7" fill="#96623a" />
        <rect x="2" y="11" width="28" height="2" fill="#6a4220" />
        <rect x="7" y="4" width="2" height="9" fill="#ffd84d" />
        <rect x="23" y="4" width="2" height="9" fill="#ffd84d" />
        <rect x="14" y="10" width="4" height="3" fill="#ffd84d" />
      </g>
    </svg>
  );
}

export function ChestReveal(props: { chest: Chest }) {
  const { chest } = props;
  const g = chest.stage === "open" ? chest.gadget : undefined;
  const glow = g ? RARITY_GLOW[g.rarity] : "#9fb0d0";
  const high = !!g && HIGH.includes(g.rarity);

  return (
    <div
      className={`cr-root ${chest.stage === "open" ? "cr-open" : "cr-found"} ${high ? "cr-high" : ""}`}
      style={{ ["--cr-glow" as string]: glow }}
      aria-hidden
    >
      {/* 光（フタが開いてから） */}
      {chest.stage === "open" && g && <div className="cr-beam" />}
      {chest.stage === "open" && high && <div className="cr-flash" />}

      <div className="cr-stage">
        {/* 飛び出すガジェット */}
        {g && (
          <div className="cr-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/dungeon/${g.sprite}.png`} alt="" className="cr-item-img" />
          </div>
        )}
        {/* 空っぽ: 304 が浮いて消える */}
        {chest.stage === "open" && !g && <div className="cr-304 font-pixel">304</div>}

        <div className={chest.stage === "found" ? "cr-chest cr-rattle" : "cr-chest"}>
          <ChestSprite open={chest.stage === "open"} />
        </div>

        {g && (
          <span className="cr-badge font-pixel" style={{ color: glow, borderColor: glow }}>
            {g.rarity}
          </span>
        )}
      </div>

      {g && (
        <p className="cr-flavor">
          <span className="cr-flavor-name">{g.name}</span>
          <span className="cr-flavor-text">{g.flavor}</span>
        </p>
      )}
    </div>
  );
}
