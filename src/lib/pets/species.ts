// ペット種族マスタ（Issue #2）。ダンジョンcontent.tsと同方式のTSマスタ（追加=1件足すだけ）。
//
// 【スプライトの思想】sprites はただの「PNGファイルパスの宣言」。出どころは問わない:
//  - コード生成（LOADING宇宙人の流用 = /aliens/…）
//  - 開発者が手で描いて支給するPNG（/pets/<id>/… に置く）… 人間の生のテイストを
//    サイトに入れる正規ルート。支給契約は public/pets/README.md を参照。
// どちらも同じ描画・アニメ機構（CSS steps）に載る。happy が無ければ normal で代用される。
//
// 【会話】性格タイプ（4種）ごとの定型ツリーが基本（トークンゼロ）。
// ANTHROPIC_API_KEY があれば自由会話モードも解放され、aiPersona が人格になる。

export type PersonalityId = "friendly" | "tsun" | "shy" | "pace";

export type PetSpecies = {
  id: string;
  name: string; // 種族名（ペットの初期名）
  personality: PersonalityId;
  weight: number; // 出現抽選の重み
  sprites: {
    normal: string; // 必須
    happy?: string; // 任意（にっこり差分。無ければnormal）
    sleep?: string; // 任意（昼寝差分）
  };
  intro: string; // 出会いの第一声（種族の個性）
  aiPersona: string; // AI自由会話モードの人格設定（1-2文）
  retired?: boolean;
};

// 開発者支給の手描きPNG（駄菓子・おばけ・レトロゲームの来訪者たち）。
// happy は normal から scripts/gen-expressions.py で生成（目を細め口角を上げる差分）。
// sleep 差分は未整備なので normal で代用される。
const pet = (id: string) => ({
  normal: `/pets/${id}/normal.png`,
  happy: `/pets/${id}/happy.png`,
});

export const PET_SPECIES: PetSpecies[] = [
  {
    id: "kakure-kiwi",
    name: "カクレキーウィ",
    personality: "shy",
    weight: 6,
    sprites: pet("kakure-kiwi"),
    intro: "……（葉っぱのかげから、じっとこっちを見ている）",
    aiPersona: "鉢巻きをした隠れ里のキーウィ。忍びのように物陰から人を観察している。口数は少ないが義理堅い。",
  },
  {
    id: "omusubi-ghost",
    name: "おむすびゴースト",
    personality: "friendly",
    weight: 8,
    sprites: pet("omusubi-ghost"),
    intro: "おなか、すいてない？ぼく、ここにいるよ。",
    aiPersona: "おむすびの姿をしたやさしいゴースト。誰かの空腹と疲れを心配してばかりいる。",
  },
  {
    id: "nama-mimic",
    name: "ナマミミック",
    personality: "tsun",
    weight: 5,
    sprites: pet("nama-mimic"),
    intro: "……宝箱じゃないぞ。ジョッキだ。まちがえるな。",
    aiPersona: "生ビールジョッキに化けたミミック。宝箱と間違われるのが不服。強がりだが飲みの誘いには弱い。",
  },
  {
    id: "choco-slime",
    name: "チョコスライム",
    personality: "pace",
    weight: 8,
    sprites: pet("choco-slime"),
    intro: "とけそう……でも、まだ とけない。だいじょうぶ。",
    aiPersona: "チョコレートのスライム。暑さに弱くていつも溶けかけているが、本人はいたってのんき。",
  },
  {
    id: "melon-hyozaurus",
    name: "メロンヒョーザウルス",
    personality: "friendly",
    weight: 6,
    sprites: pet("melon-hyozaurus"),
    intro: "しゃりしゃり〜！つめたいの、いる？",
    aiPersona: "メロンかき氷の恐竜。夏の縁日が大好きで、暑い日ほど元気になる。冷たいものを分けたがる。",
  },
  {
    id: "lemon-mc",
    name: "レモンMC",
    personality: "friendly",
    weight: 6,
    sprites: pet("lemon-mc"),
    intro: "Yo！きみのがんばり、韻を踏んで讃えにきたぜ！",
    aiPersona: "レモン味のラッパー。何でも韻を踏んで褒めてくる陽気なMC。テンションが高い。",
  },
  {
    id: "umai-ninbou",
    name: "うまい忍棒",
    personality: "shy",
    weight: 6,
    sprites: pet("umai-ninbou"),
    intro: "……気配を消していたのに、気づかれてしまった。",
    aiPersona: "覆面をしたスナック菓子の忍者。気配を消すのが得意だが、いつも誰かに見つかってしまう。",
  },
  {
    id: "taro-gaeru",
    name: "タローガエル",
    personality: "tsun",
    weight: 6,
    sprites: pet("taro-gaeru"),
    intro: "べ、べつに遊びに来たんじゃないケロ。散歩の途中だケロ。",
    aiPersona: "駄菓子屋の帽子をかぶったカエル。素直じゃないが面倒見がいい。語尾にケロ。",
  },
  {
    id: "yurei-boy",
    name: "ユーレイボーイ",
    personality: "shy",
    weight: 5,
    sprites: pet("yurei-boy"),
    intro: "……ぼくのこと、見える？ほんとに？",
    aiPersona: "レトロな携帯ゲーム機の姿をした幽霊。存在に気づいてもらえると照れる。さみしがり。",
  },
  {
    id: "sushinchu-slime",
    name: "スーシンチュウスライム",
    personality: "pace",
    weight: 6,
    sprites: pet("sushinchu-slime"),
    intro: "ぷるん。……ぼく、あんまり動かないタイプ。",
    aiPersona: "駄菓子のスライム。動くのが苦手でいつもその場にいる。休むことの大切さを説く。",
  },
  {
    id: "dagashi-mimic",
    name: "ダガシミック",
    personality: "tsun",
    weight: 5,
    sprites: pet("dagashi-mimic"),
    intro: "この箱の中身？……教えるわけないだろ。",
    aiPersona: "駄菓子箱に化けたミミック。中身を秘密にしたがるが、気に入った相手にはこっそり分けてくれる。",
  },
  {
    id: "game-kerotch",
    name: "ゲーム&ケロッチ",
    personality: "pace",
    weight: 6,
    sprites: pet("game-kerotch"),
    intro: "ピコピコ……あ、ハイスコア更新した。きみもやる？",
    aiPersona: "携帯ゲーム機型のカエル。いつも何かのスコアを更新している。ゲームの話になると早口。",
  },
  {
    id: "limes-musubi",
    name: "ライムスむすび",
    personality: "friendly",
    weight: 6,
    sprites: pet("limes-musubi"),
    intro: "ライム、キメていくかい？おむすびだけに。",
    aiPersona: "ライム味のおむすびラッパー。ダジャレとライム（韻）をかけて話す陽気なやつ。",
  },
  {
    id: "furuhon-ghost",
    name: "フルホンゴースト",
    personality: "shy",
    weight: 5,
    sprites: pet("furuhon-ghost"),
    intro: "……この本、まだ読まれてないんだ。ずっと。",
    aiPersona: "古本に宿ったゴースト。積読の悲しみを知っている。技術書の話をすると少し嬉しそうにする。",
  },
  {
    id: "kero-jockey",
    name: "ケロジョッキ",
    personality: "friendly",
    weight: 6,
    sprites: pet("kero-jockey"),
    intro: "おつかれ！とりあえず一杯、いっとく？",
    aiPersona: "ジョッキから顔を出すカエル。仕事終わりの労いが上手。乾杯が好き。",
  },
  {
    id: "sour-obake",
    name: "サワーおばけ",
    personality: "tsun",
    weight: 5,
    sprites: pet("sour-obake"),
    intro: "すっぱい顔してるって？……きみもだよ、疲れてるとき。",
    aiPersona: "酸っぱい駄菓子のおばけ。毒舌だが相手の疲れをよく見抜いている。ツンとした物言い。",
  },
  {
    id: "choco-boy",
    name: "チョコボーイ",
    personality: "shy",
    weight: 5,
    sprites: pet("choco-boy"),
    intro: "……画面ごしなら、ちょっとだけ話せる。",
    aiPersona: "チョコ色の携帯ゲーム機の少年。直接話すのは苦手だが、画面越しだと饒舌になる。",
  },
  {
    id: "kiwi-slime",
    name: "キウイスライム",
    personality: "pace",
    weight: 6,
    sprites: pet("kiwi-slime"),
    intro: "たねが いっぱいでしょ。ぜんぶ、ぼくの ともだち。",
    aiPersona: "キウイのスライム。種を友達だと思っている不思議なやつ。話がゆっくりで和む。",
  },
  {
    id: "bluehawaii-ghost",
    name: "ブルーハワイゴースト",
    personality: "friendly",
    weight: 6,
    sprites: pet("bluehawaii-ghost"),
    intro: "しゅわしゅわ〜！夏の匂いがする方に来ちゃった！",
    aiPersona: "ブルーハワイ味のかき氷ゴースト。お祭りと夏が大好きで、いつも浮かれている。",
  },
  {
    id: "moja-mc",
    name: "モジャMC",
    personality: "tsun",
    weight: 5,
    sprites: pet("moja-mc"),
    intro: "オレのリリックは辛口だ。覚悟しろよ。",
    aiPersona: "赤くて辛そうなラッパー。辛口の批評をするが、根は相手の成長を願っている。",
  },
];

export function speciesById(id: string | null | undefined): PetSpecies | null {
  return PET_SPECIES.find((s) => s.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// 定型会話ツリー（性格別・2ターン）。choice.bond が判定ボーナスに積まれる。
// ---------------------------------------------------------------------------

export type TalkNode = {
  lines: string[]; // {name} が種族名に置換される
  choices: [TalkChoice, TalkChoice];
};
export type TalkChoice = {
  label: string;
  bond: number; // 好感度ボーナス（0〜0.15目安）
  reply: string; // 選んだ直後のひとこと
  next?: "second"; // 省略=判定へ
};

export const TALK_TREES: Record<PersonalityId, { first: TalkNode; second: TalkNode }> = {
  friendly: {
    first: {
      lines: ["ねえねえ、きみのこと見てたんだ。", "まいにちコツコツ…えらいねえ。"],
      choices: [
        { label: "ありがとう、きみは？", bond: 0.15, reply: "ぼくのこと聞いてくれるの！？うれしい！", next: "second" },
        { label: "まあ、ぼちぼちね", bond: 0.05, reply: "その力の抜けかた、いいね〜。", next: "second" },
      ],
    },
    second: {
      lines: ["ここ、あったかい場所だね。", "…ぼくも、ここにいていいのかな？"],
      choices: [
        { label: "うちにおいでよ", bond: 0.15, reply: "！！ いいの！？" },
        { label: "気が向いたらまたおいで", bond: 0.05, reply: "ふふ、じゃあ気が向いちゃおうかな。" },
      ],
    },
  },
  tsun: {
    first: {
      lines: ["べ、べつにきみに用があるわけじゃない。", "たまたま通りかかっただけ。"],
      choices: [
        { label: "そっか、ゆっくりしてって", bond: 0.15, reply: "…っ。き、気が利くじゃない。", next: "second" },
        { label: "用がないなら帰る？", bond: 0.0, reply: "なっ…！ま、まだいるし！", next: "second" },
      ],
    },
    second: {
      lines: ["…きみの週報、ちょっとだけ見た。", "…がんばってるのは、認めてあげる。"],
      choices: [
        { label: "きみも一緒にがんばる？", bond: 0.15, reply: "し、しかたないなあ！" },
        { label: "ありがとう", bond: 0.1, reply: "べつに褒めてないし。…ちょっとしか。" },
      ],
    },
  },
  shy: {
    first: {
      lines: ["…………。", "（何か言いたそうにこちらを見ている）"],
      choices: [
        { label: "（静かに隣に座る）", bond: 0.15, reply: "……となり、いいの？", next: "second" },
        { label: "こんにちは！", bond: 0.05, reply: "ひゃっ…！こ、こんにちは……。", next: "second" },
      ],
    },
    second: {
      lines: ["……ここは、しずかで、いいね。", "……ぼく、うるさいの、にがてで。"],
      choices: [
        { label: "ここは急かさないよ", bond: 0.15, reply: "……うん。しってた。だから来たんだ。" },
        { label: "にぎやかな日もあるけどね", bond: 0.05, reply: "……それも、ちょっとだけ、みてみたい。" },
      ],
    },
  },
  pace: {
    first: {
      lines: ["ふわ〜…。", "ここ、ひなたぼっこに良さそうだねえ。"],
      choices: [
        { label: "いい場所あるよ", bond: 0.15, reply: "おっ、話がわかるねえ。", next: "second" },
        { label: "仕事の邪魔はしないでね", bond: 0.05, reply: "だいじょうぶ、ぼくは景色だから。", next: "second" },
      ],
    },
    second: {
      lines: ["きみ、休むのへたそうだね。", "ぼくがいたら、休むの上手になるよ。たぶん。"],
      choices: [
        { label: "それ、たすかるかも", bond: 0.15, reply: "でしょ〜。ぼく、休むプロだから。" },
        { label: "休んでばかりじゃ困るよ", bond: 0.05, reply: "きみは働くプロ、ぼくは休むプロ。ちょうどいいね。" },
      ],
    },
  },
};
