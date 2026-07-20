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
  skills: [
    "............",
    "..y.........",
    "..k...y.....",
    "..k...k...y.",
    "..k...k...k.",
    "..k.k.k.k.k.",
    "..kkkkkkkkk.",
    "............",
  ],
  resume: [
    "..kkkkkkk...",
    "..kwwwwwk...",
    "..kwkkkwk...",
    "..kwwwwwk...",
    "..kwkkwwk...",
    "..kwwwwwk...",
    "..kwkkkwk...",
    "..kwwwwwk...",
    "..kkkkkkk...",
    "....yy......",
  ],
  mentor: [
    ".kkkkkkkk...",
    ".kwwwwwwk...",
    ".kwkwkwwk...",
    ".kwwwwwwk...",
    ".kkkkkkkk...",
    "....kk......",
    "...k........",
    "............",
  ],
  plan: [
    ".kkkkkkkkk..",
    ".kyykyykyk..",
    ".kkkkkkkkk..",
    ".kwwkwwkwk..",
    ".kkkkkkkkk..",
    ".kwwkggkwk..",
    ".kkkkkkkkk..",
    "............",
  ],
  quiz: [
    "..kkkkkk....",
    ".kyyyyyyk...",
    ".kyykkyyk...",
    ".kyyykyyk...",
    ".kyyyyyyk...",
    ".kyyykyyk...",
    ".kyyyyyyk...",
    "..kkkkkk....",
  ],
  roleplay: [
    ".kkk....kkk.",
    "kwwwk..kbbbk",
    "kwkwk..kbkbk",
    "kwwwk..kbbbk",
    ".kkk....kkk.",
    "..kkkkkkk...",
    "............",
    "............",
  ],
  dungeon: [
    "......kk....",
    ".....kyyk...",
    "....kyyk....",
    "...kyyk.....",
    "..kkyk......",
    ".kkkk.......",
    "kkkk........",
    "kkk.........",
  ],
  yomoyama: [
    "....rr......",
    "...ryyr.....",
    "...ryyr.....",
    "..ryyyyr....",
    "..kkkkkk....",
    ".knnnnnnk...",
    "..k.k.k.....",
    "............",
  ],
  discover: [
    "...kkkkk....",
    "..ksssssk...",
    ".kssbbsssk..",
    ".ksbbbbssk..",
    ".kssbbsssk..",
    "..ksssssk...",
    "...kkkkk....",
    "............",
  ],
  mypage: [
    ".....kk.....",
    "....kbbk....",
    "...kbbbbk...",
    "..kbbbbbbk..",
    ".kkkkkkkkkk.",
    "..kwwkkwwk..",
    "..kwwkkwwk..",
    "..kkkkkkkk..",
  ],
  home: [
    ".....kk.....",
    "....kppk....",
    "...kppppk...",
    "..kppppppk..",
    ".kkkkkkkkkk.",
    "..kwwwwwwk..",
    "..kwpkkpwk..",
    "..kwppppwk..",
    "..kwwppwwk..",
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
    "....kk......",
    "..kkyykk....",
    "..kyyyyk....",
    ".kkyykykk...",
    "..kyyyyk....",
    "..kkyykk....",
    "....kk......",
    "............",
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
