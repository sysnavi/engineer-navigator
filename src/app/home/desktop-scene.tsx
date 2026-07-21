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
  DESK_GEOM,
  GADGET_SIZE,
  PET_SIZE,
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
  // "adjusting state when props change" パターン）。ドラッグ中は手元を優先。
  // refはrender中に読めない(react-hooks/refs)ため前回キーもstateで持つ
  const propsKey = JSON.stringify(props.gadgets);
  const [lastKey, setLastKey] = useState(propsKey);
  if (lastKey !== propsKey && !dragging) {
    setLastKey(propsKey);
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
  // 進化で天板が広がる（台形の前後の辺を同時に広げる）
  const deskGrow = { 0: -6, 1: -3, 2: 0, 3: 3 }[props.desk.tier];
  const topW = DESK_GEOM.topWidth + deskGrow;
  const botW = DESK_GEOM.bottomWidth + deskGrow;
  // 台形コンテナ（clip-pathの%はこのコンテナ基準）。通常の遠近法:
  // 手前の辺（コンテナ幅=botW）が広く、奥の辺は左右を絞って狭くする
  const boxLeft = DESK_GEOM.centerX - botW / 2;
  const inset = ((botW - topW) / 2 / botW) * 100; // 奥の辺の左右の絞り（コンテナ%）
  const trapezoid = `polygon(${inset}% 0%, ${100 - inset}% 0%, 100% 100%, 0% 100%)`;
  const frontLeft = boxLeft;
  // 見下ろしビューの前後関係: y（奥行き）が大きいほど手前に描く
  const depthZ = (y: number) => 10 + Math.round(y * 10);
  const depthScale = (y: number) => 0.88 + (y / 100) * 0.24;

  return (
    <div
      ref={sceneRef}
      className="isolate relative aspect-[16/9] w-full select-none overflow-hidden rounded-lg border-[2.5px] border-line8"
      style={{ touchAction: "none" }}
    >
      {/* 見下ろしビュー: 上部の壁 + 大きな床（きせかえ） */}
      <div
        className="absolute inset-x-0 top-0 border-b-[3px] border-line8"
        style={{ height: "32%", background: props.wallpaperCss }}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: "68%", background: props.floorCss }}
      />
      {/* 幅木（壁と床の境目の影） */}
      <div
        className="absolute inset-x-0"
        style={{ top: "32%", height: "2.5%", background: "rgba(0,0,0,0.14)" }}
      />

      {/* デスクの接地影 */}
      <div
        className="absolute rounded-[50%]"
        style={{
          left: `${frontLeft - 3}%`,
          width: `${botW + 6}%`,
          top: `${DESK_GEOM.legBottom - 3}%`,
          height: "5%",
          background: "rgba(0,0,0,0.13)",
          zIndex: 3,
        }}
      />
      {/* デスク（正面見下ろしパース: 台形天板・奥の辺が狭い通常の遠近法。決定的進化）
          clip-pathはborderを切ってしまうため、輪郭レイヤー+木目レイヤーの2枚重ね */}
      {/* 奥脚2本（短い=奥行き。狭い奥角の内側から、前脚のあいだに見える） */}
      {[DESK_GEOM.centerX - topW / 2 + 0.4, DESK_GEOM.centerX + topW / 2 - 2.8].map((x) => (
        <div
          key={`rear-${x}`}
          className="absolute border-2 border-line8"
          style={{
            left: `${x}%`,
            top: `${DESK_GEOM.plateBottom - 2}%`,
            width: "2.4%",
            height: `${DESK_GEOM.rearLegBottom - DESK_GEOM.plateBottom + 2}%`,
            background: deskStyle.leg,
            zIndex: 4,
          }}
        />
      ))}
      <div
        className={`absolute ${deskStyle.extra ?? ""}`}
        style={{
          left: `${boxLeft}%`,
          width: `${botW}%`,
          top: `${DESK_GEOM.plateTop - 1.5}%`,
          height: `${DESK_GEOM.plateBottom - DESK_GEOM.plateTop + 1.5}%`,
          zIndex: 5,
        }}
        title={`${props.desk.name} — ${props.desk.hint}`}
      >
        <div
          className="absolute inset-0"
          style={{ clipPath: trapezoid, background: "var(--line)" }}
        />
        <div
          className="absolute"
          style={{
            inset: "3px 5px 0 5px",
            clipPath: trapezoid,
            background: deskStyle.plate,
          }}
        />
      </div>
      {/* 天板の前縁（厚み）: 台形の手前の辺の幅にそろえる */}
      <div
        className="absolute border-x-[2.5px] border-b-[2.5px] border-line8"
        style={{
          left: `${frontLeft}%`,
          width: `${botW}%`,
          top: `${DESK_GEOM.plateBottom}%`,
          height: `${DESK_GEOM.edgeBottom - DESK_GEOM.plateBottom}%`,
          background: deskStyle.leg,
          zIndex: 5,
        }}
      />
      {/* 前脚2本（長い=手前。前縁の内側の角から） */}
      {[frontLeft + 1.5, DESK_GEOM.centerX + botW / 2 - 4].map((x) => (
        <div
          key={`front-${x}`}
          className="absolute border-2 border-line8"
          style={{
            left: `${x}%`,
            top: `${DESK_GEOM.edgeBottom}%`,
            width: "2.6%",
            height: `${DESK_GEOM.legBottom - DESK_GEOM.edgeBottom}%`,
            background: deskStyle.leg,
            zIndex: 5,
          }}
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

      {/* ガジェット（自由配置・yソートで前後関係、奥行きで少し縮む）
          サイズはカテゴリ別のシーン幅%（モニタは大きくマウスは小さく = 縮尺の核） */}
      {items.map((g) => (
        <button
          key={g.id}
          onPointerDown={(e) => onDown(e, g.id)}
          onPointerMove={(e) => onMove(e, g.id)}
          onPointerUp={(e) => onUp(e, g.id)}
          title={`${g.name}（${RARITY_LABELS[g.rarity].label}） — ${g.flavor}｜ドラッグで移動・右下のBOXでしまう`}
          className={`absolute cursor-grab rounded-md p-0.5 ${
            dragging === g.id ? "cursor-grabbing bg-white/40 ring-2 ring-pinkhot" : ""
          }`}
          style={{
            left: `${g.x}%`,
            top: `${g.y}%`,
            width: `${GADGET_SIZE[g.category]}%`,
            transform: `translate(-50%, -50%) scale(${depthScale(g.y)})`,
            zIndex: depthZ(g.y),
            touchAction: "none",
          }}
        >
          <Image
            src={`/dungeon/cat-${g.category}.png`}
            alt={g.name}
            width={96}
            height={96}
            draggable={false}
            style={{
              width: "100%",
              height: "auto",
              imageRendering: "pixelated",
              filter: `drop-shadow(0 2px 0 ${RARITY_LABELS[g.rarity].color})`,
            }}
            unoptimized
          />
        </button>
      ))}

      {/* きょうの来客: デスクのよこ（床）で遊ぶペット */}
      {props.visitor && sp && (
        <button
          onClick={onPetVisitor}
          title={`${props.visitor.name}がデスクのよこで遊んでいる${props.visitor.pettedToday ? "（きょうはなでなで済み）" : "（クリックでなでる）"}`}
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: "22%", top: "84%", width: `${PET_SIZE}%`, zIndex: depthZ(84) }}
        >
          <span className="pet-wander inline-block w-full" style={{ animationDuration: "6.5s" }}>
            {visitorHeart && (
              <span className="pet-heart absolute -top-4 left-1/2 font-pixel text-[13px] text-pinkhot">
                ♥
              </span>
            )}
            <span className="alien-patapata inline-block w-full" style={{ animationDuration: "1.6s" }}>
              <Image
                src={(visitorHeart && sp.sprites.happy) || sp.sprites.normal}
                alt={props.visitor.name}
                width={96}
                height={96}
                draggable={false}
                style={{ width: "100%", height: "auto", imageRendering: "pixelated" }}
                unoptimized
              />
            </span>
          </span>
        </button>
      )}

      {/* 収納BOX（ここへドロップでしまう） */}
      <div
        ref={boxRef}
        className={`absolute bottom-1.5 right-1.5 z-[1200] grid h-[52px] w-[68px] place-items-center rounded-md border-2 border-dashed ${
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
