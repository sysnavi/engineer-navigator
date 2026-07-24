"use client";

// おせわメニュー（Issue #23）。リビングのペットをクリックすると開く。
// なでなで（従来）と ごはん（新規）をひとつの入口にまとめている。
//
// 【なげない原則】ごはんは投げ与えず、もりつけて差し出す。演出は3種:
//   dish     = お皿をそっと置く（基本）
//   hand     = てのひらから差し出す（なつき度8以上で解放）
//   together = いっしょに いただきます（好物を当てた日に自動）

import { FoodSprite } from "@/components/pets/food-sprite";
import { FOODS, HAND_SERVE_MIN_AFFECTION } from "@/lib/pets/foods";

export type FoodStock = { foodId: string; count: number };

export function CareMenu(props: {
  petName: string;
  affection: number;
  pettedToday: boolean;
  fedToday: boolean;
  stocks: FoodStock[];
  busy: boolean;
  onPet: () => void;
  onTalk: () => void;
  onFeed: (foodId: string) => void;
  onClose: () => void;
}) {
  const owned = FOODS.map((f) => ({
    def: f,
    count: props.stocks.find((s) => s.foodId === f.id)?.count ?? 0,
  })).filter((x) => x.count > 0);

  return (
    <div
      className="absolute inset-0 z-[1300] flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`${props.petName}のおせわ`}
    >
      <div className="absolute inset-0 bg-ink/35" onClick={props.onClose} />
      <div className="relative w-full max-w-[320px] overflow-hidden rounded-xl border-[3px] border-line8 bg-win shadow-hard">
        <div className="flex items-center gap-2 bg-royal px-2.5 py-1.5 font-pixel text-[11px] tracking-wide text-white">
          おせわ<span className="text-peri">.exe</span>
          <button
            onClick={props.onClose}
            className="ml-auto rounded border-2 border-white px-1.5 text-[10px] leading-tight"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 p-3">
          <p className="text-[12.5px] font-extrabold">
            {props.petName}
            <span className="ml-1.5 font-normal text-inksoft">
              なつき度 {props.affection}
            </span>
          </p>

          <div className="flex gap-2">
            <button
              onClick={props.onPet}
              disabled={props.pettedToday || props.busy}
              className="btn8 flex-1 py-2 text-[12.5px] disabled:opacity-45"
            >
              {props.pettedToday ? "なでなで済み" : "なでなでする"}
            </button>
            {/* 好物のヒントをくれる（定型台詞なのでトークンゼロ） */}
            <button
              onClick={props.onTalk}
              disabled={props.busy}
              className="btn8 flex-1 py-2 text-[12.5px] disabled:opacity-45"
            >
              話しかける
            </button>
          </div>

          <div>
            <p className="mb-1.5 font-pixel text-[10px] tracking-[0.08em] text-royal2">
              GOHAN — {props.fedToday ? "きょうは あげ済み" : "えらんで もりつける"}
            </p>
            {owned.length === 0 ? (
              <p className="text-[11.5px] text-inksoft">
                ごはんが ありません。毎日ログインで1個もらえます（ダンジョンでも拾えます）
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {owned.map(({ def, count }) => (
                  <button
                    key={def.id}
                    onClick={() => props.onFeed(def.id)}
                    disabled={props.fedToday || props.busy}
                    title={`${def.name}（のこり${count}）`}
                    aria-label={`${def.name}をもりつける。のこり${count}`}
                    className="relative flex w-[68px] flex-col items-center gap-1 rounded-lg border-2 border-line8 bg-surface px-1 py-2 shadow-hard-sm transition-transform hover:bg-quotebg active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-45"
                  >
                    <FoodSprite id={def.id} px={3} />
                    <span className="text-center text-[9.5px] font-bold leading-tight">
                      {def.name}
                    </span>
                    <span className="absolute -right-2 -top-2 rounded border-2 border-line8 bg-royal px-1 font-pixel text-[9.5px] text-white">
                      x{count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10.5px] leading-relaxed text-inksoft">
            種族ごとに好物がひとつ。当てると なつき度が2倍のびます。話しかけると
            ヒントをくれることがあります。
            {props.affection < HAND_SERVE_MIN_AFFECTION && (
              <>
                <br />
                なつき度{HAND_SERVE_MIN_AFFECTION}で「てのひらから」あげられるようになります。
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
