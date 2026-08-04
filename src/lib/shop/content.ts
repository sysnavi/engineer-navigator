// おかいもの（SHOP.cat）のTSマスタ（ダンジョン/げんばと同方針: DBに持たずID参照）。
// クライアントからも読まれるので prisma 依存禁止。通貨はEN（げんばで稼ぐ）。
//
// 松版（Issue: おかいもの改修）:
//  - シリーズ制コレクション（既存12種を2シリーズに分類 + 新シリーズ3つ）
//  - 家具はLIVING.savに自由配置（zone/size/petSpot が配置と ペットのふるまい を決める）
//  - 新シリーズは週替わり入荷（rotating）。定番2シリーズは常時在庫
//  - シリーズコンプで きせかえ（壁紙/床）が解放される（scene.ts 側の unlockSeries）

export type FurnZone = "wall" | "shelf" | "floor";

/** ペットが家具をどう使うか（LIVING.savのスナップ挙動） */
export type PetSpotKind =
  | "sleep" // うえで丸くなって昼寝（寝顔差分 + 💤）
  | "sit" // うえでちょこんとくつろぐ
  | "top" // てっぺんにのぼる（キャットタワー）
  | "watch" // よこ/したから じっと見つめる
  | "front"; // まえに陣取る

export type ShopSeries = {
  id: string;
  name: string;
  desc: string;
  /** true = 週替わり入荷の対象（未所持でも今週の入荷分しか買えない） */
  rotating: boolean;
};

export type ShopItem = {
  id: string;
  name: string;
  desc: string;
  price: number; // EN
  series: string; // ShopSeries.id
  zone: FurnZone; // LIVING.savでの設置ゾーン
  size: number; // シーン幅に対する%（PET_SIZE=10 が ものさし）
  /** ラグ・ざぶとんなど「床に敷く」もの。常にペットより奥に描く */
  flat?: boolean;
  petSpot?: { kind: PetSpotKind; line: string }; // line=「{name}は…」のふるまい文
  sprite: string[]; // 12x12 ドット絵（shop-sprite.tsx の色表参照）
};

export const SHOP_SERIES: ShopSeries[] = [
  {
    id: "hajimete",
    name: "はじめてのおへや",
    desc: "ひとり暮らしの第一歩。まずはここから",
    rotating: false,
  },
  {
    id: "kutsurogi",
    name: "くつろぎリビング",
    desc: "満了明けの休日を、なかまと過ごすための家具",
    rotating: false,
  },
  {
    id: "retro",
    name: "なつかしゲーム部屋",
    desc: "ワンコインで無限に遊べた、あのころの記憶",
    rotating: true,
  },
  {
    id: "washitsu",
    name: "わしつのやすらぎ",
    desc: "い草の香りとぬくもり。心の定時退社",
    rotating: true,
  },
  {
    id: "midori",
    name: "みどりのオアシス",
    desc: "画面疲れの目に、みどりの休憩を",
    rotating: true,
  },
];

export const SHOP_ITEMS: ShopItem[] = [
  // =========================================================================
  // はじめてのおへや（定番）
  // =========================================================================
  {
    id: "poster",
    name: "きんのたまごポスター",
    desc: "「初心わするべからず」。転生者に人気の一枚",
    price: 200,
    series: "hajimete",
    zone: "wall",
    size: 8,
    sprite: [
      "kkkkkkkkkkkk",
      "kwwwwwwwwwwk",
      "kwwwyyyywwwk",
      "kwwyyyyyywwk",
      "kwwyywyyywwk",
      "kwwyyyyyywwk",
      "kwwyyyyyywwk",
      "kwwwyyyywwwk",
      "kwwwwwwwwwwk",
      "kkkkkkkkkkkk",
      "............",
      "............",
    ],
  },
  {
    id: "plant",
    name: "かんようしょくぶつ",
    desc: "現場で荒んだ心に、みどりを",
    price: 300,
    series: "hajimete",
    zone: "floor",
    size: 7,
    sprite: [
      "............",
      "....gg......",
      "..gggggg.g..",
      ".gggggggggg.",
      "..gggggggg..",
      "...gggggg...",
      "....gggg....",
      "....nnnn....",
      "...nnnnnn...",
      "...nnnnnn...",
      "....nnnn....",
      "............",
    ],
  },
  {
    id: "lamp",
    name: "フロアランプ",
    desc: "夜のコーディングを、あたたかく照らす",
    price: 400,
    series: "hajimete",
    zone: "floor",
    size: 6,
    sprite: [
      "...yyyyyy...",
      "..yyyyyyyy..",
      ".yyyyyyyyyy.",
      ".yyyyyyyyyy.",
      "..yyyyyyyy..",
      ".....kk.....",
      ".....kk.....",
      ".....kk.....",
      ".....kk.....",
      ".....kk.....",
      "...kkkkkk...",
      "............",
    ],
  },
  {
    id: "rug",
    name: "ふわふわラグ",
    desc: "ペットがまっさきに寝転ぶ場所",
    price: 500,
    series: "hajimete",
    zone: "floor",
    size: 16,
    flat: true,
    petSpot: { kind: "sleep", line: "ラグのうえで まるくなって おひるね中" },
    sprite: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "...pppppp...",
      ".pppwwwwppp.",
      "ppwwppppwwpp",
      ".pppwwwwppp.",
      "...pppppp...",
      "............",
    ],
  },
  {
    id: "coffee",
    name: "コーヒーメーカー",
    desc: "朝会前の一杯が現場の平和を守る",
    price: 600,
    series: "hajimete",
    zone: "shelf",
    size: 5,
    sprite: [
      "............",
      "..kkkkkkkk..",
      "..knnnnnnk..",
      "..kkkkkkkk..",
      "..kk....kk..",
      "..kkwwwwkk..",
      "..kkwnnwkk..",
      "..kkwnnwkk..",
      "..kkwwwwkk..",
      "..kkkkkkkk..",
      "..kkkkkkkk..",
      "............",
    ],
  },
  {
    id: "bookshelf",
    name: "ほんだな",
    desc: "背表紙を眺めるだけで強くなった気がする",
    price: 700,
    series: "hajimete",
    zone: "floor",
    size: 12,
    sprite: [
      "kkkkkkkkkkkk",
      "knnnnnnnnnnk",
      "knrygbrygbnk",
      "knrygbrygbnk",
      "knnnnnnnnnnk",
      "knbgyrbgyrnk",
      "knbgyrbgyrnk",
      "knnnnnnnnnnk",
      "knygrbygrbnk",
      "knygrbygrbnk",
      "kkkkkkkkkkkk",
      "............",
    ],
  },
  // =========================================================================
  // くつろぎリビング（定番）
  // =========================================================================
  {
    id: "sofa",
    name: "ふかふかソファ",
    desc: "満了明けの休日はここから動かない",
    price: 800,
    series: "kutsurogi",
    zone: "floor",
    size: 15,
    petSpot: { kind: "sit", line: "ソファのうえで くつろぎ中" },
    sprite: [
      "............",
      "............",
      "............",
      ".rr......rr.",
      ".rrrrrrrrrr.",
      ".rrwwwwwwrr.",
      ".rrwwwwwwrr.",
      ".rrrrrrrrrr.",
      ".rrrrrrrrrr.",
      ".kk......kk.",
      "............",
      "............",
    ],
  },
  {
    id: "cattower",
    name: "キャットタワー",
    desc: "鳥もスライムも、なぜかのぼりたがる",
    price: 900,
    series: "kutsurogi",
    zone: "floor",
    size: 10,
    petSpot: { kind: "top", line: "キャットタワーのてっぺんが きょうの特等席" },
    sprite: [
      "..nnnnnn....",
      "..nnnnnn....",
      ".....kk.....",
      "....nnnnnn..",
      "....nnnnnn..",
      ".....kk.....",
      ".....kk.....",
      "..nnnnnnnn..",
      "..nnnnnnnn..",
      ".....kk.....",
      "...kkkkkk...",
      "............",
    ],
  },
  {
    id: "fridge",
    name: "れいぞうこ",
    desc: "ごはんのストックがちょっと誇らしい",
    price: 1000,
    series: "kutsurogi",
    zone: "floor",
    size: 9,
    petSpot: { kind: "front", line: "れいぞうこの前で おやつを おねだり中" },
    sprite: [
      "..kkkkkkkk..",
      "..kwwwwwwk..",
      "..kwwwwkwk..",
      "..kwwwwwwk..",
      "..kkkkkkkk..",
      "..kwwwwwwk..",
      "..kwwwwkwk..",
      "..kwwwwwwk..",
      "..kwwwwwwk..",
      "..kwwwwwwk..",
      "..kkkkkkkk..",
      "............",
    ],
  },
  {
    id: "aquarium",
    name: "ちいさな水槽",
    desc: "ゆらゆら泳ぐ魚は、レビュー待ちの心の薬",
    price: 1200,
    series: "kutsurogi",
    zone: "shelf",
    size: 7,
    petSpot: { kind: "watch", line: "水槽のさかなを 下から じっと見ている" },
    sprite: [
      "kkkkkkkkkkkk",
      "kssssssssssk",
      "kssssssssssk",
      "kssrrsssssok",
      "ksrrrrssssok",
      "kssrrsssssok",
      "kssssssgsssk",
      "ksssssgggssk",
      "kssgggggssgk",
      "kggssggssggk",
      "kkkkkkkkkkkk",
      "............",
    ],
  },
  {
    id: "tv",
    name: "だいがめんテレビ",
    desc: "リビングの主役。家族会議もゲームもこれで",
    price: 1500,
    series: "kutsurogi",
    zone: "floor",
    size: 14,
    petSpot: { kind: "front", line: "テレビの前から うごかない" },
    sprite: [
      "kkkkkkkkkkkk",
      "kbbbbbbbbbbk",
      "kbbsbbbbbbbk",
      "kbsbbbbbbbbk",
      "kbbbbbbbbbbk",
      "kbbbbbbbbbbk",
      "kbbbbbbbbbbk",
      "kkkkkkkkkkkk",
      ".....kk.....",
      "...kkkkkk...",
      "............",
      "............",
    ],
  },
  {
    id: "trophy",
    name: "満了トロフィー",
    desc: "契約満了の誇り。ハトリさんもうれしそう",
    price: 2000,
    series: "kutsurogi",
    zone: "shelf",
    size: 5,
    sprite: [
      "............",
      "..yyyyyyyy..",
      "..y.yyyy.y..",
      "..y.yyyy.y..",
      "...yyyyyy...",
      "....yyyy....",
      ".....yy.....",
      ".....yy.....",
      "....yyyy....",
      "...kkkkkk...",
      "..kkkkkkkk..",
      "............",
    ],
  },
  // =========================================================================
  // なつかしゲーム部屋（週替わり）
  // =========================================================================
  {
    id: "arcade",
    name: "レトロきょうたい",
    desc: "ワンコインで朝まで。基板は現役",
    price: 2800,
    series: "retro",
    zone: "floor",
    size: 11,
    petSpot: { kind: "front", line: "きょうたいのレバーに かじりつき" },
    sprite: [
      ".kkkkkkkkk..",
      ".kbbbbbbbk..",
      ".kbsssssbk..",
      ".kbsgwgsbk..",
      ".kbsssssbk..",
      ".kbbbbbbbk..",
      ".kmmmmmmmk..",
      ".kmrmmommk..",
      ".kkkkkkkkk..",
      ".kmmmmmmmk..",
      ".kmmmmmmmk..",
      ".kkkkkkkkk..",
    ],
  },
  {
    id: "crt",
    name: "ブラウンかんとゲームき",
    desc: "カセットをさして電源オン。読み込みは気合",
    price: 1800,
    series: "retro",
    zone: "floor",
    size: 10,
    petSpot: { kind: "front", line: "ブラウンかんの前で コントローラーを にぎっている" },
    sprite: [
      "............",
      ".kkkkkkkkk..",
      ".keeeeeeek..",
      ".kesssssek..",
      ".kesbgrsek..",
      ".kesssssek..",
      ".keeeeeeek..",
      ".kkkkkkkkk..",
      "..kkkkkkk...",
      ".kmmmmmmmk..",
      ".kmmkkmmok..",
      ".kkkkkkkkk..",
    ],
  },
  {
    id: "cassette",
    name: "カセットのやま",
    desc: "フーフーすると なおる気がする",
    price: 900,
    series: "retro",
    zone: "shelf",
    size: 6,
    sprite: [
      "............",
      "............",
      "............",
      "...kkkkk....",
      "...kbbok....",
      "..kkkkkkk...",
      "..kggggok...",
      "..kkkkkkk...",
      ".kkkkkkkkk..",
      ".krrrrrrok..",
      ".kkkkkkkkk..",
      "............",
    ],
  },
  {
    id: "scoreposter",
    name: "ハイスコアポスター",
    desc: "1位の名前は3文字。とうぜん AAA",
    price: 700,
    series: "retro",
    zone: "wall",
    size: 8,
    sprite: [
      "kkkkkkkkkk..",
      "kbbbbbbbbk..",
      "kbyyybyybk..",
      "kbbbbbbbbk..",
      "kbwwbwbwbk..",
      "kbbbbbbbbk..",
      "kbwbwwbwbk..",
      "kbbbbbbbbk..",
      "kbrrbrbrbk..",
      "kbbbbbbbbk..",
      "kkkkkkkkkk..",
      "............",
    ],
  },
  {
    id: "crane",
    name: "クレーンゲームき",
    desc: "アームのちからは、きぶん次第",
    price: 2200,
    series: "retro",
    zone: "floor",
    size: 10,
    petSpot: { kind: "watch", line: "ガラスごしに けいひんを ねらっている" },
    sprite: [
      ".kkkkkkkkk..",
      ".krrrrrrrk..",
      ".ksssmsssk..",
      ".ksssmsssk..",
      ".kssskkssk..",
      ".kspgsoswk..",
      ".kkkkkkkkk..",
      ".krrrkkrrk..",
      ".krrrrrrrk..",
      ".kkkkkkkkk..",
      "............",
      "............",
    ],
  },
  // =========================================================================
  // わしつのやすらぎ（週替わり）
  // =========================================================================
  {
    id: "kotatsu",
    name: "こたつ",
    desc: "入ったら最後、リリースまで出られない",
    price: 2000,
    series: "washitsu",
    zone: "floor",
    size: 13,
    petSpot: { kind: "sleep", line: "こたつで ぬくぬく おひるね中" },
    sprite: [
      "............",
      "............",
      "..kkkkkkkk..",
      ".knnnnnnnnk.",
      "kkkkkkkkkkkk",
      "krrrrrrrrrrk",
      "krorrorrorrk",
      "krrrrrrrrrrk",
      ".kkkkkkkkkk.",
      "............",
      "............",
      "............",
    ],
  },
  {
    id: "zabuton",
    name: "ざぶとん",
    desc: "一枚うえのくつろぎ。おおぎりにも使える",
    price: 500,
    series: "washitsu",
    zone: "floor",
    size: 7,
    flat: true,
    petSpot: { kind: "sit", line: "ざぶとんのうえで ちょこん" },
    sprite: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "...kkkkkk...",
      "..krrrrrrk..",
      ".kroroorork.",
      ".krrrrrrrrk.",
      "..kkkkkkkk..",
      "............",
    ],
  },
  {
    id: "bonsai",
    name: "ぼんさい",
    desc: "枝ぶりを整える時間は、心のリファクタリング",
    price: 1100,
    series: "washitsu",
    zone: "shelf",
    size: 6,
    sprite: [
      "............",
      "....gg.gg...",
      "..gggggggg..",
      ".ggtgggtggg.",
      "..gggggg....",
      "....kgk.....",
      "...kkgkk....",
      "..knnnnnk...",
      "..knnnnnk...",
      "...kkkkk....",
      "............",
      "............",
    ],
  },
  {
    id: "kakejiku",
    name: "かけじく",
    desc: "『一期一会』。読めないけど ありがたい",
    price: 800,
    series: "washitsu",
    zone: "wall",
    size: 6,
    sprite: [
      "....kkkk....",
      "...knnnnk...",
      "...keeeek...",
      "...kekeek...",
      "...keeeek...",
      "...keekek...",
      "...keeeek...",
      "...kekeek...",
      "...keeeek...",
      "...knnnnk...",
      "....kkkk....",
      "............",
    ],
  },
  {
    id: "chabudai",
    name: "ちゃぶだい",
    desc: "みかんを置くと完成する円卓",
    price: 1300,
    series: "washitsu",
    zone: "floor",
    size: 11,
    petSpot: { kind: "front", line: "ちゃぶだいで おちゃの時間" },
    sprite: [
      "............",
      "............",
      "............",
      "............",
      "..kkkkkkkk..",
      ".knnnnnnnnk.",
      ".knnoonnwnk.",
      ".kkkkkkkkkk.",
      "..kd....dk..",
      "..kd....dk..",
      "............",
      "............",
    ],
  },
  // =========================================================================
  // みどりのオアシス（週替わり）
  // =========================================================================
  {
    id: "hammock",
    name: "ハンモック",
    desc: "ゆれるたび、締め切りが遠くなる",
    price: 1600,
    series: "midori",
    zone: "floor",
    size: 14,
    petSpot: { kind: "sleep", line: "ハンモックで ゆらゆら おひるね中" },
    sprite: [
      "............",
      "............",
      ".kk......kk.",
      ".knk....knk.",
      ".knw....wnk.",
      ".kn.w..w.nk.",
      ".kn..ww..nk.",
      ".knk....knk.",
      ".kkk....kkk.",
      ".kk......kk.",
      "............",
      "............",
    ],
  },
  {
    id: "bigplant",
    name: "おおきなパキラ",
    desc: "育てているのか、育てられているのか",
    price: 1400,
    series: "midori",
    zone: "floor",
    size: 9,
    sprite: [
      "....gg.gg...",
      "..gggggggg..",
      ".gggtgggtgg.",
      ".gggggggggg.",
      "..gggggggg..",
      "....kgk.....",
      "....kgk.....",
      "...kkkkk....",
      "..knnnnnk...",
      "..knnnnnk...",
      "...kkkkk....",
      "............",
    ],
  },
  {
    id: "birdclock",
    name: "ことりのはとどけい",
    desc: "定時になると鳴く。定時に帰れるとは言っていない",
    price: 900,
    series: "midori",
    zone: "wall",
    size: 6,
    petSpot: { kind: "watch", line: "はとが出てくるのを 下で まちかまえている" },
    sprite: [
      "....kkkk....",
      "...knnnnk...",
      "..knneennk..",
      "..knewwenk..",
      "..knewkenk..",
      "..knneennk..",
      "...knnnnk...",
      "....kook....",
      "....knnk....",
      ".....kk.....",
      "............",
      "............",
    ],
  },
  {
    id: "flowervase",
    name: "はなびん",
    desc: "花のいのちは短い。だからこそ毎週かえる",
    price: 600,
    series: "midori",
    zone: "shelf",
    size: 5,
    sprite: [
      "............",
      "....p.o.....",
      "...ppooro...",
      "....p.o.....",
      "....gg......",
      "....gg......",
      "...kssk.....",
      "...kssk.....",
      "..kssssk....",
      "..kssssk....",
      "...kkkk.....",
      "............",
    ],
  },
  {
    id: "terrarium",
    name: "テラリウム",
    desc: "ビンのなかの、ちいさなちいさな森",
    price: 1200,
    series: "midori",
    zone: "shelf",
    size: 6,
    petSpot: { kind: "watch", line: "ビンのなかの森を のぞきこんでいる" },
    sprite: [
      "............",
      "............",
      "...kkkkkk...",
      "..kssssssk..",
      "..kssgsssk..",
      "..ksgggssk..",
      "..ksggggsk..",
      "..kgtgtggk..",
      "..knnnnnnk..",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
  },
];

export const shopItemById = (id: string): ShopItem | undefined =>
  SHOP_ITEMS.find((i) => i.id === id);

export const seriesById = (id: string): ShopSeries | undefined =>
  SHOP_SERIES.find((s) => s.id === id);

export const seriesItems = (seriesId: string): ShopItem[] =>
  SHOP_ITEMS.filter((i) => i.series === seriesId);

/** そのシリーズをコンプリートしているか */
export function seriesComplete(ownedIds: ReadonlySet<string>, seriesId: string): boolean {
  const items = seriesItems(seriesId);
  return items.length > 0 && items.every((i) => ownedIds.has(i.id));
}

// ---------------------------------------------------------------------------
// 週替わり入荷（乱数不使用・決定的。げんば/デスク来訪と同じハッシュ方針）
// ---------------------------------------------------------------------------

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 月曜はじまりの週番号（エポック起点）。dateISO="YYYY-MM-DD" */
export function weekKey(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return Math.floor((days + 3) / 7); // 1970-01-01(木) を +3 して月曜区切りに
}

/** 今週入荷している週替わり商品の数 */
export const WEEKLY_STOCK_COUNT = 5;

/** きょう買える商品IDの集合。定番シリーズは常時、rotating はハッシュ順の上位5種。 */
export function weeklyStock(dateISO: string): Set<string> {
  const wk = weekKey(dateISO);
  const rotating = SHOP_ITEMS.filter(
    (i) => seriesById(i.series)?.rotating
  ).sort(
    (a, b) => hashStr(`${wk}:${a.id}`) - hashStr(`${wk}:${b.id}`)
  );
  const ids = new Set(
    SHOP_ITEMS.filter((i) => !seriesById(i.series)?.rotating).map((i) => i.id)
  );
  for (const i of rotating.slice(0, WEEKLY_STOCK_COUNT)) ids.add(i.id);
  return ids;
}
