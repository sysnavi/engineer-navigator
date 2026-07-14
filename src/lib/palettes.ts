// UIカラーパレット（きせかえ）のレジストリ。
// 実際の色トークンは globals.css の :root[data-palette="…"] に定義。
// ここは選択UI・バリデーション用のメタデータのみ。

export const PALETTES = [
  {
    id: "sky",
    name: "SKY",
    desc: "デフォルト・水色の方眼",
    swatches: ["#004AAD", "#5DADE2", "#D7E7F4"],
  },
  {
    id: "creamsoda",
    name: "CREAM SODA",
    desc: "ライラック×パープル",
    swatches: ["#8A3FC6", "#D48FE8", "#F9ECFD"],
  },
  {
    id: "gameboy",
    name: "GAME BOY",
    desc: "DMGグリーン単色系",
    swatches: ["#306230", "#8BAC0F", "#E6EFC8"],
  },
  {
    id: "midnight",
    name: "MIDNIGHT",
    desc: "ダーク・深夜のCRT",
    swatches: ["#2A6FD6", "#7FD1FF", "#0B1026"],
  },
  {
    id: "sunset",
    name: "SUNSET",
    desc: "夕焼けオレンジ",
    swatches: ["#D5552F", "#F0A24A", "#FDF0DC"],
  },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export function isPaletteId(v: string): v is PaletteId {
  return PALETTES.some((p) => p.id === v);
}
