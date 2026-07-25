// おさんぽ（散歩）のつぶやきロジック。純粋関数のみ＝クライアントでもサーバーでも使える。
//
// 【思想】1分に1回、うちの子が「時刻 × 天気 × きみのコンディション × なつき度 × 性格」に
// あわせてポツリとつぶやく。ふだんはこのセリフ辞書から選ぶ（AIコスト0で無限に眺められる）。
// コンディションが下向きのときは、気づかい系のセリフを強く優先する（#16セルフケアの延長）。
// 特別な一言だけAIが混じる設計（ハイブリッド）だが、そのAI層は actions.ts 側。ここは辞書。

import type { PersonalityId } from "@/lib/pets/species";

// ---------------------------------------------------------------------------
// bucket 定義（連続値は全部ここで粗いカテゴリに畳んでから辞書を引く）
// ---------------------------------------------------------------------------

export type TimeBucket = "morning" | "noon" | "evening" | "night";
export type WeatherBucket =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "fog"
  | "storm";
/** きみの気分（週報コンディション由来・本人しか見えない値からざっくり） */
export type MoodBucket = "good" | "ok" | "low" | "unknown";
/** きみの稼働感（余裕〜限界） */
export type LoadBucket = "relaxed" | "normal" | "busy" | "limit" | "unknown";

export type WalkContext = {
  time: TimeBucket;
  weather: WeatherBucket;
  mood: MoodBucket;
  load: LoadBucket;
  personality: PersonalityId;
  /** なつき度（0〜）。高いほど砕けた・甘えたセリフが増える */
  affection: number;
  petName: string;
};

/** ローカル時刻(0-23)→朝昼夕夜 */
export function timeToBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "noon";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

/** Open-Meteo の WMO weather_code → 天気bucket。0=快晴 … 95+=雷雨 */
export function weatherCodeToBucket(code: number): WeatherBucket {
  if (code <= 1) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  // 51-67（霧雨〜雨）, 80-82（にわか雨）
  return "rain";
}

/** 週報の総合スコア(0-100)→気分bucket。null は unknown（まだ週報が少ない等） */
export function moodBucket(score: number | null | undefined): MoodBucket {
  if (score == null) return "unknown";
  if (score >= 67) return "good";
  if (score >= 34) return "ok";
  return "low";
}

/** 稼働の体感 1(限界)-4(余裕) → 稼働bucket */
export function loadBucket(workloadSelf: number | null | undefined): LoadBucket {
  if (workloadSelf == null) return "unknown";
  if (workloadSelf >= 4) return "relaxed";
  if (workloadSelf === 3) return "normal";
  if (workloadSelf === 2) return "busy";
  return "limit";
}

// ---------------------------------------------------------------------------
// セリフ辞書
// ---------------------------------------------------------------------------

const TIME_LINES: Record<TimeBucket, string[]> = {
  morning: [
    "あさの ひかりって、やわらかくて すきだなあ。",
    "きょうも いちにち はじまるね。ふぁ〜…。",
    "あさごはん、たべた？ ぼくはまだ。",
    "とりさんが ないてる。おはよう〜。",
  ],
  noon: [
    "おひるだ。おなか すいてこない？",
    "ひなたが あったかいねえ。",
    "このへんで ちょっと ひとやすみ しよっか。",
    "おおきな あくび、でちゃった。",
  ],
  evening: [
    "そらが だいだいいろに なってきた。",
    "ゆうやけ、きれいだね。しゃしん とっておこ。",
    "かえりみち、ちょっと さみしいけど すき。",
    "からす かえるよ〜って ないてる。",
  ],
  night: [
    "おほしさま、みえるかな。",
    "よるの さんぽは しずかで いいね。",
    "つきが ついてくるよ。ほら。",
    "よふかし しすぎちゃ だめだよ？",
  ],
};

const WEATHER_LINES: Record<WeatherBucket, string[]> = {
  clear: [
    "いいてんき！ あるくのが きもちいいね。",
    "そらが まっさお。きぶんも はれるなあ。",
    "かぜが さらさら してる。",
  ],
  cloudy: [
    "くもが もこもこ してる。ひつじ みたい。",
    "ちょっと くもってるけど、これはこれで すずしいね。",
    "おひさま、くもの うしろで かくれんぼ してる。",
  ],
  rain: [
    "あめだ。かさに あたる おと、すきなんだ。",
    "みずたまり、ぴょんって とびこえよ。",
    "あめの ひは、においが かわるね。",
    "ぬれちゃうから、むりせず かえろっか。",
  ],
  snow: [
    "ゆきだ！ ふわふわ してる〜。",
    "はく いきが しろいね。",
    "さむいから、てぶくろ わすれちゃ だめだよ。",
  ],
  fog: [
    "きりが でてる。ゆめのなか みたい。",
    "むこうが かすんでる。はぐれないでね。",
  ],
  storm: [
    "ごろごろ いってる…。ちょっと こわいね。",
    "かみなり、なるまえに おうちに かえろ？",
  ],
};

// なつき度が高い子だけがこぼす、砕けた・甘えたセリフ
const AFFECTION_LINES: string[] = [
  "きみと あるくの、ぼく いちばん すきかも。",
  "てを つないでも いい…？ なんてね。",
  "きみが いてくれるから、どこでも たのしいや。",
  "また あした も さんぽ しようね。やくそく。",
];

// 性格ごとの味つけ（同じ状況でもキャラで言い回しが変わる）
const PERSONALITY_LINES: Record<PersonalityId, string[]> = {
  friendly: [
    "ねえねえ、あれ みて！ …って、なんでもなかった。えへへ。",
    "きょうも いっしょで うれしいなあ！",
  ],
  tsun: [
    "……べつに、きみと あるきたくて きたわけじゃ ないからな。",
    "おそいぞ。……まあ、まってやってもいいけど。",
  ],
  shy: [
    "……（そっと となりを あるいている）",
    "…あの、…なんでもない。ちょっと ちかくに いたくて。",
  ],
  pace: [
    "ま、いそがなくて いいよ。ぼくの ペースで いこ。",
    "のんびり いこ〜。せかいは にげないからね。",
  ],
};

// きみのコンディションを気づかうセリフ。mood が low / load が limit,busy のとき強く出る
const CARE_LOW_MOOD: string[] = [
  "むりして ない？ きょうは ゆっくりで いいんだよ。",
  "しんどいときは、しんどいって いっていいんだからね。",
  "きみが がんばってるの、ぼくは ちゃんと しってるよ。",
  "そらでも みあげて、ふーって いきしよ。ぼくも やる。",
];
const CARE_HIGH_LOAD: string[] = [
  "さいきん いそがしそうだね。ちゃんと ねてる？",
  "きゅうけいも しごとの うちだよ。ほら、ひとやすみ。",
  "がんばりすぎは だめ。ぼくとの さんぽで ちょっと やすも。",
];
const CARE_GOOD: string[] = [
  "きみ、なんだか いいかんじだね。ぼくも うれしい。",
  "その ちょうし その ちょうし！ ぼくは おうえんしてるよ。",
];

// どの状況でも混ざる、雰囲気のセリフ
const AMBIENT: string[] = [
  "…♪ ふんふ〜ん。",
  "この みち、はじめて とおるかも。",
  "ちいさな はなが さいてる。ほら、あしもと。",
  "いしころ、ひとつ もってかえろっと。",
];

type Weighted = { text: string; weight: number };

function push(out: Weighted[], lines: string[], weight: number) {
  for (const text of lines) out.push({ text, weight });
}

/**
 * 文脈から重みつき候補を組み、直近使ったものを避けてひとつ選ぶ。
 * mood/load が下向きのときは care 系を厚く積んで「気づかってくれる」体験にする。
 * ランダム選択（眺めるだけの演出なので Math.random でよい）。
 */
export function pickMutter(ctx: WalkContext, recent: string[]): string {
  const cands: Weighted[] = [];
  push(cands, TIME_LINES[ctx.time], 3);
  push(cands, WEATHER_LINES[ctx.weather], 3);
  push(cands, PERSONALITY_LINES[ctx.personality], 2);
  push(cands, AMBIENT, 2);

  if (ctx.affection >= 7) push(cands, AFFECTION_LINES, 2);

  // 気づかい: 弱っている・忙しいときほど強く前に出す
  const low = ctx.mood === "low";
  const heavy = ctx.load === "limit" || ctx.load === "busy";
  if (low) push(cands, CARE_LOW_MOOD, 7);
  if (heavy) push(cands, CARE_HIGH_LOAD, heavy && ctx.load === "limit" ? 7 : 5);
  if (!low && !heavy && (ctx.mood === "good" || ctx.load === "relaxed")) {
    push(cands, CARE_GOOD, 2);
  }

  // 直近に出したセリフは除く（全部除かれたら制限を無視して選ぶ）
  const fresh = cands.filter((c) => !recent.includes(c.text));
  const pool = fresh.length > 0 ? fresh : cands;

  const total = pool.reduce((a, c) => a + c.weight, 0);
  let r = Math.random() * total;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c.text;
  }
  return pool[pool.length - 1].text;
}
