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
};

export const AVATAR_SPRITES: Record<string, string[]> = {
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
  // --- 継承（転生）限定の形態 (Issue #1) ---
  goldegg: [
    "...kkkk...",
    "..kyyyyk..",
    ".kyywyyyk.",
    ".kywyyyyk.",
    "kyyyykyyyk",
    "kyyykykyyk",
    "kyyyykyyyk",
    "kyyyyyywyk",
    ".kyyyyyyk.",
    "..kkkkkk..",
  ],
  sage: [
    "...kbbk...",
    "..kbbbbk..",
    ".kbbbbbbk.",
    "kyyyyyyyyk",
    "kyykyykyyk",
    "kypyookpyk",
    "kyyyooyyyk",
    "kbbbbbbbbk",
    ".kbbbbbbk.",
    "..kkkkkk..",
  ],
  legend: [
    "s.ky.yk..s",
    ".kyyyyyyk.",
    "skyyyyyyks",
    "kyykyykyyk",
    "kyyyyyyyyk",
    "kypyookpyk",
    "kyyyooyyyk",
    "kwwwwwwwwk",
    ".kwwwwwwk.",
    "s.kkkkkk.s",
  ],
};

// 3D（.vox）での色の番号。値は CSS 変数のまま渡し、表示時に今のきせかえパレットで解く
export const AVATAR_VOX_INDEX: Record<string, number> = { y: 1, o: 3, k: 4, p: 6, w: 8, b: 9, g: 10, s: 11 };
export const AVATAR_VOX_PALETTE: Record<number, string> = Object.fromEntries(
  Object.entries(AVATAR_VOX_INDEX).map(([ch, i]) => [i, AVATAR_COLORS[ch]])
);
