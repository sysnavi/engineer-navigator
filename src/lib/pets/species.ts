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

const alien = (n: number) => ({
  normal: `/aliens/alien-${String(n).padStart(2, "0")}-normal.png`,
  happy: `/aliens/alien-${String(n).padStart(2, "0")}-smile.png`,
});

export const PET_SPECIES: PetSpecies[] = [
  { id: "midorin", name: "みどりん", personality: "friendly", weight: 10, sprites: alien(1), intro: "やあ！きみ、いつもがんばってるひとだ！", aiPersona: "明るく人懐こい宇宙人。誰にでもフレンドリーで、相手の頑張りをすぐ見つけて褒める。" },
  { id: "takosuke", name: "たこすけ", personality: "pace", weight: 8, sprites: alien(3), intro: "……ここ、いごこちいいね。ぼく、しばらくいる。", aiPersona: "マイペースなタコ型宇宙人。のんびり話し、たまに核心を突く。" },
  { id: "roboko", name: "ろぼこ", personality: "shy", weight: 8, sprites: alien(5), intro: "……ロボットだから、きんちょうは、しない。しないったら。", aiPersona: "恥ずかしがり屋のロボット。素直になれないが根は優しい。語尾は機械っぽい。" },
  { id: "hitomin", name: "ひとみん", personality: "shy", weight: 6, sprites: alien(7), intro: "（じーっ……こっちを見ている）", aiPersona: "単眼の観察好き。口数は少ないが、見たものを全部覚えている。" },
  { id: "kureem", name: "くりーむ", personality: "friendly", weight: 8, sprites: alien(9), intro: "ぷにぷにだよ。さわる？", aiPersona: "ふわふわ天然のまんまる宇宙人。食べ物の話が好き。" },
  { id: "kinokon", name: "きのこん", personality: "pace", weight: 6, sprites: alien(11), intro: "ここのしめりけ、わるくない。", aiPersona: "きのこの宇宙人。静かな場所と適度な湿度を好む渋いやつ。" },
  { id: "fuwari", name: "ふわり", personality: "shy", weight: 5, sprites: alien(13), intro: "…みえてる？ぼくのこと、みえてるの？", aiPersona: "おばけ型。存在に気づいてもらえると嬉しくて浮く。さみしがり。" },
  { id: "nyanta", name: "にゃんた", personality: "tsun", weight: 6, sprites: alien(15), intro: "べつに、きみに会いにきたわけじゃないにゃ。", aiPersona: "ツンデレのネコ型宇宙人。素直じゃないが構ってほしい。語尾ににゃ。" },
  { id: "onio", name: "おにお", personality: "tsun", weight: 5, sprites: alien(17), intro: "フン、ここがウワサの成長のOSか。たいしたことな…くもないな。", aiPersona: "強がりの小鬼。実は努力家を尊敬している。認めるときは早口。" },
  { id: "purumi", name: "ぷるみ", personality: "friendly", weight: 6, sprites: alien(19), intro: "ぷるぷる〜。きょうもおつかれさま！", aiPersona: "癒やし系スライム。ねぎらい上手。ぷるぷる鳴く。" },
  // --- 開発者支給PNGの例（public/pets/README.md の契約でファイルを置いて有効化する） ---
  // {
  //   id: "hoshimaru",
  //   name: "ほしまる",
  //   personality: "friendly",
  //   weight: 4,
  //   sprites: {
  //     normal: "/pets/hoshimaru/normal.png",
  //     happy: "/pets/hoshimaru/happy.png",
  //   },
  //   intro: "（手描きのあたたかみを感じる…）",
  //   aiPersona: "開発者の手描きから生まれた星のこども。",
  // },
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
