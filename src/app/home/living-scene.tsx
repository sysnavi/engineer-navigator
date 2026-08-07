"use client";

// LIVING.sav — ペットが暮らすリビング（Issue #12 松 → おかいもの松で家具対応）。
// おかいもので買った家具をドラッグで自由配置（DESKTOP.savと同じ機構）。
// 家具はただの飾りではなくペットの「行き先」: 日替わり（決定的）で
// ラグやこたつで昼寝したり、キャットタワーのてっぺんに登ったりする。
// ペットをクリックすると おせわメニュー（なでなで / ごはん）が開く。
//
// ごはん（Issue #23）: 器にもりつけて差し出す→もぐもぐ→リアクション、の順で再生。
// 好物を当てた日は「いっしょに いただきます」（おじぎ付き）に自動で切り替わる。

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { petPet, feedPet, moveFurniture, stowFurniture, type FeedResult } from "./actions";
import { PET_SIZE } from "@/lib/home/scene";
import {
  clampFurniture,
  furnitureBottomY,
  LIVING_ZONES,
  SHELF_BOARD_Y,
  SHELF_SEGMENTS,
  petAnchorFor,
} from "@/lib/home/living";
import { shopItemById } from "@/lib/shop/content";
import { ShopSpriteFluid } from "@/components/shop-sprite";
import { speciesById } from "@/lib/pets/species";
import { CareMenu, type FoodStock } from "./care-menu";
import { PetSpeech } from "./pet-speech";
import { FoodServe } from "./food-serve";
import { TalkPanel } from "./talk-panel";
import { talkRemaining } from "./talk-actions";

export type RoomPet = {
  id: string;
  speciesId: string;
  name: string;
  affection: number;
  pettedToday: boolean;
  feedsLeft: number; // きょう あと何回ごはんをあげられるか（1日3回まで）
};

export type LivingFurniture = { itemId: string; x: number; y: number; z: number };

// 演出の尺（ms）。CSSアニメ側と揃えてある
const SERVE_IN = { dish: 560, hand: 700, together: 620 };
const BITE_MS = 300; // 一口の間隔（3口で完食）
const BOW_MS = 1000;

function affectionTier(a: number): string {
  if (a >= 15) return "かぞく";
  if (a >= 7) return "しんゆう";
  if (a >= 3) return "なかよし";
  return "であいたて";
}

/** もりつけ演出の進行状態 */
type Serving = {
  petId: string;
  foodId: string;
  mode: "dish" | "hand" | "together";
  eaten: number; // 0..1
  phase: "serve" | "itadakimasu" | "eating" | "react";
  bubble: string | null;
  joy: boolean;
};

/** ペットの居場所（毎レンダー導出）。topPct=足元のシーンy% */
type PetPose = {
  xPct: number;
  topPct: number;
  scale: number;
  z: number;
  mode: "wander" | "sleep" | "sit" | "top" | "watch" | "front";
  line: string | null; // 家具を使っている子のふるまい文
};

export function LivingScene(props: {
  pets: RoomPet[];
  furniture: LivingFurniture[];
  lodgers: Record<string, string>; // itemId -> petId（きょう家具を使っている子）
  window: { width: number; curtain: boolean };
  wallpaperCss: string;
  floorCss: string;
  awayName: string | null; // デスクへ遊びに行っている子（表示だけ）
  stocks: FoodStock[];
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pets, setPets] = useState(props.pets);
  const [furniture, setFurniture] = useState(props.furniture);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overBox, setOverBox] = useState(false);
  const [hearts, setHearts] = useState<string | null>(null);
  const [stocks, setStocks] = useState(props.stocks);
  const [menuPetId, setMenuPetId] = useState<string | null>(null);
  // 会話パネル（AI）。開くときに「きょうあと何回話せるか」を取りに行く
  const [chatPetId, setChatPetId] = useState<string | null>(null);
  const [chatLeft, setChatLeft] = useState(0);
  const [serving, setServing] = useState<Serving | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // サーバーアクション後の再レンダーで新入りペット・購入家具を反映（props→state同期）。
  // refはrender中に読めない(react-hooks/refs)ため前回キーもstateで持つ
  const propsKey = JSON.stringify([props.pets, props.stocks, props.furniture]);
  const [lastKey, setLastKey] = useState(propsKey);
  if (lastKey !== propsKey) {
    setLastKey(propsKey);
    if (pets !== props.pets) setPets(props.pets);
    if (stocks !== props.stocks) setStocks(props.stocks);
    if (furniture !== props.furniture && !dragging) setFurniture(props.furniture);
  }

  // ---------------------------------------------------------------------
  // 家具のドラッグ（DESKTOP.savと同じ Pointer Events 機構）
  // ---------------------------------------------------------------------

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

  function onFurnDown(e: React.PointerEvent, itemId: string) {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // 合成イベントや既に解放されたポインタでは capture できないことがある。
      // その場合も要素上の move/up で追従できるので無視してよい
    }
    setDragging(itemId);
    const maxZ = Math.max(0, ...furniture.map((f) => f.z));
    setFurniture((cur) => cur.map((f) => (f.itemId === itemId ? { ...f, z: maxZ + 1 } : f)));
  }

  function onFurnMove(e: React.PointerEvent, itemId: string) {
    if (dragging !== itemId) return;
    const def = shopItemById(itemId);
    if (!def) return;
    const p = toPercent(e);
    setOverBox(inStowBox(e));
    setFurniture((cur) =>
      cur.map((f) => (f.itemId === itemId ? { ...f, ...clampFurniture(def, p.x, p.y) } : f))
    );
  }

  function onFurnUp(e: React.PointerEvent, itemId: string) {
    if (dragging !== itemId) return;
    setDragging(null);
    setOverBox(false);
    if (inStowBox(e)) {
      setFurniture((cur) => cur.filter((f) => f.itemId !== itemId));
      startTransition(async () => {
        try {
          await stowFurniture(itemId);
        } catch {
          setFurniture(props.furniture); // 失敗したらサーバー状態へ戻す
        }
      });
      return;
    }
    const item = furniture.find((f) => f.itemId === itemId);
    if (!item) return;
    startTransition(async () => {
      try {
        await moveFurniture(itemId, item.x, item.y);
      } catch {
        setFurniture(props.furniture);
      }
    });
  }

  const dragZone = dragging ? shopItemById(dragging)?.zone : null;

  // ---------------------------------------------------------------------
  // おせわ（なでなで / ごはん / 会話）— 従来どおり
  // ---------------------------------------------------------------------

  // なでなで。メニューを閉じてペット本体にハート＋にっこりを出す。
  // 何回でも撫でられる（またペットをタップすればメニューが開く）。
  // なつき度が実際に上がった日だけ pettedToday を立てる。
  const onPet = (petId: string) => {
    setMenuPetId(null);
    setHearts(petId);
    setTimeout(() => setHearts((h) => (h === petId ? null : h)), 1600);
    startTransition(async () => {
      try {
        const r = await petPet(petId);
        setPets((ps) =>
          ps.map((p) =>
            p.id === petId
              ? { ...p, affection: r.affection, pettedToday: p.pettedToday || r.gained }
              : p
          )
        );
      } catch {
        // なでなで失敗で画面は壊さない
      }
    });
  };

  /** 話しかける: 好物のヒント台詞を吹き出しに出す（定型なのでトークンゼロ・DB不要） */
  const onTalk = (petId: string) => {
    setMenuPetId(null);
    const pet = pets.find((p) => p.id === petId);
    const sp = pet && speciesById(pet.speciesId);
    if (!sp) return;
    setServing({
      petId,
      foodId: "",
      mode: "dish",
      eaten: 1, // 器は出さない（ヒントの吹き出しだけ）
      phase: "react",
      bubble: sp.foodHint,
      joy: false,
    });
    setTimeout(() => setServing(null), 3600);
  };

  /** もりつけ→もぐもぐ→リアクション を順に再生する（サーバー結果を受けてから開始） */
  const playServe = (petId: string, foodId: string, r: FeedResult) => {
    const mode = r.serveMode;
    setServing({
      petId,
      foodId,
      mode,
      eaten: 0,
      phase: "serve",
      bubble: null,
      joy: false,
    });

    const step = (fn: () => void, ms: number) => setTimeout(fn, ms);
    const eat = (after: () => void) => {
      setServing((s) => (s ? { ...s, phase: "eating" } : s));
      [1, 2, 3].forEach((n) =>
        step(
          () => setServing((s) => (s ? { ...s, eaten: n / 3 } : s)),
          BITE_MS * n
        )
      );
      step(after, BITE_MS * 3 + 120);
    };
    const react = () => {
      const joyful = r.reaction !== "normal";
      setServing((s) =>
        s
          ? {
              ...s,
              phase: "react",
              joy: joyful,
              bubble:
                r.reaction === "favorite"
                  ? "…！ だいすきなやつだ！！"
                  : r.reaction === "semi"
                    ? "かがやいてる…！ ごちそうだ！"
                    : "もぐもぐ…。ごちそうさま！",
            }
          : s
      );
      if (joyful) setHearts(petId);
      step(() => {
        setServing(null);
        setHearts((h) => (h === petId ? null : h));
      }, 1600);
    };

    if (mode === "together") {
      // いっしょに いただきます → もぐもぐ → ごちそうさまでした
      step(() => {
        setServing((s) =>
          s ? { ...s, phase: "itadakimasu", bubble: "いただきます！" } : s
        );
        step(() => eat(react), BOW_MS);
      }, SERVE_IN.together);
    } else {
      step(() => eat(react), SERVE_IN[mode]);
    }
  };

  const onFeed = (petId: string, foodId: string) => {
    setMenuPetId(null);
    startTransition(async () => {
      try {
        const r = await feedPet(petId, foodId);
        setPets((ps) =>
          ps.map((p) =>
            p.id === petId
              ? { ...p, affection: r.affection, feedsLeft: r.feedsLeft }
              : p
          )
        );
        setStocks((ss) =>
          ss.map((s) => (s.foodId === foodId ? { ...s, count: r.remaining } : s))
        );
        setLog(
          r.discovered
            ? `${r.message} 好物を見つけた！（ごはん図鑑に記録した）`
            : `${r.message} なつき度 +${r.gain}`
        );
        playServe(petId, foodId, r);
      } catch (e) {
        setLog(e instanceof Error ? e.message : "ごはんをあげられませんでした");
      }
    });
  };

  /** 会話パネルを開く（残り回数を取ってから） */
  const onChat = (petId: string) => {
    setMenuPetId(null);
    startTransition(async () => {
      try {
        setChatLeft(await talkRemaining());
      } catch {
        setChatLeft(0);
      }
      setChatPetId(petId);
    });
  };

  const menuPet = pets.find((p) => p.id === menuPetId) ?? null;
  const chatPet = pets.find((p) => p.id === chatPetId) ?? null;
  const chatSpecies = chatPet ? speciesById(chatPet.speciesId) : null;

  // ---------------------------------------------------------------------
  // 居場所の導出: 家具を使う子はアンカーへスナップ、ほかは床をそぞろ歩き
  // ---------------------------------------------------------------------

  // 3/4見下ろし: 散歩座標は匹ごとに決定的（y=奥行きで前後関係）
  const spot = (i: number) => ({
    x: 16 + ((i * 37) % 62),
    y: 42 + ((i * 23) % 46),
  });
  // 前後関係は「足元・接地線のシーンy%」で家具とペットを同じ土俵に載せる
  const depthZ = (bottomY: number) => 10 + Math.round(bottomY * 10);
  const FLAT_Z = 300; // ラグ・ざぶとん（床に敷くもの）は常にペットより奥

  const furnZ = (f: LivingFurniture): number => {
    const def = shopItemById(f.itemId);
    if (!def) return FLAT_Z;
    if (def.flat) return FLAT_Z;
    return depthZ(furnitureBottomY(def, f.y));
  };

  // itemId -> petId の割当をペット視点に引き直す
  const poseOf = (p: RoomPet, i: number): PetPose => {
    for (const [itemId, petId] of Object.entries(props.lodgers)) {
      if (petId !== p.id) continue;
      const f = furniture.find((x) => x.itemId === itemId);
      const def = shopItemById(itemId);
      if (!f || !def?.petSpot) break;
      const a = petAnchorFor(def.petSpot.kind, def, f.x, f.y);
      return {
        xPct: a.x,
        topPct: a.y,
        scale: a.scale,
        z: a.behind ? furnZ(f) - 1 : furnZ(f) + 1,
        mode: def.petSpot.kind,
        line: def.petSpot.line,
      };
    }
    const pos = spot(i);
    const topPct = 34 + pos.y * 0.66;
    return { xPct: pos.x, topPct, scale: 1, z: depthZ(topPct), mode: "wander", line: null };
  };
  const poses = new Map(pets.map((p, i) => [p.id, poseOf(p, i)]));

  return (
    // isolate: ペットのz-index(奥行き〜900)がヘッダー(z-10)を突き抜けて
    // スクロール中にナビの上へ描画されるのを防ぐ（スタッキングを部屋内に閉じる）
    <div
      ref={sceneRef}
      className="isolate relative aspect-[16/8] w-full select-none overflow-hidden rounded-lg border-[2.5px] border-line8 sm:aspect-[16/6]"
      style={{ touchAction: "none" }}
    >
      {/* 上部の壁（まどは へやの進化で立派になる） */}
      <div
        className="absolute inset-x-0 top-0 border-b-[3px] border-line8"
        style={{ height: "34%", background: props.wallpaperCss }}
      >
        <div
          className="absolute left-1/2 top-[12%] grid h-[74%] -translate-x-1/2 grid-cols-2 overflow-hidden rounded-md border-[2.5px] border-line8 bg-sky8/60"
          style={{ width: `${props.window.width}%`, minWidth: 96 }}
        >
          <i className="border-b-2 border-r-2 border-line8/60" />
          <i className="border-b-2 border-line8/60" />
          <i className="border-r-2 border-line8/60" />
          <i />
        </div>
        {/* カーテン（tier2で付く。まどの左右にひらり） */}
        {props.window.curtain && (
          <>
            {[-1, 1].map((side) => (
              <div
                key={side}
                className="absolute top-[6%] h-[86%] rounded-sm border-2 border-line8"
                style={{
                  left: `calc(50% + ${side} * (${props.window.width / 2}% + 8px) - ${side === 1 ? 0 : 12}px)`,
                  width: 12,
                  background:
                    "repeating-linear-gradient(90deg, var(--crit, #e5484d) 0 4px, #f2848b 4px 8px)",
                }}
              />
            ))}
          </>
        )}
      </div>
      {/* 大きな床 + 幅木の影 */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: "66%", background: props.floorCss }}
      />
      <div
        className="absolute inset-x-0"
        style={{ top: "34%", height: "3%", background: "rgba(0,0,0,0.14)" }}
      />
      {/* かざり棚の板（まどの左右）。shelfゾーンの家具はこのうえに乗る */}
      {SHELF_SEGMENTS.map(([lo, hi]) => (
        <div
          key={lo}
          className="absolute border-2 border-line8"
          style={{
            left: `${lo - 2}%`,
            width: `${hi - lo + 4}%`,
            top: `${SHELF_BOARD_Y}%`,
            height: "3.2%",
            background: "#b08050",
            zIndex: 2,
          }}
        />
      ))}

      {/* ドラッグ中の設置可能ゾーンのガイド */}
      {dragZone &&
        (dragZone === "shelf" ? SHELF_SEGMENTS : [[3, 97] as [number, number]]).map(
          ([lo, hi]) => (
            <div
              key={`${lo}-${hi}`}
              className="pointer-events-none absolute z-[1100] rounded-md border-2 border-dashed border-pinkhot/70"
              style={{
                left: `${lo - 1}%`,
                width: `${hi - lo + 2}%`,
                top: `${LIVING_ZONES[dragZone].y[0] - 3}%`,
                height: `${LIVING_ZONES[dragZone].y[1] - LIVING_ZONES[dragZone].y[0] + 6}%`,
              }}
            />
          )
        )}

      {/* 家具（おかいもの・自由配置）。接地線ソートでペットと前後関係を共有 */}
      {furniture.map((f) => {
        const def = shopItemById(f.itemId);
        if (!def) return null;
        const usedBy = pets.find((p) => p.id === props.lodgers[f.itemId]);
        return (
          <button
            key={f.itemId}
            onPointerDown={(e) => onFurnDown(e, f.itemId)}
            onPointerMove={(e) => onFurnMove(e, f.itemId)}
            onPointerUp={(e) => onFurnUp(e, f.itemId)}
            title={`${def.name} — ${def.desc}${usedBy ? `｜${usedBy.name}のお気に入り` : ""}｜ドラッグで移動・右下のBOXでしまう`}
            className={`absolute cursor-grab rounded-md p-0.5 ${
              dragging === f.itemId ? "cursor-grabbing bg-white/40 ring-2 ring-pinkhot" : ""
            }`}
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              width: `${def.size}%`,
              transform: "translate(-50%, -50%)",
              zIndex: furnZ(f),
              touchAction: "none",
            }}
          >
            <ShopSpriteFluid id={f.itemId} label={def.name} />
          </button>
        );
      })}

      {/* ペットを1匹も飼っていないときだけ、部屋の中央に案内を出す。
          飼っている子が全員おでかけ中のときは「空のリビング」を見せて、右下の小ラベルに任せる */}
      {pets.length === 0 && !props.awayName && (
        <p className="absolute inset-x-0 top-[55%] px-4 text-center text-[12.5px] text-inksoft">
          まだ誰も住んでいません。ときどき画面のすみに遊びに来る子に話しかけてみよう。
        </p>
      )}
      {pets.map((p, i) => {
        const sp = speciesById(p.speciesId);
        if (!sp) return null;
        const pose = poses.get(p.id)!;
        const happy = sp.sprites.happy ?? sp.sprites.normal;
        const serve = serving?.petId === p.id ? serving : null;
        const showHappy = hearts === p.id || serve?.joy === true;
        const sleeping = pose.mode === "sleep" && !serve && !showHappy;
        // ごはん中は くつろぎポーズをやめて、もぐもぐ/おじぎ/大よろこび に差し替える
        const bodyAnim = serve
          ? serve.joy
            ? "pet-joy"
            : serve.phase === "eating"
              ? "pet-munch"
              : serve.phase === "itadakimasu"
                ? "pet-bow"
                : ""
          : showHappy
            ? ""
            : sleeping || pose.mode === "sit" || pose.mode === "watch"
              ? "pet-snooze"
              : pose.mode === "wander"
                ? "alien-patapata"
                : pose.mode === "front"
                  ? "alien-patapata"
                  : ""; // top: てっぺんでは静かにおすまし
        const sprite = sleeping
          ? (sp.sprites.sleep ?? sp.sprites.normal)
          : showHappy
            ? happy
            : sp.sprites.normal;
        const title =
          pose.line && !serve
            ? `${p.name}は ${pose.line}（クリックで おせわメニュー）`
            : `${p.name}（なつき度 ${p.affection}・${affectionTier(p.affection)}）クリックで おせわメニュー`;
        return (
          <button
            key={p.id}
            onClick={() => setMenuPetId(p.id)}
            title={title}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `${pose.xPct}%`,
              top: `${pose.topPct}%`,
              // %指定だけだと狭い端末で30px程度まで縮み、名前が縦に折り返して
              // 背の高い名札になり、スプライト本体が部屋の外へ押し出される。
              // 48pxを下限にしてスプライトの視認性とタップ領域を守る
              width: `max(${PET_SIZE * pose.scale}%, ${Math.round(48 * pose.scale)}px)`,
              zIndex: pose.z,
            }}
          >
            <span
              className={`relative flex w-full flex-col items-center ${
                pose.mode === "wander" && !serve ? "pet-wander" : ""
              }`}
              style={
                pose.mode === "wander" && !serve
                  ? {
                      animationDuration: `${5 + (i % 4) * 1.4}s`,
                      animationDelay: `${(i % 5) * -1.3}s`,
                    }
                  : undefined
              }
            >
              {hearts === p.id && (
                <span className="pet-heart absolute -top-4 font-pixel text-[13px] text-pinkhot">
                  ♥
                </span>
              )}
              {sleeping && (
                <span className="pet-zzz absolute -top-3 right-1 font-pixel text-[11px] text-royal2">
                  💤
                </span>
              )}
              <span
                className={`w-full ${bodyAnim}`}
                style={{ animationDuration: serve ? "0.9s" : undefined }}
              >
                <Image
                  src={sprite}
                  alt={p.name}
                  width={96}
                  height={96}
                  style={{ width: "100%", height: "auto", imageRendering: "pixelated" }}
                  unoptimized
                />
              </span>
              {/* nowrap必須: 折り返すと1文字ずつ縦に積まれて名札が塔になる */}
              <span className="whitespace-nowrap rounded border-2 border-line8 bg-win px-1 font-pixel text-[9px] tracking-wide">
                {p.name}
              </span>
            </span>
          </button>
        );
      })}
      {/* セリフ窓（シーン幅に収まる折り返し窓。頭上の吹き出しだと切れる） */}
      {serving?.bubble && (
        <PetSpeech
          name={pets.find((p) => p.id === serving.petId)?.name ?? ""}
          text={serving.bubble}
        />
      )}

      {/* もりつけたごはん（ペットの足元にそっと置かれる）。
          「話しかける」だけのときは foodId が空なので器を出さない */}
      {serving?.foodId &&
        (() => {
          const pose = poses.get(serving.petId);
          if (!pose) return null;
          return (
            <FoodServe
              foodId={serving.foodId}
              mode={serving.mode}
              eaten={serving.eaten}
              left={`calc(${pose.xPct}% + 26px)`}
              bottom={`${100 - pose.topPct}%`}
            />
          );
        })()}

      {log && (
        <p className="absolute inset-x-2 bottom-1 z-[1250] rounded border-2 border-line8 bg-win/95 px-2 py-0.5 text-[10.5px] font-bold leading-snug">
          {log}
        </p>
      )}

      {/* 下段ラベル（左: おかいもの誘導 / 右: おでかけ表示）。
          スマホ幅では1行に並びきらないので、flex-wrapで2行に逃がす */}
      {!log && (props.awayName || furniture.length === 0) && (
        <div className="absolute inset-x-2 bottom-1 z-[1200] flex flex-wrap items-center justify-between gap-x-2">
          {furniture.length === 0 && (
            <Link
              href="/shop"
              className="whitespace-nowrap font-pixel text-[9.5px] tracking-wide text-royal2 underline"
            >
              🛒 おかいもので家具をそろえよう
            </Link>
          )}
          {props.awayName && (
            <p className="ml-auto mr-[76px] whitespace-nowrap font-pixel text-[9.5px] tracking-wide text-inksoft">
              {props.awayName}はデスクへおでかけ中
            </p>
          )}
        </div>
      )}

      {/* 収納BOX（家具をここへドロップでしまう） */}
      <div
        ref={boxRef}
        className={`absolute bottom-1.5 right-1.5 z-[1200] grid h-[46px] w-[64px] place-items-center rounded-md border-2 border-dashed ${
          overBox ? "border-pinkhot bg-pinkhot/20" : "border-line8/70 bg-white/40"
        }`}
      >
        <span className="font-pixel text-[9px] tracking-wide text-inksoft">
          📦 しまう
        </span>
      </div>

      {menuPet && (
        <CareMenu
          petName={menuPet.name}
          affection={menuPet.affection}
          pettedToday={menuPet.pettedToday}
          feedsLeft={menuPet.feedsLeft}
          stocks={stocks}
          busy={serving !== null}
          onPet={() => onPet(menuPet.id)}
          onTalk={() => onTalk(menuPet.id)}
          onChat={() => onChat(menuPet.id)}
          onFeed={(foodId) => onFeed(menuPet.id, foodId)}
          onClose={() => setMenuPetId(null)}
        />
      )}

      {chatPet && chatSpecies && (
        <TalkPanel
          petId={chatPet.id}
          petName={chatPet.name}
          speciesId={chatPet.speciesId}
          spriteNormal={chatSpecies.sprites.normal}
          spriteHappy={chatSpecies.sprites.happy ?? chatSpecies.sprites.normal}
          initialRemaining={chatLeft}
          onClose={() => setChatPetId(null)}
        />
      )}
    </div>
  );
}
