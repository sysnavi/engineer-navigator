// ピクセルアバター（サーバーレンダリング可・画像ファイル不要）。
// 見た目は進化段階(stage)から決定的に決まる。マップの文字→色はパレットCSS変数に
// 寄せてあるので、きせかえパレットでも世界観が保たれる。

const COLORS: Record<string, string> = {
  k: "var(--ink)", // 輪郭
  y: "var(--lemon)", // からだ
  o: "#f59f00", // くちばし
  p: "var(--pink-hot)", // ほっぺ
  w: "#ffffff",
  b: "var(--royal)", // ヘッドホン
  g: "var(--good, #2e9e4f)", // マイスターのローブ
  s: "var(--peri, #b9d2ff)", // オーラ
};

const SPRITES: Record<string, string[]> = {
  egg: [
    "...kkkk...",
    "..kwwwwk..",
    ".kwwwwwwk.",
    ".kwwwkwwk.",
    "kwwwkwkwwk",
    "kwwwwkwwwk",
    "kwwwwwwwwk",
    "kwwwwwwwwk",
    ".kwwwwwwk.",
    "..kkkkkk..",
  ],
  chick: [
    "..kkkkkk..",
    ".kyyyyyyk.",
    "kyykyykyyk",
    "kyyyyyyyyk",
    "kypyookpyk",
    "kyyyooyyyk",
    "kyyyyyyyyk",
    ".kyyyyyyk.",
    "..kkkkkk..",
    "..k....k..",
  ],
  minarai: [
    "..kkkkkk..",
    ".kyyyyyyk.",
    "kyykyykyyk",
    "kyyyyyyyyk",
    "kypyookpyk",
    "kyyyooyyyk",
    "kyywwwwyyk",
    ".kywwwwyk.",
    "..kkkkkk..",
    "..k....k..",
  ],
  ichininmae: [
    "b.kkkkkk.b",
    "bkyyyyyykb",
    "bbkyyyykbb",
    "kbkkyykkbk",
    "kyyyyyyyyk",
    "kypyookpyk",
    "kyyyooyyyk",
    "kyyyyyyyyk",
    ".kyyyyyyk.",
    "..kkkkkk..",
  ],
  meister: [
    "..s.ss.s..",
    ".skkkkkks.",
    "skyyyyyyks",
    "kyykyykyyk",
    "kyyyyyyyyk",
    "kypyookpyk",
    "kyyyooyyyk",
    "kggggggggk",
    ".kggggggk.",
    "..kkkkkk..",
  ],
};

export function PixelAvatar(props: { sprite: string; px?: number }) {
  const rows = SPRITES[props.sprite] ?? SPRITES.egg;
  const px = props.px ?? 6;
  const cols = rows[0].length;
  return (
    <div
      aria-hidden="true"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${px}px)`,
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
