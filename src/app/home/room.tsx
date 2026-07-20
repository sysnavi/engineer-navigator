"use client";

// マイホームの部屋ビュー（Issue #2）。壁（棚スロット0-5）+ 床（スロット6-11）に
// ガジェットを飾り、床でペットが生活する（ゆらゆら歩き・ぴょこぴょこ・にっこり）。
// アニメは CSS steps() の8bit調。位置や周期はペットごとに決定的にずらす（乱数不使用）。

import { useState, useTransition } from "react";
import Image from "next/image";
import { petPet } from "./actions";
import { RARITY_LABELS, type Gadget } from "@/lib/dungeon/content";
import { speciesById } from "@/lib/pets/species";

export type RoomPet = {
  id: string;
  speciesId: string;
  name: string;
  affection: number;
  pettedToday: boolean;
};
export type PlacedGadget = Gadget & { homeSlot: number };

function affectionTier(a: number): string {
  if (a >= 15) return "かぞく";
  if (a >= 7) return "しんゆう";
  if (a >= 3) return "なかよし";
  return "であいたて";
}

export function Room(props: { pets: RoomPet[]; placed: PlacedGadget[] }) {
  const [pets, setPets] = useState(props.pets);
  const [hearts, setHearts] = useState<string | null>(null); // 直近なでたpetId
  const [, startTransition] = useTransition();

  const slotGadget = (slot: number) =>
    props.placed.find((g) => g.homeSlot === slot) ?? null;

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
    <div className="overflow-hidden rounded-lg border-[2.5px] border-line8">
      {/* 壁 + 棚（スロット0-5） */}
      <div className="bg-quotebg px-4 pb-3 pt-4">
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }, (_, slot) => {
            const g = slotGadget(slot);
            return (
              <div
                key={slot}
                title={g ? `${g.name} — ${g.flavor}` : "棚（あき）"}
                className={`grid aspect-square place-items-center rounded-md border-2 ${
                  g ? "border-line8 bg-win" : "border-dashed border-peri bg-white/40"
                }`}
                style={
                  g
                    ? { boxShadow: `inset 0 0 0 2px ${RARITY_LABELS[g.rarity].color}` }
                    : {}
                }
              >
                {g ? (
                  <Image
                    src={`/dungeon/cat-${g.category}.png`}
                    alt={g.name}
                    width={28}
                    height={28}
                    style={{ imageRendering: "pixelated" }}
                    unoptimized
                  />
                ) : (
                  <span className="font-pixel text-[9px] text-inksoft">·</span>
                )}
              </div>
            );
          })}
        </div>
        {/* 棚板 */}
        <div className="mt-1 h-1.5 rounded-sm bg-royal2/60" />
      </div>

      {/* 床（ペットの生活圏 + 床スロット6-11） */}
      <div className="relative border-t-[2.5px] border-line8 bg-surface px-4 pb-3 pt-2 min-h-[168px]">
        <div className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* 床の家具 */}
        <div className="relative grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }, (_, i) => {
            const slot = 6 + i;
            const g = slotGadget(slot);
            return (
              <div
                key={slot}
                title={g ? `${g.name} — ${g.flavor}` : "床（あき）"}
                className={`grid aspect-square place-items-center rounded-md border-2 ${
                  g ? "border-line8 bg-win" : "border-dashed border-transparent"
                }`}
                style={
                  g
                    ? { boxShadow: `inset 0 0 0 2px ${RARITY_LABELS[g.rarity].color}` }
                    : {}
                }
              >
                {g && (
                  <Image
                    src={`/dungeon/cat-${g.category}.png`}
                    alt={g.name}
                    width={30}
                    height={30}
                    style={{ imageRendering: "pixelated" }}
                    unoptimized
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ペットたち */}
        <div className="relative mt-2 flex min-h-[84px] items-end">
          {pets.length === 0 && (
            <p className="w-full pb-3 text-center text-[12.5px] text-inksoft">
              まだ誰も住んでいません。ときどき画面のすみに遊びに来る子に話しかけてみよう。
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
        </div>
      </div>

      {/* このビュー専用アニメ */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .pet-wander { animation: pet-wander 6s steps(12, end) infinite alternate; }
          .pet-heart { animation: pet-heart 1.6s steps(4, end) forwards; }
        }
        @keyframes pet-wander {
          from { transform: translateX(0); }
          to { transform: translateX(56px); }
        }
        @keyframes pet-heart {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-18px); }
        }
      `}</style>
    </div>
  );
}
