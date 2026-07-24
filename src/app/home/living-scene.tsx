"use client";

// LIVING.sav — ペットが暮らすリビング（Issue #12 松）。
// 旧 room.tsx から分離してペット専用に。ラグとまど（CSS描き）のうえで
// ゆらゆら歩き。ペットをクリックすると おせわメニュー（なでなで / ごはん）が開く。
// デスクに遊びに行っている子はここには居ない。
//
// ごはん（Issue #23）: 器にもりつけて差し出す→もぐもぐ→リアクション、の順で再生。
// 好物を当てた日は「いっしょに いただきます」（おじぎ付き）に自動で切り替わる。

import { useState, useTransition } from "react";
import Image from "next/image";
import { petPet, feedPet, type FeedResult } from "./actions";
import { PET_SIZE } from "@/lib/home/scene";
import { speciesById } from "@/lib/pets/species";
import { CareMenu, type FoodStock } from "./care-menu";
import { PetSpeech } from "./pet-speech";
import { FoodServe } from "./food-serve";

export type RoomPet = {
  id: string;
  speciesId: string;
  name: string;
  affection: number;
  pettedToday: boolean;
  feedsLeft: number; // きょう あと何回ごはんをあげられるか（1日3回まで）
};

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

export function LivingScene(props: {
  pets: RoomPet[];
  wallpaperCss: string;
  floorCss: string;
  awayName: string | null; // デスクへ遊びに行っている子（表示だけ）
  stocks: FoodStock[];
}) {
  const [pets, setPets] = useState(props.pets);
  const [hearts, setHearts] = useState<string | null>(null);
  const [stocks, setStocks] = useState(props.stocks);
  const [menuPetId, setMenuPetId] = useState<string | null>(null);
  const [serving, setServing] = useState<Serving | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // サーバーアクション後の再レンダーで新入りペット等を反映（props→state同期）。
  // refはrender中に読めない(react-hooks/refs)ため前回キーもstateで持つ
  const propsKey = JSON.stringify([props.pets, props.stocks]);
  const [lastKey, setLastKey] = useState(propsKey);
  if (lastKey !== propsKey) {
    setLastKey(propsKey);
    if (pets !== props.pets) setPets(props.pets);
    if (stocks !== props.stocks) setStocks(props.stocks);
  }

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

  const menuPet = pets.find((p) => p.id === menuPetId) ?? null;

  // 3/4見下ろし: ペットは床に散らばって暮らす（座標は匹ごとに決定的・y=奥行きで前後関係）
  const spot = (i: number) => ({
    x: 16 + ((i * 37) % 62),
    y: 42 + ((i * 23) % 46),
  });

  return (
    // isolate: ペットのz-index(奥行き〜900)がヘッダー(z-10)を突き抜けて
    // スクロール中にナビの上へ描画されるのを防ぐ（スタッキングを部屋内に閉じる）
    <div className="isolate relative aspect-[16/8] w-full select-none overflow-hidden rounded-lg border-[2.5px] border-line8 sm:aspect-[16/6]">
      {/* 上部の壁（キャラ2匹ぶんの大きなまど） */}
      <div
        className="absolute inset-x-0 top-0 border-b-[3px] border-line8"
        style={{ height: "34%", background: props.wallpaperCss }}
      >
        <div className="absolute left-1/2 top-[12%] grid h-[74%] w-[19%] min-w-[96px] -translate-x-1/2 grid-cols-2 overflow-hidden rounded-md border-[2.5px] border-line8 bg-sky8/60">
          <i className="border-b-2 border-r-2 border-line8/60" />
          <i className="border-b-2 border-line8/60" />
          <i className="border-r-2 border-line8/60" />
          <i />
        </div>
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
      {/* ラグ（キャラ2匹が乗れる広さ・キャラと同じ極太アウトライン） */}
      <div
        className="pointer-events-none absolute left-1/2 top-[70%] h-[30%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border-[2.5px] border-line8"
        style={{
          background:
            "radial-gradient(circle at 3px 3px, rgba(255,255,255,0.5) 1.5px, transparent 1.5px) 0 0 / 10px 10px, rgba(255,255,255,0.45)",
        }}
      />

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
        const happy = sp.sprites.happy ?? sp.sprites.normal;
        const serve = serving?.petId === p.id ? serving : null;
        const showHappy = hearts === p.id || serve?.joy === true;
        const pos = spot(i);
        // ごはん中は そぞろ歩きを止めて、もぐもぐ/おじぎ/大よろこび に差し替える
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
            : "alien-patapata";
        return (
          <button
            key={p.id}
            onClick={() => setMenuPetId(p.id)}
            title={`${p.name}（なつき度 ${p.affection}・${affectionTier(p.affection)}）クリックで おせわメニュー`}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `${pos.x}%`,
              top: `${34 + pos.y * 0.66}%`,
              // %指定だけだと狭い端末で30px程度まで縮み、名前が縦に折り返して
              // 背の高い名札になり、スプライト本体が部屋の外へ押し出される。
              // 48pxを下限にしてスプライトの視認性とタップ領域を守る
              width: `max(${PET_SIZE}%, 48px)`,
              zIndex: 10 + Math.round(pos.y * 10),
            }}
          >
            <span
              className={`relative flex w-full flex-col items-center ${serve ? "" : "pet-wander"}`}
              style={
                serve
                  ? undefined
                  : {
                      animationDuration: `${5 + (i % 4) * 1.4}s`,
                      animationDelay: `${(i % 5) * -1.3}s`,
                    }
              }
            >
              {hearts === p.id && (
                <span className="pet-heart absolute -top-4 font-pixel text-[13px] text-pinkhot">
                  ♥
                </span>
              )}
              <span className={`w-full ${bodyAnim}`} style={{ animationDuration: "0.9s" }}>
                <Image
                  src={showHappy ? happy : sp.sprites.normal}
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
          const i = pets.findIndex((p) => p.id === serving.petId);
          if (i < 0) return null;
          const pos = spot(i);
          return (
            <FoodServe
              foodId={serving.foodId}
              mode={serving.mode}
              eaten={serving.eaten}
              left={`calc(${pos.x}% + 26px)`}
              bottom={`${100 - (34 + pos.y * 0.66)}%`}
            />
          );
        })()}

      {log && (
        <p className="absolute inset-x-2 bottom-1 z-[1250] rounded border-2 border-line8 bg-win/95 px-2 py-0.5 text-[10.5px] font-bold leading-snug">
          {log}
        </p>
      )}

      {props.awayName && !log && (
        <p className="absolute bottom-1 right-2 z-[1200] font-pixel text-[9.5px] tracking-wide text-inksoft">
          {props.awayName}はデスクへおでかけ中
        </p>
      )}

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
          onFeed={(foodId) => onFeed(menuPet.id, foodId)}
          onClose={() => setMenuPetId(null)}
        />
      )}
    </div>
  );
}
