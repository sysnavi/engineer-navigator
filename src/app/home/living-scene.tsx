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

  return (
    <div className="relative overflow-hidden rounded-lg border-[2.5px] border-line8">
      {/* 壁（まど付き） */}
      <div
        className="relative px-4 pb-2 pt-3"
        style={{ background: props.wallpaperCss, minHeight: 84 }}
      >
        <div className="mx-auto grid h-[58px] w-[92px] grid-cols-2 overflow-hidden rounded-md border-[2.5px] border-line8 bg-sky8/60">
          <i className="border-r-2 border-b-2 border-line8/60" />
          <i className="border-b-2 border-line8/60" />
          <i className="border-r-2 border-line8/60" />
          <i />
        </div>
      </div>

      {/* 床 + ラグ + ペット */}
      <div
        className="relative border-t-[2.5px] border-line8/40 px-4 pb-3 pt-2"
        style={{ background: props.floorCss, minHeight: 150 }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[72px] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-line8/50"
          style={{ background: "rgba(255,255,255,0.4)" }}
        />
        <div className="relative flex min-h-[110px] items-end">
          {pets.length === 0 && (
            <p className="w-full pb-4 text-center text-[12.5px] text-inksoft">
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
            return (
              <button
                key={p.id}
                onClick={() => onPet(p.id)}
                title={`${p.name}（なつき度 ${p.affection}・${affectionTier(p.affection)}）${p.pettedToday ? " きょうはなでなで済み" : " クリックでなでる"}`}
                className="pet-wander relative flex flex-col items-center"
                style={{
                  marginLeft: i === 0 ? `${(i * 13) % 30}px` : `${8 + ((i * 29) % 48)}px`,
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
              </button>
            );
          })}
          {pets.length > 0 && props.awayName && (
            <p className="absolute -bottom-1 right-0 font-pixel text-[9.5px] tracking-wide text-inksoft">
              {props.awayName}はデスクへおでかけ中
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
