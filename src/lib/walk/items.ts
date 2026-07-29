// おさんぽのカギアイテムマスタ。DBにはIDだけを置く（species.ts / foods.ts と同じ方針）。
//
// 【入手連鎖の設計】イベントに出会う→カギを拾う→新しい行き先が解放される、が散歩を
// 眺め続ける動機のループ。深海は「海中を解放した人だけ」、チェリック星は「レア分岐の
// 魔界に遭遇した人だけ」が拾える2段構え。

import type { BiomeId } from "./world";

export type WalkItemDef = {
  id: string;
  name: string;
  emoji: string;
  /** 所持していると解放される行き先ビオーム */
  unlocksBiome: BiomeId;
  /** 入手時にペットがつぶやくひとこと */
  getLine: string;
};

export const WALK_ITEMS: WalkItemDef[] = [
  {
    id: "rocket-key",
    name: "ロケットのかぎ",
    emoji: "🚀",
    unlocksBiome: "uchuu",
    getLine: "ロケットの かぎ…！ うちゅう、いけちゃうんじゃない？",
  },
  {
    id: "moguri-omamori",
    name: "もぐりのおまもり",
    emoji: "🫧",
    unlocksBiome: "kaichuu",
    getLine: "これが あれば、みずのなかでも いきが できるんだって。",
  },
  {
    id: "shinkai-suzu",
    name: "しんかいのすず",
    emoji: "🔔",
    unlocksBiome: "shinkai",
    getLine: "ふかい うみの おと が する すず…。もっと したへ いけそう。",
  },
  {
    id: "yukigutsu",
    name: "ゆきぐつ",
    emoji: "🥾",
    unlocksBiome: "yukiyama",
    getLine: "あったかい ゆきぐつ！ ゆきやまも へっちゃらだね。",
  },
  {
    id: "midori-chizu",
    name: "みどりのちず",
    emoji: "🗺️",
    unlocksBiome: "cherick",
    getLine: "みどりの そらの ほしの ちず…。いってみる しかないね。",
  },
];

export function walkItemById(id: string): WalkItemDef | undefined {
  return WALK_ITEMS.find((i) => i.id === id);
}
