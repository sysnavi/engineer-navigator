"use client";

// DESKTOP.sav — ガジェットで組む作業環境シーン（Issue #12 松）。
// ドラッグ（Pointer Eventsなのでマウス/タッチ共通）で自由配置、
// つかんだものは最前面へ。右下の収納BOXに落とすとしまえる。
// デスクはコレクションから決定的に進化（scene.ts の deskTier）。

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { Gadget, GadgetCategory } from "@/lib/dungeon/content";
import { RARITY_LABELS } from "@/lib/dungeon/content";
import {
  allowedZones,
  clampToZones,
  ZONES,
  type DeskTier,
} from "@/lib/home/scene";
import { speciesById } from "@/lib/pets/species";
import { moveGadget, stowGadget, petPet } from "./actions";

export type DeskGadget = Gadget & { x: number; y: number; z: number };
export type DeskVisitor = {
  id: string;
  speciesId: string;
  name: string;
  pettedToday: boolean;
};

const DESK_STYLES: Record<DeskTier["tier"], { plate: string; leg: string; extra?: string }> = {
  0: { plate: "#c9a06a", leg: "#a87f4f" },
  1: { plate: "#a87f4f", leg: "#7d5a33" },
  2: { plate: "#3d3d4f", leg: "#23232e" },
  3: { plate: "#23232e", leg: "#12121a", extra: "desk-rgb" },
};

export function DesktopScene(props: {
  gadgets: DeskGadget[];
  desk: DeskTier;
  wallpaperCss: string;
  floorCss: string;
  visitor: DeskVisitor | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(props.gadgets);
  const [dragging, setDragging] = useState<string | null>(null);
  // サーバーアクション後の再レンダーで新しい配置を反映する（React公式の
  // "adjusting state when props change" パターン）。ドラッグ中は手元を優先
  const propsKey = JSON.stringify(props.gadgets);
  const lastKey = useRef(propsKey);
  if (lastKey.current !== propsKey && !dragging) {
    lastKey.current = propsKey;
    if (items !== props.gadgets) setItems(props.gadgets);
  }
  const [overBox, setOverBox] = useState(false);
  const [visitorHeart, setVisitorHeart] = useState(false);
  const [, start] = useTransition();

  // ドラッグ中カテゴリの許可ゾーン（ガイド表示用）
  const dragCat: GadgetCategory | null =
    (dragging && items.find((g) => g.id === dragging)?.category) || null;

  function toPercent(e: React.PointerEvent): { x: number; y: number } {
    const r = sceneRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  }

  function inStowBox(e: React.PointerEvent): boolean {
    const b = boxRef.current?.getBoundingClientRect();
    return !!b && e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
  }

  function onDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // 合成イベントや既に解放されたポインタでは capture できないことがある。
      // その場合も要素上の move/up で追従できるので無視してよい
    }
    setDragging(id);
    const maxZ = Math.max(0, ...items.map((g) => g.z));
    setItems((cur) => cur.map((g) => (g.id === id ? { ...g, z: maxZ + 1 } : g)));
  }

  function onMove(e: React.PointerEvent, id: string) {
    if (dragging !== id) return;
    const p = toPercent(e);
    setOverBox(inStowBox(e));
    setItems((cur) =>
      cur.map((g) =>
        g.id === id ? { ...g, ...clampToZones(g.category, p.x, p.y) } : g
      )
    );
  }

  function onUp(e: React.PointerEvent, id: string) {
    if (dragging !== id) return;
    setDragging(null);
    setOverBox(false);
    if (inStowBox(e)) {
      setItems((cur) => cur.filter((g) => g.id !== id));
      start(async () => {
        try {
          await stowGadget(id);
        } catch {
          setItems(props.gadgets); // 失敗したらサーバー状態へ戻す
        }
      });
      return;
    }
    const item = items.find((g) => g.id === id);
    if (!item) return;
    start(async () => {
      try {
        await moveGadget(id, item.x, item.y);
      } catch {
        setItems(props.gadgets);
      }
    });
  }

  function onPetVisitor() {
    if (!props.visitor) return;
    setVisitorHeart(true);
    setTimeout(() => setVisitorHeart(false), 1600);
    start(async () => {
      try {
        await petPet(props.visitor!.id);
      } catch {
        // なでなで失敗で画面は壊さない
      }
    });
  }

  const sp = props.visitor ? speciesById(props.visitor.speciesId) : null;
  const deskStyle = DESK_STYLES[props.desk.tier];
  const deskInset = { 0: 22, 1: 14, 2: 12, 3: 8 }[props.desk.tier]; // 進化で広くなる

  return (
    <div
      ref={sceneRef}
      className="relative aspect-[16/9] w-full select-none overflow-hidden rounded-lg border-[2.5px] border-line8"
      style={{ touchAction: "none" }}
    >
      {/* 壁と床（きせかえ） */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ height: "62%", background: props.wallpaperCss }}
      />
      <div
        className="absolute inset-x-0 bottom-0 border-t-[2.5px] border-line8/40"
        style={{ height: "38%", background: props.floorCss }}
      />

      {/* デスク（決定的進化） */}
      <div
        className={`absolute rounded-sm border-2 border-line8 ${deskStyle.extra ?? ""}`}
        style={{
          left: `${deskInset}%`,
          right: `${deskInset}%`,
          top: "56%",
          height: "5%",
          background: deskStyle.plate,
        }}
        title={`${props.desk.name} — ${props.desk.hint}`}
      />
      {[deskInset + 3, 97 - deskInset - 3].map((x) => (
        <div
          key={x}
          className="absolute border-2 border-line8"
          style={{ left: `${x}%`, top: "61%", width: "2.5%", height: "13%", background: deskStyle.leg }}
        />
      ))}

      {/* ドラッグ中の設置可能ゾーンのガイド */}
      {dragCat &&
        allowedZones(dragCat).map((z) => (
          <div
            key={z}
            className="pointer-events-none absolute inset-x-1 rounded-md border-2 border-dashed border-pinkhot/70"
            style={{
              top: `${ZONES[z].y[0] - 3}%`,
              height: `${ZONES[z].y[1] - ZONES[z].y[0] + 6}%`,
            }}
          />
        ))}

      {/* ガジェット（自由配置・zIndexで前後関係） */}
      {items.map((g) => (
        <button
          key={g.id}
          onPointerDown={(e) => onDown(e, g.id)}
          onPointerMove={(e) => onMove(e, g.id)}
          onPointerUp={(e) => onUp(e, g.id)}
          title={`${g.name}（${RARITY_LABELS[g.rarity].label}） — ${g.flavor}｜ドラッグで移動・右下のBOXでしまう`}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-md p-0.5 ${
            dragging === g.id ? "cursor-grabbing bg-white/40 ring-2 ring-pinkhot" : ""
          }`}
          style={{ left: `${g.x}%`, top: `${g.y}%`, zIndex: 10 + g.z, touchAction: "none" }}
        >
          <Image
            src={`/dungeon/cat-${g.category}.png`}
            alt={g.name}
            width={38}
            height={38}
            draggable={false}
            style={{
              imageRendering: "pixelated",
              filter: `drop-shadow(0 2px 0 ${RARITY_LABELS[g.rarity].color})`,
            }}
            unoptimized
          />
        </button>
      ))}

      {/* きょうの来客: デスクのうえでくつろぐペット */}
      {props.visitor && sp && (
        <button
          onClick={onPetVisitor}
          title={`${props.visitor.name}がデスクのうえでくつろいでいる${props.visitor.pettedToday ? "（きょうはなでなで済み）" : "（クリックでなでる）"}`}
          className="absolute z-[220] -translate-x-1/2 -translate-y-full"
          style={{ left: "32%", top: "57.5%" }}
        >
          {visitorHeart && (
            <span className="pet-heart absolute -top-4 left-1/2 font-pixel text-[13px] text-pinkhot">
              ♥
            </span>
          )}
          <span className="alien-patapata inline-block" style={{ animationDuration: "1.6s" }}>
            <Image
              src={(visitorHeart && sp.sprites.happy) || sp.sprites.normal}
              alt={props.visitor.name}
              width={44}
              height={44}
              draggable={false}
              style={{ imageRendering: "pixelated" }}
              unoptimized
            />
          </span>
        </button>
      )}

      {/* 収納BOX（ここへドロップでしまう） */}
      <div
        ref={boxRef}
        className={`absolute bottom-1.5 right-1.5 z-[300] grid h-[52px] w-[68px] place-items-center rounded-md border-2 border-dashed ${
          overBox ? "border-pinkhot bg-pinkhot/20" : "border-line8/70 bg-white/40"
        }`}
      >
        <span className="font-pixel text-[9px] tracking-wide text-inksoft">
          📦 しまう
        </span>
      </div>

      {items.length === 0 && !props.visitor && (
        <p className="absolute inset-x-0 top-[40%] text-center text-[12.5px] text-inksoft">
          ダンジョンで見つけたガジェットをここに飾れます
        </p>
      )}
    </div>
  );
}
