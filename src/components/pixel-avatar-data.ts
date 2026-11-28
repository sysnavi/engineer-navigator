// アバターのドット絵（原本の文字マップと色）。PixelAvatar（2D・SSR）と 3D の .vox 生成（scripts/gen-charmap-vox.ts）が共用する。
// 3D の .vox は public/stack/avatar/<sprite>.vox。文字マップを直したら gen-charmap-vox.ts で起こし直す（.vox の手直しは上書きされる）。

export const AVATAR_COLORS: Record<string, string> = {
  k: "var(--ink)", // 輪郭
  y: "var(--lemon)", // からだ
  o: "#f59f00", // くちばし
  p: "var(--pink-hot)", // ほっぺ
  w: "#ffffff",
  b: "var(--royal)", // ヘッドホン
  g: "var(--good, #2e9e4f)", // マイスターのローブ
  s: "var(--peri, #b9d2ff)", // オーラ
  e: "#ffffff", // 目の光
  a: "#ffffff", // エプロン
  c: "#f0a500", // かんむり
  v: "#8f5bd9", // でんせつのローブ
};

// 20×20（2026-11-28 描き直し）。成長の順: たまご → ひよこ → みならい（芽・エプロン）→ いちにんまえ（ヘッドホン）
// → マイスター（ベレー帽・ローブ）。転生限定: きんのたまご・けんじゃ（とんがり帽子・ローブ）・でんせつ（かんむり・紫のローブ）。
// k は線（外周は 3D では捨てて描画側が引く。中の k は目・ひび）。e は目の光、a はエプロン（どちらも正面だけの塗り）。
export const AVATAR_SPRITES: Record<string, string[]> = {
  egg: [
    "....................",
    "....................",
    "....................",
    "....................",
    ".......kkkkkk.......",
    ".....kkwwwwwwkk.....",
    "....kwwwwwwwwwwk....",
    "...kwwwwwwwwwwwwk...",
    "...kwwwwwwwwwwwwk...",
    "..kwwwwwwwwwwwwwwk..",
    "..kwwwwwwwwwwwwwwk..",
    "..kkwwkwwkkwwkwwkk..",
    "..kwkkwkkwwkkwkkwk..",
    "..kwwwwwwwwwwwwwwk..",
    "..kwwwwwwwwwwwwwwk..",
    "...kwwwwwwwwwwwwk...",
    "...kwwwwwwwwwwwwk...",
    "....kwwwwwwwwwwk....",
    ".....kkwwwwwwkk.....",
    ".......kkkkkk.......",
  ],
  chick: [
    "....................",
    "....................",
    "......kkkkkkkk......",
    "....kkyyyyyyyykk....",
    "...kyyyyyyyyyyyyk...",
    "..kyyyyyyyyyyyyyyk..",
    "..kyyyyyyyyyyyyyyk..",
    ".kyyyekyyyyyykeyyyk.",
    ".kyyykkyyyyyykkyyyk.",
    ".kyyykkyyyyyykkyyyk.",
    ".kyppyyyyooyyyyppyk.",
    ".kyppyyyooooyyyppyk.",
    ".kyyyyyyyooyyyyyyyk.",
    ".kyyyyyyyyyyyyyyyyk.",
    ".kykyyyyyyyyyyyykyk.",
    "..kkyyyyyyyyyyyykk..",
    "...kyyyyyyyyyyyyk...",
    "....kkkkkkkkkkkk....",
    ".......ko..ok.......",
    "......kkk..kkk......",
  ],
  minarai: [
    ".......gg..gg.......",
    ".........gg.........",
    "......kkkggkkk......",
    "....kkyyyyyyyykk....",
    "..kkyyyyyyyyyyyykk..",
    ".kyyyyyyyyyyyyyyyyk.",
    "kyyyyekyyyyyykeyyyyk",
    "kyyyykkyyyyyykkyyyyk",
    "kyyyykkyyyyyykkyyyyk",
    "kyyppyyyyooyyyyppyyk",
    "kyyppyyyooooyyyppyyk",
    "kyyyyyyyyooyyyyyyyyk",
    "kyyyaaaaaaaaaaaayyyk",
    "kykyaaaaaaaaaaaaykyk",
    "kyykaaaaaaaaaaaakyyk",
    ".kyyaaaaaaaaaaaayyk.",
    "..kyyyyyyyyyyyyyyk..",
    "...kkkkkkkkkkkkkk...",
    "......ko....ok......",
    ".....kkk....kkk.....",
  ],
  ichininmae: [
    "....bbbbbbbbbbbb....",
    "...bbyyyyyyyyyybb...",
    "..byyyyyyyyyyyyyyb..",
    "..byyyyyyyyyyyyyyb..",
    ".bbyyyyyyyyyyyyyybb.",
    "bbbyyyyyyyyyyyyyybbb",
    "bbbyyyekyyyykeyyybbb",
    "bbbyyykkyyyykkyyybbb",
    "bbbyyykkyyyykkyyybbb",
    ".kyppyyyyooyyyyppyk.",
    "kyyppyyyooooyyyppyyk",
    "kyyyyyyyyooyyyyyyyyk",
    "kyyyyyyyyyyyyyyyyyyk",
    "kykyyyyyyyyyyyyyykyk",
    "kyykyyyyyyyyyyyykyyk",
    ".kyyyyyyyyyyyyyyyyk.",
    "..kyyyyyyyyyyyyyyk..",
    "...kkkkkkkkkkkkkk...",
    "......ko....ok......",
    ".....kkk....kkk.....",
  ],
  meister: [
    "........gggg........",
    ".....gggggggggg.....",
    "...gggggggggggggg...",
    "..kyyyyyyyyyyyyyyk..",
    ".kyyyyyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyyyyyk.",
    "kyyyyekyyyyyykeyyyyk",
    "kyyyykkyyyyyykkyyyyk",
    "kyyyykkyyyyyykkyyyyk",
    "kyyppyyyyooyyyyppyyk",
    "kyyppyyyooooyyyppyyk",
    "kyyyyyyyyooyyyyyyyyk",
    "kggggggggooggggggggk",
    "kgkggggggggggggggkgk",
    "kggkggggggggggggkggk",
    ".kggggggggggggggggk.",
    "..kggggggggggggggk..",
    "...kkkkkkkkkkkkkk...",
    "......ko....ok......",
    ".....kkk....kkk.....",
  ],
  // --- 継承（転生）限定の形態 (Issue #1) ---
  goldegg: [
    "....................",
    "....................",
    "....................",
    "....................",
    ".......kkkkkk.......",
    ".....kkyyyyyykk.....",
    "....kwyyyyyyyyyk....",
    "...kwwyyyyyyyyyyk...",
    "...kyyyyyyyyyyyyk...",
    "..kyyyyyyyyyyyyyyk..",
    "..kyyyyyyyyyyyyyyk..",
    "..kyoyyyoyyoyyyoyk..",
    "..kooooooooooooook..",
    "..koyyoyyyyyyoyyok..",
    "..kyyyyyyyyyyyyyyk..",
    "...kyyyyyyyyyyyyk...",
    "...kyyyyyyyyyyyyk...",
    "....kyyyyyyyyyyk....",
    ".....kkyyyyyykk.....",
    ".......kkkkkk.......",
  ],
  sage: [
    ".........bb.........",
    "........bbbb........",
    ".......bbbbbb.......",
    "......bbwbbwbb......",
    ".....bbbbbbbbbb.....",
    "....bbbbbbbbbbbb....",
    "bbbbbbbbbbbbbbbbbbbb",
    ".kyyyyyyyyyyyyyyyyk.",
    ".kyyyekyyyyyykeyyyk.",
    ".kyyykkyyyyyykkyyyk.",
    ".kyyykkyyyyyykkyyyk.",
    ".kyppyyyyooyyyyppyk.",
    ".kyppyyyooooyyyppyk.",
    "kbbbbbbbbbbbbbbbbbbk",
    "kbkbbbbbbbbbbbbbbkbk",
    "kbbkbbbbbbbbbbbbkbbk",
    ".kbbbbbbbbbbbbbbbbk.",
    "..kkkkkkkkkkkkkkkk..",
    "......ko....ok......",
    ".....kkk....kkk.....",
  ],
  legend: [
    ".......c.cc.c.......",
    "......cccccccc......",
    "......cccppccc......",
    "....kyyyyyyyyyyk....",
    "..kkyyyyyyyyyyyykk..",
    ".kyyyyyyyyyyyyyyyyk.",
    "kyyyyekyyyyyykeyyyyk",
    "kyyyykkyyyyyykkyyyyk",
    "kyyyykkyyyyyykkyyyyk",
    "kyyppyyyyooyyyyppyyk",
    "kyyppyyyooooyyyppyyk",
    "kyyyyyyyyooyyyyyyyyk",
    "kvvvvvvvvoovvvvvvvvk",
    "kvkvvvvvvvvvvvvvvkvk",
    "kvvkvvvvvvvvvvvvkvvk",
    ".kvvvvvvvvvvvvvvvvk.",
    "..kvvvvvvvvvvvvvvk..",
    "...kkkkkkkkkkkkkk...",
    "......ko....ok......",
    ".....kkk....kkk.....",
  ],
};

/** 表示の大きさの基準のマス数。PixelAvatar の px は「この数で割った 1 マス」（10×10 の頃と同じ大きさで出す） */
export const AVATAR_GRID = 10;
/** 3D の拡大率の基準（正面の絵の一番大きい段階の縦横）。全段階で同じ拡大率にして、成長の大きさの差を残す */
export const AVATAR_FIT = 25;

// 3D（.vox）での色の番号。値は CSS 変数のまま渡し、表示時に今のきせかえパレットで解く
export const AVATAR_VOX_INDEX: Record<string, number> = { y: 1, o: 3, k: 4, e: 5, p: 6, w: 8, b: 9, g: 10, s: 11, a: 12, c: 13, v: 14 };
export const AVATAR_VOX_PALETTE: Record<number, string> = Object.fromEntries(
  Object.entries(AVATAR_VOX_INDEX).map(([ch, i]) => [i, AVATAR_COLORS[ch]])
);
