// 機能アイコンのドット絵（PixelAvatarと同方式・画像ファイル不要・SSR可）。
// 文字→色はパレットCSS変数準拠。アイコンを足すときは APPS の id と同名でマップを足す。

const COLORS: Record<string, string> = {
  k: "var(--ink)",
  w: "#ffffff",
  y: "var(--lemon)",
  p: "var(--pink-hot)",
  r: "var(--crit, #e5484d)",
  g: "var(--good, #2e9e5b)",
  b: "var(--royal-2)",
  s: "var(--sky8)",
  e: "var(--peri)",
  n: "#b08050",
  o: "var(--warn, #e8a013)",
};

const MAPS: Record<string, string[]> = {
  report: [
    ".kkkkkkk....",
    ".kwwwwwkk...",
    ".kwbbbwwk...",
    ".kwwwwwwk...",
    ".kwbbbbwk...",
    ".kwwwwwwkpp.",
    ".kwbbwwkpp..",
    ".kwwwwppk...",
    ".kwwwppwk...",
    ".kkkkkkkkk..",
  ],
  // 六角形レーダーチャート。中の緑は軸ごとに長短をつけて「凹凸のあるデータ」を表す
  skills: [
    ".....kk.....",
    "...kkggkk...",
    ".kk.ggg..kk.",
    "k...gggg...k",
    "k..gggg....k",
    "k..ggggg...k",
    "kggggggg...k",
    "k..ggggggggk",
    "k...gggg...k",
    ".kk..gg..kk.",
    "...kk..kk...",
    ".....kk.....",
  ],
  resume: [
    ".kkkkkkkkk..",
    ".kwwwwwwwk..",
    ".kwbbwkkwk..",
    ".kwbbwwwwk..",
    ".kwwwwwwwk..",
    ".kwbbbbwwk..",
    ".kwwwwwwwk..",
    ".kwbbbwwwk..",
    ".kkkkkkkkk..",
  ],
  mentor: [
    ".....y......",
    ".....k......",
    ".kkkkkkkkk..",
    ".kwwwwwwwk..",
    ".kwbwwwbwk..",
    ".kwwwwwwwk..",
    ".kwwbbbwwk..",
    ".kkkkkkkkk..",
  ],
  plan: [
    ".......krr..",
    ".......krr..",
    ".......k....",
    ".......k....",
    "......kkk...",
    ".....e......",
    "...e........",
    ".p..........",
  ],
  quiz: [
    ".kkkkkkkkk..",
    ".kwyyyyywk..",
    ".kyykkkkyk..",
    ".kyyyyykyk..",
    ".kyyyykyyk..",
    ".kyyykyyyk..",
    ".kyyyyyyyk..",
    ".kwyykyywk..",
    ".kkkkkkkkk..",
  ],
  roleplay: [
    "..kkkkkkk...",
    ".kwwwwwwwk..",
    ".kwkwwwkwk..",
    ".kwwwwwwwk..",
    ".kwkwwwkwk..",
    ".kwwkkkwwk..",
    "..kwwwwwk...",
    "...kkkkk....",
  ],
  dungeon: [
    "...kkkkkk...",
    "..knnnnnnk..",
    ".knnnnnnnnk.",
    ".knnkkkknnk.",
    ".knkkkkkknk.",
    ".knkkkkkknk.",
    ".knkkkkkknk.",
    ".kkkkkkkkkk.",
  ],
  yomoyama: [
    "...s..s.....",
    "..s..s......",
    ".kkkkkkkkk..",
    ".kgggggggk..",
    ".kwwwwwwwk..",
    ".kwwwwwwwk..",
    "..kwwwwwk...",
    "..kkkkkkk...",
  ],
  discover: [
    "..kkkk......",
    ".kssssk.....",
    "kswssssk....",
    "kssssssk....",
    "kssssssk....",
    ".kssssk.....",
    "..kkkkkk....",
    "......kkk...",
    ".......kkk..",
    "........kk..",
  ],
  mypage: [
    "....kkkk....",
    ".kk.kbbk.kk.",
    ".kbkkbbkkbk.",
    "..kbbbbbbk..",
    "kkbbkkkkbbkk",
    "kbbbkwwkbbbk",
    "kbbbkwwkbbbk",
    "kkbbkkkkbbkk",
    "..kbbbbbbk..",
    ".kbkkbbkkbk.",
    ".kk.kbbk.kk.",
    "....kkkk....",
  ],
  home: [
    ".....kk.....",
    "....kppk....",
    "...kppppk...",
    "..kppppppk..",
    ".kkkkkkkkkk.",
    "..kwkkkkwk..",
    "..kwkyykwk..",
    "..kwkyykwk..",
    "..kkkkkkkk..",
  ],
  condition: [
    "..kk..kk....",
    ".kppkkppk...",
    ".kppppppk...",
    "..kppppk....",
    "...kppk.....",
    "....kk......",
    "............",
    "............",
  ],
  admin: [
    ".kkkkkkkkk..",
    ".kbbbbbbbk..",
    ".kbbbybbbk..",
    ".kbbyyybbk..",
    ".kbbbybbbk..",
    "..kbbbbbk...",
    "...kbbbk....",
    "....kbk.....",
    ".....k......",
  ],
};

export function PixelIcon(props: { id: string; px?: number }) {
  const rows = MAPS[props.id] ?? MAPS.mypage;
  const px = props.px ?? 3;
  const cols = rows[0].length;
  return (
    <span
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
    </span>
  );
}
