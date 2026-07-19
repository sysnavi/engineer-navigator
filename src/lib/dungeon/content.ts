// ダンジョンのコンテンツマスタ（Issue #3）。
//
// 【拡充のしかた】この配列に1件足すだけ。DBマイグレーション不要（DBはID文字列参照）。
// スプライトを足す場合は scripts/gen-dungeon.py に文字マップを足して再実行する。
// 【注意】公開済みIDの変更・削除は所持データ（OwnedGadget.gadgetId等）を壊すので不可。
// 引退させたいコンテンツは retired: true を付けて抽選から外す（表示は残る）。

export type Rarity = "N" | "R" | "SR" | "SSR" | "UR";

export type Monster = {
  id: string;
  name: string;
  sprite: string; // public/dungeon/<sprite>.png
  minDepth: number;
  weight: number; // 抽選の重み
  boss?: boolean;
  encounter: string; // 遭遇時の一文（{name}=アバター名）
  win: string; // 突破時
  lose: string; // 失敗時
  retired?: boolean;
};

export type Gadget = {
  id: string;
  name: string;
  rarity: Rarity;
  category: GadgetCategory;
  flavor: string; // ギーク度が命
  minGeneration?: number; // UR用: 継承世代限定（周回が最強への道）
  retired?: boolean;
};

export type Trap = {
  id: string;
  name: string;
  hit: string; // 引っかかった時
  avoid: string; // 回避時
  retired?: boolean;
};

export type Rest = {
  id: string;
  name: string;
  text: string;
  // effect: buff=次のENCOUNTER成功率UP / deepen=そのまま1階深く進める（求道の祠など）
  effect: "buff" | "deepen";
  retired?: boolean;
};

// ガジェットカテゴリ（棚のアイコンは public/dungeon/cat-<id>.png）
export const GADGET_CATEGORIES = {
  kb: "キーボード",
  pt: "ポインティング",
  dp: "ディスプレイ",
  dk: "デスク・チェア",
  au: "オーディオ",
  pc: "PC・サーバ",
  tl: "工具・周辺",
  rt: "レトロ",
} as const;
export type GadgetCategory = keyof typeof GADGET_CATEGORIES;

export const RARITY_LABELS: Record<Rarity, { label: string; color: string }> = {
  N: { label: "N", color: "var(--ink-soft)" },
  R: { label: "R", color: "var(--sky8)" },
  SR: { label: "SR", color: "var(--royal-2)" },
  SSR: { label: "SSR", color: "var(--warn)" },
  UR: { label: "UR", color: "var(--pink-hot)" },
};

// レア度の解禁深度（この階以降の宝箱で出る）
export const RARITY_MIN_DEPTH: Record<Rarity, number> = {
  N: 1,
  R: 3,
  SR: 6,
  SSR: 10,
  UR: 8, // かつ継承世代（gadget.minGeneration）を満たすこと
};

// ---------------------------------------------------------------------------
// モンスター（12 + ボス2）
// ---------------------------------------------------------------------------

export const MONSTERS: Monster[] = [
  {
    id: "minibug",
    name: "ミニバグ",
    sprite: "mon-minibug",
    minDepth: 1,
    weight: 10,
    encounter: "小さなバグが飛び出してきた！",
    win: "ワンライナーで退治した。+1階",
    lose: "再現手順が分からず見失った…",
  },
  {
    id: "typo",
    name: "タイポの小人",
    sprite: "mon-typo",
    minDepth: 1,
    weight: 10,
    encounter: "タイポの小人が足元にセミコロンを撒いた！",
    win: "リンターの光で照らして追い払った。+1階",
    lose: "1文字違いに転ばされた…",
  },
  {
    id: "offbyone",
    name: "オフバイワン鳥",
    sprite: "mon-offbyone",
    minDepth: 1,
    weight: 8,
    encounter: "オフバイワン鳥が1歩ずれて飛んでいる！",
    win: "境界値を見切って捕まえた。+1階",
    lose: "最後の1羽が数えられなかった…",
  },
  {
    id: "mojibake",
    name: "文字化けオバケ",
    sprite: "mon-mojibake",
    minDepth: 2,
    weight: 8,
    encounter: "「縺ゅ→縺ｧ」と鳴く影が現れた！",
    win: "UTF-8の御札で祓った。+1階",
    lose: "何を言っているのか分からない…",
  },
  {
    id: "infloop",
    name: "無限ループヘビ",
    sprite: "mon-infloop",
    minDepth: 2,
    weight: 8,
    encounter: "自分の尻尾を追うヘビが道を塞いでいる！",
    win: "break文を投げて断ち切った。+1階",
    lose: "一緒にぐるぐる回ってしまった…",
  },
  {
    id: "nullpo",
    name: "ヌルポ",
    sprite: "mon-nullpo",
    minDepth: 4,
    weight: 8,
    encounter: "実体のない何かがそこに「無い」！",
    win: "Optionalの網で包んで捕獲した。+1階",
    lose: "攻撃が参照エラーで空を切った…",
  },
  {
    id: "memleak",
    name: "メモリリークスライム",
    sprite: "mon-memleak",
    minDepth: 4,
    weight: 8,
    encounter: "スライムがじわじわ膨らみ続けている！",
    win: "解放の呪文でしぼませた。+1階",
    lose: "気づけば通路いっぱいに育っていた…",
  },
  {
    id: "deadlock",
    name: "デッドロックガニ",
    sprite: "mon-deadlock",
    minDepth: 5,
    weight: 7,
    encounter: "2匹のカニが互いを挟んで動けなくなっている！",
    win: "片方に先を譲らせて通り抜けた。+1階",
    lose: "巻き込まれて三すくみになった…",
  },
  {
    id: "cacheghost",
    name: "キャッシュゴースト",
    sprite: "mon-cacheghost",
    minDepth: 5,
    weight: 7,
    encounter: "倒したはずの敵の残像が立ちはだかる！",
    win: "スーパーリロードで消し飛ばした。+1階",
    lose: "何度消しても表示され続ける…",
  },
  {
    id: "flaky",
    name: "フレーキーコウモリ",
    sprite: "mon-flaky",
    minDepth: 6,
    weight: 7,
    encounter: "たまにしか当たらない攻撃をするコウモリだ！",
    win: "3回リトライして見事命中。+1階",
    lose: "こちらの攻撃も、たまにしか当たらない…",
  },
  {
    id: "specchange",
    name: "仕様変更カメレオン",
    sprite: "mon-specchange",
    minDepth: 7,
    weight: 6,
    encounter: "戦っている最中に姿が変わっていく！",
    win: "要件を書面で固定して撃破。+1階",
    lose: "「やっぱりこっちで」と言われた気がした…",
  },
  {
    id: "debtgolem",
    name: "技術的負債ゴーレム",
    sprite: "mon-debtgolem",
    minDepth: 9,
    weight: 6,
    encounter: "放置された年月のぶんだけ硬いゴーレムが現れた！",
    win: "小さなリファクタを積み重ねて崩した。+1階",
    lose: "「あとでやる」の重みに押し返された…",
  },
  // --- ボス（深層のみ・突破で+2階&SSR確定） ---
  {
    id: "legacydragon",
    name: "レガシーコードドラゴン",
    sprite: "mon-legacydragon",
    minDepth: 10,
    weight: 10,
    boss: true,
    encounter: "誰も全容を知らない巨竜が目を覚ました！",
    win: "テストで外堀を埋め、ついに打ち倒した！+2階",
    lose: "触れた瞬間、別の場所が壊れた…",
  },
  {
    id: "prodhydra",
    name: "本番障害ヒュドラ",
    sprite: "mon-prodhydra",
    minDepth: 12,
    weight: 8,
    boss: true,
    encounter: "首を1本直すと2本生える怪物が咆哮した！",
    win: "根本原因の心臓を貫いた！+2階",
    lose: "対症療法では首は減らなかった…",
  },
];

// ---------------------------------------------------------------------------
// ガジェット（N8 / R8 / SR8 / SSR5 / UR2 = 31種）
// ---------------------------------------------------------------------------

export const GADGETS: Gadget[] = [
  // --- N ---
  { id: "cha-kb", name: "茶軸キーボード", rarity: "N", category: "kb", flavor: "全てはここから始まる。カチャカチャ。" },
  { id: "ergo-mouse", name: "エルゴマウス", rarity: "N", category: "pt", flavor: "手首の角度、人生の角度。" },
  { id: "wrist-rest", name: "リストレスト", rarity: "N", category: "dk", flavor: "手首を置く。ただそれだけの幸福。" },
  { id: "desk-mat", name: "デスクマット", rarity: "N", category: "dk", flavor: "机の上の専用領地。" },
  { id: "monitor-arm", name: "モニターアーム", rarity: "N", category: "dp", flavor: "画面が宙に浮くと、心も浮く。" },
  { id: "nc-headphone", name: "ノイキャンヘッドホン", rarity: "N", category: "au", flavor: "世界を消すスイッチ。" },
  { id: "cable-tray", name: "ケーブルトレー", rarity: "N", category: "tl", flavor: "見えない配線は、存在しない配線。" },
  { id: "succulent", name: "多肉植物", rarity: "N", category: "dk", flavor: "デスクで唯一、水だけで動く。" },
  // --- R ---
  { id: "split-kb", name: "分割キーボード", rarity: "R", category: "kb", flavor: "肩は開いた。心も開いた。" },
  { id: "trackball", name: "トラックボール", rarity: "R", category: "pt", flavor: "親指だけが世界を回す。" },
  { id: "tate-monitor", name: "縦置きモニタ", rarity: "R", category: "dp", flavor: "コードは縦に流れるものだから。" },
  { id: "ultrawide", name: "ウルトラワイドモニタ", rarity: "R", category: "dp", flavor: "視界の端から端まで、全部作業領域。" },
  { id: "elec-desk", name: "昇降デスク", rarity: "R", category: "dk", flavor: "立つか座るか、それが問題だ。" },
  { id: "balance-ball", name: "バランスボール", rarity: "R", category: "dk", flavor: "座りながら鍛える、という発明。" },
  { id: "condenser-mic", name: "コンデンサーマイク", rarity: "R", category: "au", flavor: "会議の声だけ、無駄にいい。" },
  { id: "arcade-stick", name: "アケコン", rarity: "R", category: "tl", flavor: "昇竜拳は打てる。仕事には使えない。" },
  // --- SR ---
  { id: "jisaku-kb-kit", name: "自作キーボードキット", rarity: "SR", category: "kb", flavor: "はんだ付けはまだ。夢は膨らむ。" },
  { id: "capacitive-board", name: "静電容量無接点の板", rarity: "SR", category: "kb", flavor: "打鍵は無音、所有欲は雄弁。" },
  { id: "forty-kb", name: "40%キーボード", rarity: "SR", category: "kb", flavor: "数字キーは甘え。" },
  { id: "kvm", name: "KVMスイッチ", rarity: "SR", category: "tl", flavor: "2台のPCを1つの手で統べる。" },
  { id: "ups", name: "UPS", rarity: "SR", category: "pc", flavor: "停電？知らない子ですね。" },
  { id: "printer3d", name: "3Dプリンタ", rarity: "SR", category: "tl", flavor: "作れるのは、だいたいプリンタの部品。" },
  { id: "solder-station", name: "はんだごてステーション", rarity: "SR", category: "tl", flavor: "煙とともに完成する何か。" },
  { id: "raspi-cluster", name: "ラズパイクラスタ", rarity: "SR", category: "pc", flavor: "手のひらサイズのデータセンター。" },
  // --- SSR（深層限定） ---
  { id: "crt", name: "ブラウン管モニタ", rarity: "SSR", category: "rt", flavor: "走査線の温もり。" },
  { id: "retro-pc", name: "いにしえの名機", rarity: "SSR", category: "rt", flavor: "起動音だけで泣ける。" },
  { id: "rack-server", name: "ラックサーバ", rarity: "SSR", category: "pc", flavor: "リビングを1U占有。家族の理解は2U必要。" },
  { id: "punch-card", name: "パンチカード", rarity: "SSR", category: "rt", flavor: "先史時代のソースコード。" },
  { id: "acoustic-coupler", name: "音響カプラ", rarity: "SSR", category: "rt", flavor: "受話器を、置くのだ。" },
  // --- UR（継承世代限定・周回の証） ---
  { id: "golden-solder", name: "金のはんだごて", rarity: "UR", category: "tl", minGeneration: 2, flavor: "二周目の人生でしか握れない熱がある。" },
  { id: "legend-enter", name: "伝説のEnterキー", rarity: "UR", category: "kb", minGeneration: 2, flavor: "ひと押しで肩こりが治るという。押す機会は、まだない。" },
];

// ---------------------------------------------------------------------------
// 罠（8）
// ---------------------------------------------------------------------------

export const TRAPS: Trap[] = [
  { id: "pitfall", name: "落とし穴", hit: "古典的な落とし穴に落ちた！1階戻る…", avoid: "床の色がおかしい。ジャンプで回避した！" },
  { id: "nm-swamp", name: "node_modulesの沼", hit: "依存の沼に足を取られた！ずぶずぶと1階沈む…", avoid: "lockファイルの飛び石を渡って突破！" },
  { id: "meeting", name: "会議招集の罠", hit: "「ちょっといい？」の声に捕まり、気づけば1階戻されていた…", avoid: "「後ほど資料で！」と言い切って走り抜けた！" },
  { id: "noti-dart", name: "通知の吹き矢", hit: "ピコン！ピコン！集中力が削られて1階後退…", avoid: "おやすみモードの盾で全て弾いた！" },
  { id: "update-rock", name: "強制アップデートの岩", hit: "巨大な更新が転がってきた！再起動で1階戻る…", avoid: "「あとで再起動」を選んで転がる岩をやり過ごした！" },
  { id: "wifi-dead", name: "Wi-Fi切断ゾーン", hit: "圏外の霧で足止め。手探りで1階戻ってしまった…", avoid: "オフラインでも動く装備で悠々と通過！" },
  { id: "moji-fog", name: "文字コードの霧", hit: "???????に包まれて道を見失い、1階後退…", avoid: "BOMの灯りで霧を晴らした！" },
  { id: "scroll-sand", name: "無限スクロール流砂", hit: "「次のページ」に飲まれて1階流された…", avoid: "「今日はここまで」と唱えて岸に上がった！" },
];

// ---------------------------------------------------------------------------
// 癒やし・出会い（6）
// ---------------------------------------------------------------------------

export const RESTS: Rest[] = [
  { id: "coffee", name: "コーヒーの泉", text: "香ばしい湯気。一杯飲んで目が冴えた。（次の戦いに強くなった）", effect: "buff" },
  { id: "duck", name: "ラバーダックの祠", text: "アヒルに悩みを話したら、答えが自分の口から出てきた。道が開けた！+1階", effect: "deepen" },
  { id: "ancient-doc", name: "先人のドキュメント", text: "更新日は古いが、内容は今も正しい。先人に感謝。（次の戦いに強くなった）", effect: "buff" },
  { id: "cat", name: "ダンジョン猫", text: "猫がいた。撫でた。それ以上のことは何も起きなかったが、満足だ。", effect: "buff" },
  { id: "hermit", name: "フルスタックの隠者", text: "「深く潜るコツは、深く休むことじゃ」隠者は近道を教えてくれた。+1階", effect: "deepen" },
  { id: "nap-pod", name: "昼寝ポッド", text: "15分の仮眠。目覚めた身体が軽い。（次の戦いに強くなった）", effect: "buff" },
];

// ---------------------------------------------------------------------------
// 遺伝子の得意分野（優性遺伝子で適用・転生の血統選びに戦略を）
// ---------------------------------------------------------------------------

export const GENE_DUNGEON_MODS: Record<
  string,
  { encounterBonus?: number; trapAvoidBonus?: number; treasureWeightMul?: number; restDeepenBonus?: number; label: string }
> = {
  tsuzuki: { trapAvoidBonus: 0.25, label: "罠を見抜きやすい" },
  chie: { encounterBonus: 0.15, label: "モンスターに強い" },
  souzou: { treasureWeightMul: 1.6, label: "宝箱を見つけやすい" },
  chousen: { encounterBonus: 0.15, label: "モンスターに強い" },
  kyudo: { restDeepenBonus: 0.35, label: "休憩で道が開けやすい" },
  kouryu: { restDeepenBonus: 0.2, trapAvoidBonus: 0.1, label: "出会いに恵まれる" },
};

// イベント種別の抽選重み（TREASUREは創造遺伝子で倍率がかかる）
export const EVENT_WEIGHTS = {
  ENCOUNTER: 35,
  TREASURE: 25,
  TRAP: 20,
  REST: 20,
} as const;

// 宝箱がミミック（キャッシュの幻影）である確率
export const MIMIC_RATE = 0.15;
// ボス出現: 最終イベント時点で depth >= 10 のとき
export const BOSS_DEPTH = 10;
export const BOSS_RATE = 0.5;
