// ごはんのドット絵（Issue #23）。PixelAvatar と同じ CSS グリッド方式で、
// 画像ファイルなしにサーバーレンダリングできる。将来の支給PNG差し替え時も
// 呼び出し側は <FoodSprite id="..."/> のままでよい。

const COLORS: Record<string, string> = {
  k: "var(--ink)", // 極太アウトライン（キャラ素材と同じ作法）
  w: "#fff8f0", // ごはん・牛乳
  n: "#254117", // のり
  g: "#b8e08a", // メロンパンの皮
  y: "#f2dfa8", // 焼き目の格子
  c: "#a9714b", // コーヒー
  r: "#e24b4b", // ケチャップ・パックの帯
  d: "var(--lemon)", // たまご（きん）
  o: "#e8a13a", // たまごの影
  p: "var(--pink-hot)", // 旗
};

// 器（お皿・てのひら）は FoodServe 側で使う。
// お皿の1行目は“奥側の縁”＝両端だけ。中央を抜くことで、器を手前に描いても
// ごはんの識別部分（のり等）が隠れず「中に入っている」ように見える（Issue #23）。
export const DISH_SPRITE = [
  ".kk......kk.",
  ".kwwwwwwwwk.",
  "..kwppppwk..",
  "...kkkkkk...",
];

export const HANDS_SPRITE = [
  ".k........k.",
  ".kk......kk.",
  ".khk....khk.",
  ".khhkkkkhhk.",
  "..khhhhhhk..",
  "..khhhhhhk..",
  "...kkkkkk...",
];

const SPRITES: Record<string, string[]> = {
  onigiri: [
    ".....kk.....",
    "....kwwk....",
    "...kwwwwk...",
    "...kwwwwk...",
    "..kwwwwwwk..",
    "..kwwwwwwk..",
    ".kwwwwwwwwk.",
    ".kwwnnnnwwk.",
    ".kwnnnnnnwk.",
    ".kkkkkkkkkk.",
  ],
  melonpan: [
    "....kkkk....",
    "..kkggggkk..",
    ".kggyggyggk.",
    ".kgyggyggyk.",
    ".kggyggyggk.",
    ".kgyggyggyk.",
    ".kggyggyggk.",
    "..kgggggggk.",
    "...kkkkkk...",
  ],
  "coffee-milk": [
    "....kkkk....",
    "....krrk....",
    "....kwwk....",
    "...kkwwkk...",
    "..kwwwwwwk..",
    "..kwcccckw..",
    "..kwcccckw..",
    "..kwcccckw..",
    "..kwwwwwwk..",
    "...kkkkkk...",
  ],
  "gold-omurice": [
    ".......kpk..",
    ".......kpk..",
    ".......k....",
    "....kkkkk...",
    "..kkdddddkk.",
    ".kdddddddddk",
    ".kddrrrrdddk",
    ".kdddddddddk",
    "..kkddoddkk.",
    "....kkkkk...",
  ],
};

export function FoodSprite(props: {
  id: string;
  px?: number;
  label?: string;
}) {
  const rows = SPRITES[props.id];
  const px = props.px ?? 3;
  if (!rows) return null;
  return (
    <span
      role={props.label ? "img" : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : "true"}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${rows[0].length}, ${px}px)`,
        imageRendering: "pixelated",
        lineHeight: 0,
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
    </span>
  );
}

/** 器（お皿 / てのひら）。もりつけ演出でごはんの手前に重ねて描く */
export function VesselSprite(props: { kind: "dish" | "hands"; px?: number }) {
  const rows = props.kind === "hands" ? HANDS_SPRITE : DISH_SPRITE;
  const px = props.px ?? 5;
  const colors: Record<string, string> = { ...COLORS, h: "#f2c094" };
  return (
    <span
      aria-hidden="true"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${rows[0].length}, ${px}px)`,
        imageRendering: "pixelated",
        lineHeight: 0,
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
              background: colors[ch] ?? "transparent",
            }}
          />
        ))
      )}
    </span>
  );
}
