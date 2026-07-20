"use client";

// LIVING.sav — ペットが暮らすリビング（Issue #12 松）。
// 旧 room.tsx から分離してペット専用に。ラグとまど（CSS描き）のうえで
// ゆらゆら歩き・なでなで（1日1回）。デスクに遊びに行っている子はここには居ない。

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { petPet } from "./actions";
import { speciesById } from "@/lib/pets/species";

export type RoomPet = {
  id: string;
  speciesId: string;
  name: string;
  affection: number;
  pettedToday: boolean;
};

function affectionTier(a: number): string {
  if (a >= 15) return "かぞく";
  if (a >= 7) return "しんゆう";
  if (a >= 3) return "なかよし";
  return "であいたて";
}

export function LivingScene(props: {
  pets: RoomPet[];
  wallpaperCss: string;
  floorCss: string;
  awayName: string | null; // デスクへ遊びに行っている子（表示だけ）
}) {
  const [pets, setPets] = useState(props.pets);
  const [hearts, setHearts] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // サーバーアクション後の再レンダーで新入りペット等を反映（props→state同期）
  const propsKey = JSON.stringify(props.pets);
  const lastKey = useRef(propsKey);
  if (lastKey.current !== propsKey) {
    lastKey.current = propsKey;
    if (pets !== props.pets) setPets(props.pets);
  }

  const onPet = (petId: string) => {
    setHearts(petId);
    setTimeout(() => setHearts((h) => (h === petId ? null : h)), 1600);
    startTransition(async () => {
      try {
        const r = await petPet(petId);
        setPets((ps) =>
          ps.map((p) =>
            p.id === petId ? { ...p, affection: r.affection, pettedToday: true } : p
          )
        );
      } catch {
        // なでなで失敗で画面は壊さない
      }
    });
  };

  // 3/4見下ろし: ペットは床に散らばって暮らす（座標は匹ごとに決定的・y=奥行きで前後関係）
  const spot = (i: number) => ({
    x: 16 + ((i * 37) % 62),
    y: 42 + ((i * 23) % 46),
  });

  return (
    <div className="relative aspect-[16/8] w-full select-none overflow-hidden rounded-lg border-[2.5px] border-line8 sm:aspect-[16/6]">
      {/* 上部の細い壁（まど付き） */}
      <div
        className="absolute inset-x-0 top-0 border-b-[3px] border-line8"
        style={{ height: "30%", background: props.wallpaperCss }}
      >
        <div className="absolute left-1/2 top-[14%] grid h-[70%] w-[88px] -translate-x-1/2 grid-cols-2 overflow-hidden rounded-md border-[2.5px] border-line8 bg-sky8/60">
          <i className="border-b-2 border-r-2 border-line8/60" />
          <i className="border-b-2 border-line8/60" />
          <i className="border-r-2 border-line8/60" />
          <i />
        </div>
      </div>
      {/* 大きな床 + 幅木の影 */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: "70%", background: props.floorCss }}
      />
      <div
        className="absolute inset-x-0"
        style={{ top: "30%", height: "3%", background: "rgba(0,0,0,0.14)" }}
      />
      {/* ラグ（キャラと同じ極太アウトライン + デスクと同じ右斜め上からの斜投影） */}
      <div
        className="pointer-events-none absolute left-1/2 top-[68%] h-[24%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-[2.5px] border-line8"
        style={{
          background:
            "radial-gradient(circle at 3px 3px, rgba(255,255,255,0.5) 1.5px, transparent 1.5px) 0 0 / 10px 10px, rgba(255,255,255,0.45)",
          transform: "translate(-50%, -50%) skewX(12deg)",
        }}
      />

      {pets.length === 0 && (
        <p className="absolute inset-x-0 top-[55%] px-4 text-center text-[12.5px] text-inksoft">
          {props.awayName
            ? `${props.awayName}はデスクに遊びに行っています`
            : "まだ誰も住んでいません。ときどき画面のすみに遊びに来る子に話しかけてみよう。"}
        </p>
      )}
      {pets.map((p, i) => {
        const sp = speciesById(p.speciesId);
        if (!sp) return null;
        const happy = sp.sprites.happy ?? sp.sprites.normal;
        const showHappy = hearts === p.id;
        const pos = spot(i);
        return (
          <button
            key={p.id}
            onClick={() => onPet(p.id)}
            title={`${p.name}（なつき度 ${p.affection}・${affectionTier(p.affection)}）${p.pettedToday ? " きょうはなでなで済み" : " クリックでなでる"}`}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `${pos.x}%`,
              top: `${30 + pos.y * 0.7}%`,
              zIndex: 10 + Math.round(pos.y * 10),
            }}
          >
            <span
              className="pet-wander relative flex flex-col items-center"
              style={{
                animationDuration: `${5 + (i % 4) * 1.4}s`,
                animationDelay: `${(i % 5) * -1.3}s`,
              }}
            >
              {hearts === p.id && (
                <span className="pet-heart absolute -top-4 font-pixel text-[13px] text-pinkhot">
                  ♥
                </span>
              )}
              <span className={showHappy ? "" : "alien-patapata"} style={{ animationDuration: "0.9s" }}>
                <Image
                  src={showHappy ? happy : sp.sprites.normal}
                  alt={p.name}
                  width={52}
                  height={52}
                  style={{ imageRendering: "pixelated" }}
                  unoptimized
                />
              </span>
              <span className="rounded border-2 border-line8 bg-win px-1 font-pixel text-[9px] tracking-wide">
                {p.name}
              </span>
            </span>
          </button>
        );
      })}
      {pets.length > 0 && props.awayName && (
        <p className="absolute bottom-1 right-2 z-[1200] font-pixel text-[9.5px] tracking-wide text-inksoft">
          {props.awayName}はデスクへおでかけ中
        </p>
      )}
    </div>
  );
}
