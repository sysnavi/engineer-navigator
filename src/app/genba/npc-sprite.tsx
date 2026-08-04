// げんばNPCのドット絵（pixel-avatar.tsx と同方式・画像ファイル不要・SSR可）。
// 世界観はペットと同じ「鳥と小動物」。設計書のラフを12x12で清書したもの。

import type { NpcId } from "@/lib/genba/content";

const COLORS: Record<string, string> = {
  k: "var(--ink)", // 輪郭・目
  w: "#ffffff",
  // ハトリさん（伝書鳩）
  G: "#98a0aa", // はと灰
  N: "#4d9b6e", // 首の玉虫色
  // フクロPM
  O: "#8a6a48", // 羽
  C: "#c9b48f", // おなか
  c: "#a8916b", // おなかの斑
  Y: "#f2c14e", // 目（金）
  // トサカ先輩
  R: "#d64533", // トサカ・肉髯
  // カメ長老
  H: "#8fb573", // あたま
  K: "#5e8c4a", // 甲羅
  P: "#47703a", // 甲羅の模様
  // ペンさん
  X: "#2b3138", // くろ
  // クジャク部長
  T: "#2e8c6a", // 飾り羽
  D: "#e8a020", // 羽の目玉
  B: "#2b5fa8", // 胴
  // チュン太
  S: "#a5764a", // 茶
  U: "#e3d7bf", // おなか
  // ハチ子
  M: "#2e9c8c", // 胴
  m: "#7ad0c0", // 羽
  // ツルさん（丹頂鶴）: 頭頂の赤は R を共用。体は白窓の上でも消えないよう、わずかに落とした白
  W: "#e9e7de", // 羽毛の白
  Z: "#3a3f45", // 風切羽・首すじの黒
  // 共通
  o: "#e8a020", // くちばし・あし
  v: "#5a4632", // 濃いくちばし
};

const SPRITES: Record<NpcId, string[]> = {
  hato: [
    "............",
    "....GGGG....",
    "...GGGGGG...",
    "..GGGGGGGG..",
    "..GkGGGGkG..",
    "..NGGooGGN..",
    "..GwwwwwwG..",
    "..GwwwwwwG..",
    "..GGwwwwGG..",
    "...GGGGGG...",
    "...o....o...",
    "............",
  ],
  owl: [
    "..O......O..",
    "...OOOOOO...",
    "..OOOOOOOO..",
    "..OYYOOYYO..",
    "..OYkOOkYO..",
    "..OOOvvOOO..",
    "..OCCCCCCO..",
    "..OCcCCcCO..",
    "..OOCCCCOO..",
    "...OOOOOO...",
    "...o....o...",
    "............",
  ],
  chicken: [
    ".....RR.....",
    "....RRRR....",
    "...wwwwww...",
    "..wwwwwwww..",
    "..wkwwwwkw..",
    "..wwwoowww..",
    "..wwwRRwww..",
    "..wwwwwwww..",
    "...wwwwww...",
    "....wwww....",
    "...o....o...",
    "............",
  ],
  turtle: [
    "............",
    "....HHHH....",
    "...HkHHkH...",
    "....HHHH....",
    "..KKKKKKKK..",
    ".KKPKKKKPKK.",
    ".KKKKKKKKKK.",
    ".KKPKKKKPKK.",
    "..KKKKKKKK..",
    "...KKKKKK...",
    "...H....H...",
    "............",
  ],
  penguin: [
    "............",
    "....XXXX....",
    "...XXXXXX...",
    "..XXXXXXXX..",
    "..XwXXXXwX..",
    "..XXXooXXX..",
    "..XwwwwwwX..",
    "..XwwwwwwX..",
    "..XwwwwwwX..",
    "...XwwwwX...",
    "...o....o...",
    "............",
  ],
  peacock: [
    "..T.TTTT.T..",
    ".TDTTDDTTDT.",
    ".TTTTTTTTTT.",
    "..TTBBBBTT..",
    "..TBBBBBBT..",
    "...BkBBkB...",
    "...BBooBB...",
    "...BBBBBB...",
    "...BBBBBB...",
    "....BBBB....",
    "....o..o....",
    "............",
  ],
  sparrow: [
    "............",
    "....SSSS....",
    "...SSSSSS...",
    "..SkSSSSkS..",
    "..SSSSSSSS..",
    "...SSvvSS...",
    "..SUUkkUUS..",
    "..SUUUUUUS..",
    "...SUUUUS...",
    "....SSSS....",
    "...v....v...",
    "............",
  ],
  humming: [
    "............",
    ".....MMM....",
    "....MMMMM...",
    "...MkMMMMm..",
    "vvvMMMMMMm..",
    "....MMMMm...",
    ".....MMM....",
    "......M.....",
    "............",
    "............",
    "............",
    "............",
  ],
  tsuru: [
    "....RR......",
    "...WWWW.....",
    "...WkWvv....",
    "...ZWW......",
    "...ZW.......",
    "..WWWW......",
    ".WWWWWW.....",
    ".WWWWWWZZ...",
    ".WWWWWZZ....",
    "..WWWWZ.....",
    "...v...v....",
    "...v...v....",
  ],
};

export function NpcSprite(props: { npc: NpcId; px?: number }) {
  const rows = SPRITES[props.npc];
  const px = props.px ?? 5;
  return (
    <div
      aria-hidden="true"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(12, ${px}px)`,
        imageRendering: "pixelated",
      }}
    >
      {rows.flatMap((row, y) =>
        row.split("").map((ch, x) => (
          <i
            key={`${x}-${y}`}
            style={{
              width: px,
              height: px,
              display: "block",
              background: COLORS[ch] ?? "transparent",
            }}
          />
        ))
      )}
    </div>
  );
}
