"use client";

// もりつけ演出（Issue #23）。ごはんは宙を飛ばない — 器にもりつけて差し出す。
//
// 器はごはんの「手前」に描く（お皿の縁・指がごはんに重なる）。これで
// 上に乗っているのではなく“中に入っている”ように見える。お皿の1行目は
// 奥側の縁だけにして中央を抜いてあるので、のり等の識別部分は隠れない。

import { FoodSprite, VesselSprite } from "@/components/pets/food-sprite";
import type { ServeMode } from "@/lib/pets/foods";

const FOOD_PX = 3;
const VESSEL_PX = 5;

/** 器の高さ(px) を基準にした重なり量。ごはんの底が器の内側に来る */
const OVERLAP: Record<"dish" | "hands", number> = {
  dish: 8, // お皿は高さ20px。手前側の数pxだけがごはんに重なる
  hands: 20, // てのひらは高さ35px。手のひら面(y=20)にごはんの底が乗る
};

export function FoodServe(props: {
  foodId: string;
  mode: ServeMode;
  /** 食べ進み（0=手つかず, 1=完食）。クリップで削る */
  eaten: number;
  /** 親からの配置（リビング内の%座標） */
  left: string;
  bottom: string;
}) {
  const vessel = props.mode === "hand" ? "hands" : "dish";
  const anim =
    props.mode === "hand" ? "food-rise" : "food-place";
  return (
    <span
      className={`pointer-events-none absolute z-[900] flex flex-col items-center ${anim}`}
      style={{ left: props.left, bottom: props.bottom }}
      aria-hidden="true"
    >
      <span
        style={{
          marginBottom: -OVERLAP[vessel],
          clipPath: `inset(0 ${Math.round(props.eaten * 100)}% 0 0)`,
        }}
      >
        <FoodSprite id={props.foodId} px={FOOD_PX} />
      </span>
      <VesselSprite kind={vessel} px={VESSEL_PX} />
      {props.mode === "together" && (
        // ちいさなおぜん（いっしょに いただきます）
        <span className="mt-[-2px] h-[9px] w-[74px] rounded-[3px] border-2 border-line8 bg-[#b98a5a]" />
      )}
    </span>
  );
}
