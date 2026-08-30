// げんば（GENBA.sim）のTSマスタ（ダンジョンcontent.tsと同方針: DBに持たずID参照・追加=配列に足すだけ）。
// このファイルはクライアントからも読まれるので prisma 等サーバー専用モジュールに依存させないこと。
// 設計書: 竹版（2026-08-02 レビュー承認）。通貨はEN(エン)。単価は「現実の月単価◯◯万 → ◯◯EN/日」の対応。

// ---- バランス定数 ----
export const GENBA = {
  START_TRUST: 50,
  START_STAMINA: 100,
  MAX_STRIKES: 3, // ⚠3連続で途中退場
  EARLY_EXIT_RATE: 0.6, // 途中退場の精算率
  COMPLETE_BONUS_PER_TRUST: 2, // 満了ボーナス = しんらい×2EN
  COMPLETE_BONUS_MAX: 200,
  STAMINA_RECOVER_PER_DAY: 8, // 朝の回復（寝た分）
  INTERVIEW_BASE: 0.4, // 面接通過率 = 40% + 55%×充足度 + 受け答え
  INTERVIEW_SKILL_COEF: 0.55,
  EVENT_SKILL_BONUS: 0.15, // skillTag保有ボーナス
  EVENT_MATCH_COEF: 0.2, // (充足度-0.5)×これ
  SALES_TRUST_COMPLETE: 8, // 満了でハトリさん信頼+
  SALES_TRUST_FAILED: -6, // 途中退場で−
  SALES_TRUST_REJECTED: -5, // 面接落ちで−
  SALES_TRUST_EXTRA_OFFER: 20, // 信頼がこれ以上で案件4件提示
  SALES_TRUST_RATE_BONUS: 40, // 信頼がこれ以上で単価+5%
  SALES_TRUST_ERA_OFFER: 60, // 信頼がこれ以上で「妙な案件」（時代テーマ）が紛れ込むことがある
  REVISIT_TRUST: 70, // 満了時のしんらいがこれ以上だと「再訪（次フェーズ）案件」が解禁される
  REVISIT_INTERVIEW_BONUS: 0.08, // 再訪面接の顔なじみボーナス（通過率に加算）
} as const;

// ---- テーマ ----
// era付きは「きおくの現場」: もう存在しない仕事へのタイムスリップ枠。
// 消えた仕事は飲み屋やSNSの語りでしか残らない——それをゲームでアーカイブする（2026-08-04 方針）。
export type GenbaTheme =
  | "finance"
  | "ec"
  | "embedded"
  | "gov"
  | "web"
  | "punchcard"
  | "mainframe"
  | "y2k"
  | "imode"
  | "socialgame";
export type NpcId =
  | "hato"
  | "owl"
  | "chicken"
  | "turtle"
  | "penguin"
  | "peacock"
  | "sparrow"
  | "humming"
  | "tsuru";

export type ThemeDef = {
  id: GenbaTheme;
  name: string;
  flavor: string; // 案件カードの現場イメージ1行
  roster: NpcId[]; // この現場に配属されるNPC（イベントはここから出る）
  interviewer: NpcId;
  era?: string; // 「きおくの現場」の年代ラベル。指定があると共通イベントは出ない（時代錯誤防止）
};

export const THEMES: ThemeDef[] = [
  {
    id: "finance",
    name: "金融",
    flavor: "かっちりスーツの現場。レビューは厳しいが単価は高い",
    roster: ["owl", "chicken", "turtle", "peacock"],
    interviewer: "peacock",
  },
  {
    id: "ec",
    name: "EC",
    flavor: "セールと在庫に生きる現場。スピード命",
    roster: ["owl", "chicken", "sparrow", "humming"],
    interviewer: "owl",
  },
  {
    id: "embedded",
    name: "組み込み",
    flavor: "実機と配線の現場。動くとうれしい",
    roster: ["owl", "chicken", "turtle", "penguin"],
    interviewer: "turtle",
  },
  {
    id: "gov",
    name: "官公庁",
    flavor: "紙とハンコの名残る現場。手順がすべて",
    roster: ["owl", "chicken", "turtle", "peacock"],
    interviewer: "peacock",
  },
  {
    id: "web",
    name: "Web系",
    flavor: "自社サービスの現場。会議もチャットも速い",
    roster: ["owl", "penguin", "sparrow", "humming"],
    interviewer: "humming",
  },
  // ---- きおくの現場（時代テーマ・年代順） ----
  {
    id: "punchcard",
    name: "計算センター",
    flavor: "紙のカードに孔をあけてプログラムを運んだ時代。正確さがすべて",
    roster: ["tsuru", "turtle", "peacock"],
    interviewer: "tsuru",
    era: "1960-70年代",
  },
  {
    id: "mainframe",
    name: "汎用機の間",
    flavor: "磁気テープと連続帳票のうなる部屋。計算機様は人間より涼しい場所にいた",
    roster: ["tsuru", "turtle", "penguin"],
    interviewer: "tsuru",
    era: "1980年代",
  },
  {
    id: "y2k",
    name: "2000年対策室",
    flavor: "世界が2桁の年数を悔いた冬。「何も起きない」が最高の成果だった",
    roster: ["tsuru", "owl", "chicken", "penguin"],
    interviewer: "tsuru",
    era: "1999年",
  },
  {
    id: "imode",
    name: "ケータイ公式サイト",
    flavor: "親指の上に文化があった時代。絵文字はキャリアの数だけ形が違った",
    roster: ["tsuru", "sparrow", "humming", "chicken"],
    interviewer: "tsuru",
    era: "2000年代",
  },
  {
    id: "socialgame",
    name: "ソシャゲ運営室",
    flavor: "深夜メンテと監視ダッシュボードの現場。祭りの裏側はいつも戦場だった",
    roster: ["tsuru", "owl", "sparrow", "humming"],
    interviewer: "tsuru",
    era: "2010年代",
  },
];

export const themeById = (id: string): ThemeDef | undefined =>
  THEMES.find((t) => t.id === id);

// ---- キャラクター ----
export type NpcDef = {
  id: NpcId;
  name: string;
  role: string;
  bio: string; // 図鑑・ツールチップ用
};

export const NPCS: NpcDef[] = [
  { id: "hato", name: "ハトリさん", role: "営業", bio: "案件を運んでくる伝書鳩。満了するたび信頼が育ち、いい案件を持ってきてくれる。" },
  { id: "owl", name: "フクロPM", role: "PM", bio: "夜行性。レビュー指摘30件が深夜2時に返ってくる。怒ってはいない、夜行性なだけ。" },
  { id: "chicken", name: "トサカ先輩", role: "プロパー", bio: "朝型で声がでかい頼れる先輩。定時後の「飲んでくか」で信頼が深まる。" },
  { id: "turtle", name: "カメ長老", role: "レガシー守護者", bio: "この現場のレガシーを20年守る。仕様書はない、すべて甲羅の中にある。" },
  { id: "penguin", name: "ペンさん", role: "インフラ", bio: "黒い画面の住人。本番障害のとき、無言で手招きしてくる。" },
  { id: "peacock", name: "クジャク部長", role: "客先の偉い人", bio: "月末にだけ現れて羽をひろげ、一言で画面の色を全部変える。" },
  { id: "sparrow", name: "チュン太", role: "同じSESの仲間", bio: "隣の商流から来た同業者。有益な情報をくれるが雑談が長い。" },
  { id: "humming", name: "ハチ子", role: "PMO", bio: "高速で飛び回り会議を量産する。断る勇気を試してくる。" },
  { id: "tsuru", name: "ツルさん", role: "時代の証人", bio: "千年生きる鶴。消えていった仕事のすべてを現場で見てきた。妙な案件の扉の前で、今日も誰かを待っている。" },
];

export const npcById = (id: string): NpcDef | undefined =>
  NPCS.find((n) => n.id === id);

// ---- 案件テンプレ ----
// skills の level は EngineerSkill と同じ10段階。単価(EN/日)は要求の重さに比例させる。
// 現実対応: 単価60万の案件 → 60EN/日。
export type OfferTemplate = {
  id: string;
  theme: GenbaTheme;
  title: string;
  client: string; // 実名を出さない現場ぼかし（Project.clientAlias と同じ思想）
  work: string; // 業務内容
  skills: { name: string; level: number }[]; // 必須スキル（Skill.name と文字列一致）
  rate: number; // EN/現場日
  days: 10 | 15 | 20; // 1ヶ月=10日 / 2ヶ月=15日 / 3ヶ月=20日
  // 再訪（次フェーズ）案件: 基礎テンプレのidを指す。基礎をしんらいREVISIT_TRUST以上で
  // 満了すると解禁される。client は基礎と同じ現場——役割と要求スキルが一段上がる。
  revisitOf?: string;
  // 「きおくの現場」の案件。skills は必ず []（消えた仕事に現代の要件は課さない）。
  // kioku は満了後にアルバムへ載る史実解説。単価は当時の相場感であえて安い。
  era?: { period: string; kioku: string };
};

export const OFFER_TEMPLATES: OfferTemplate[] = [
  // --- 金融 ---
  {
    id: "fin-core",
    theme: "finance",
    title: "銀行勘定系システムの保守開発",
    client: "大手銀行系SIer",
    work: "勘定系周辺システムの改修・詳細設計から結合テストまで",
    skills: [
      { name: "Java", level: 5 },
      { name: "SQL", level: 4 },
      { name: "詳細設計", level: 4 },
    ],
    rate: 75,
    days: 20,
  },
  {
    id: "fin-sec",
    theme: "finance",
    title: "証券バックオフィス刷新",
    client: "ネット証券",
    work: "約定処理バッチのリプレイス。Spring Boot移行",
    skills: [
      { name: "Java", level: 6 },
      { name: "Spring Boot", level: 5 },
      { name: "Oracle", level: 4 },
    ],
    rate: 85,
    days: 15,
  },
  {
    id: "fin-test",
    theme: "finance",
    title: "信販システムのテスト支援",
    client: "信販会社",
    work: "結合テストの実施・エビデンス整理・障害起票",
    skills: [
      { name: "結合テスト", level: 3 },
      { name: "SQL", level: 2 },
    ],
    rate: 48,
    days: 10,
  },
  // --- EC ---
  {
    id: "ec-renew",
    theme: "ec",
    title: "ECサイトリニューアル",
    client: "アパレルEC",
    work: "カート・決済まわりの改修。Laravelでの機能追加",
    skills: [
      { name: "PHP", level: 4 },
      { name: "Laravel", level: 4 },
      { name: "MySQL", level: 3 },
    ],
    rate: 60,
    days: 15,
  },
  {
    id: "ec-stock",
    theme: "ec",
    title: "在庫管理システムの新規開発",
    client: "日用品EC",
    work: "React+TypeScriptでの管理画面SPA開発",
    skills: [
      { name: "TypeScript", level: 4 },
      { name: "React", level: 4 },
    ],
    rate: 62,
    days: 15,
  },
  {
    id: "ec-support",
    theme: "ec",
    title: "ECサイト運用保守",
    client: "食品EC",
    work: "セール前の負荷対策・問い合わせ対応・小規模改修",
    skills: [
      { name: "PHP", level: 3 },
      { name: "保守運用", level: 3 },
    ],
    rate: 50,
    days: 10,
  },
  // --- 組み込み ---
  {
    id: "emb-car",
    theme: "embedded",
    title: "車載ユニットの評価・検証",
    client: "自動車部品メーカー",
    work: "実機での結合テスト・ログ解析ツールのPython開発",
    skills: [
      { name: "Python", level: 3 },
      { name: "結合テスト", level: 4 },
    ],
    rate: 55,
    days: 20,
  },
  {
    id: "emb-iot",
    theme: "embedded",
    title: "IoT機器の管理システム開発",
    client: "設備機器メーカー",
    work: "C#での収集サーバー開発とAzure連携",
    skills: [
      { name: "C#", level: 4 },
      { name: "Azure", level: 3 },
      { name: "SQL", level: 3 },
    ],
    rate: 65,
    days: 15,
  },
  // --- 官公庁 ---
  {
    id: "gov-city",
    theme: "gov",
    title: "自治体基幹システム改修",
    client: "県庁システム元請",
    work: "制度改正対応の基本設計〜結合テスト。ドキュメント厚め",
    skills: [
      { name: "Java", level: 4 },
      { name: "基本設計", level: 4 },
      { name: "Oracle", level: 3 },
    ],
    rate: 58,
    days: 20,
  },
  {
    id: "gov-doc",
    theme: "gov",
    title: "行政システムの設計支援",
    client: "中央省庁案件の二次請け",
    work: "要件定義補助・設計書レビュー・会議体運営",
    skills: [
      { name: "要件定義", level: 4 },
      { name: "基本設計", level: 3 },
      { name: "顧客折衝", level: 3 },
    ],
    rate: 68,
    days: 15,
  },
  // --- Web系 ---
  {
    id: "web-saas",
    theme: "web",
    title: "自社SaaSの開発支援",
    client: "HR系スタートアップ",
    work: "設計からお任せするNext.jsでの機能開発",
    skills: [
      { name: "TypeScript", level: 5 },
      { name: "Next.js", level: 4 },
      { name: "React", level: 4 },
    ],
    rate: 72,
    days: 15,
  },
  {
    id: "web-infra",
    theme: "web",
    title: "SREチーム増員",
    client: "動画配信サービス",
    work: "AWS上の基盤改善・監視整備・障害対応",
    skills: [
      { name: "AWS", level: 5 },
      { name: "Docker", level: 4 },
      { name: "障害対応", level: 4 },
    ],
    rate: 80,
    days: 20,
  },
  {
    id: "web-junior",
    theme: "web",
    title: "受託Web開発メンバー",
    client: "制作会社",
    work: "コーポレートサイト・小規模Webアプリの実装",
    skills: [
      { name: "JavaScript", level: 3 },
      { name: "React", level: 2 },
    ],
    rate: 45,
    days: 10,
  },
  // ================= 再訪案件（次フェーズ） =================
  // 基礎案件をしんらい70+で満了すると解禁。同じ現場（client同一）で役割が一段上がり、
  // 要求スキルはやや重く・単価は基礎の+10〜15%。満了すると系列は完結して消える。
  {
    id: "fin-core-rv",
    theme: "finance",
    revisitOf: "fin-core",
    title: "銀行勘定系 次期更改の方式設計",
    client: "大手銀行系SIer",
    work: "前フェーズの保守で得た知見を買われ、次期更改の方式設計と移行計画づくりを担当",
    skills: [
      { name: "Java", level: 6 },
      { name: "基本設計", level: 5 },
      { name: "SQL", level: 4 },
    ],
    rate: 85,
    days: 20,
  },
  {
    id: "fin-sec-rv",
    theme: "finance",
    revisitOf: "fin-sec",
    title: "証券バックオフィス 性能改善と本番移行",
    client: "ネット証券",
    work: "リプレイスを完遂した実績で再指名。バッチの性能改善と本番移行の立ち会いを主導",
    skills: [
      { name: "Java", level: 6 },
      { name: "Spring Boot", level: 5 },
      { name: "Oracle", level: 5 },
    ],
    rate: 95,
    days: 15,
  },
  {
    id: "fin-test-rv",
    theme: "finance",
    revisitOf: "fin-test",
    title: "信販システムのテストリーダー",
    client: "信販会社",
    work: "前フェーズの丁寧な仕事ぶりが評価され、テストリーダーとして自動化導入を主導",
    skills: [
      { name: "結合テスト", level: 4 },
      { name: "SQL", level: 3 },
    ],
    rate: 55,
    days: 15,
  },
  {
    id: "ec-renew-rv",
    theme: "ec",
    revisitOf: "ec-renew",
    title: "会員基盤・ポイント機能の第2期開発",
    client: "アパレルEC",
    work: "リニューアルの信頼で第2期も指名。会員基盤とポイント機能の設計から任される",
    skills: [
      { name: "PHP", level: 5 },
      { name: "Laravel", level: 4 },
      { name: "MySQL", level: 4 },
    ],
    rate: 68,
    days: 15,
  },
  {
    id: "ec-stock-rv",
    theme: "ec",
    revisitOf: "ec-stock",
    title: "在庫管理システムの多倉庫対応",
    client: "日用品EC",
    work: "初期リリースの実績で継続指名。多倉庫対応と外部API連携の拡張フェーズを担当",
    skills: [
      { name: "TypeScript", level: 5 },
      { name: "React", level: 4 },
      { name: "SQL", level: 3 },
    ],
    rate: 70,
    days: 15,
  },
  {
    id: "ec-support-rv",
    theme: "ec",
    revisitOf: "ec-support",
    title: "ECサイト基盤刷新の主担当",
    client: "食品EC",
    work: "保守で現場を知り尽くした人にと、大型セールへ向けた基盤刷新の主担当に指名",
    skills: [
      { name: "PHP", level: 4 },
      { name: "保守運用", level: 4 },
    ],
    rate: 58,
    days: 15,
  },
  {
    id: "emb-car-rv",
    theme: "embedded",
    revisitOf: "emb-car",
    title: "車載検証の自動化ツール開発リード",
    client: "自動車部品メーカー",
    work: "評価・検証の経験を踏まえ、次期モデル向け検証自動化ツールの開発リードを担当",
    skills: [
      { name: "Python", level: 4 },
      { name: "結合テスト", level: 5 },
    ],
    rate: 62,
    days: 20,
  },
  {
    id: "emb-iot-rv",
    theme: "embedded",
    revisitOf: "emb-iot",
    title: "IoT基盤のクラウド全面移行",
    client: "設備機器メーカー",
    work: "収集サーバーを知る人にと再指名。IoT基盤のクラウド全面移行と分析画面の開発",
    skills: [
      { name: "C#", level: 4 },
      { name: "Azure", level: 4 },
      { name: "SQL", level: 4 },
    ],
    rate: 74,
    days: 20,
  },
  {
    id: "gov-city-rv",
    theme: "gov",
    revisitOf: "gov-city",
    title: "次年度制度対応の設計とりまとめ",
    client: "県庁システム元請",
    work: "前年度対応の実績で継続参画。次年度制度対応の基本設計とりまとめ役を担当",
    skills: [
      { name: "Java", level: 4 },
      { name: "基本設計", level: 5 },
      { name: "顧客折衝", level: 3 },
    ],
    rate: 65,
    days: 20,
  },
  {
    id: "gov-doc-rv",
    theme: "gov",
    revisitOf: "gov-doc",
    title: "次期システム要件定義の本体参画",
    client: "中央省庁案件の二次請け",
    work: "設計支援の働きぶりが省庁側にも伝わり、次期システムの要件定義フェーズに本体参画",
    skills: [
      { name: "要件定義", level: 5 },
      { name: "顧客折衝", level: 4 },
      { name: "基本設計", level: 3 },
    ],
    rate: 78,
    days: 15,
  },
  {
    id: "web-saas-rv",
    theme: "web",
    revisitOf: "web-saas",
    title: "新モジュールのテックリード",
    client: "HR系スタートアップ",
    work: "機能開発の信頼で再指名。新モジュールのテックリードとして設計と実装を牽引",
    skills: [
      { name: "TypeScript", level: 6 },
      { name: "Next.js", level: 5 },
      { name: "React", level: 4 },
    ],
    rate: 82,
    days: 15,
  },
  {
    id: "web-infra-rv",
    theme: "web",
    revisitOf: "web-infra",
    title: "IaC刷新とオンコール体制の設計",
    client: "動画配信サービス",
    work: "基盤改善の実績で中核メンバーに。IaCの全面刷新とオンコール体制の設計を担当",
    skills: [
      { name: "AWS", level: 6 },
      { name: "Docker", level: 4 },
      { name: "障害対応", level: 5 },
    ],
    rate: 90,
    days: 20,
  },
  {
    id: "web-junior-rv",
    theme: "web",
    revisitOf: "web-junior",
    title: "指名リピート案件の主担当",
    client: "制作会社",
    work: "前回の仕事ぶりでお客様から指名が入り、小規模Webアプリの主担当へ昇格",
    skills: [
      { name: "JavaScript", level: 4 },
      { name: "React", level: 3 },
    ],
    rate: 52,
    days: 10,
  },
  // ================= きおくの現場（時代案件） =================
  // --- 計算センター（1960-70年代） ---
  {
    id: "pc-keypunch",
    theme: "punchcard",
    title: "キーパンチャー増員",
    client: "電算室のある大手企業",
    work: "伝票の数字をカードに穿孔する。1枚のミスが夜間計算を全部止める",
    skills: [],
    rate: 24,
    days: 10,
    era: {
      period: "1960-70年代",
      kioku:
        "キーパンチャーは伝票の内容をパンチカードに穿孔する専門職。日本だけで数万人が働き、その多くは女性だった。同じ伝票を二度打って照合する「検孔」までが仕事で、彼女たちの正確さが給与計算も銀行も支えた。データ入力の自動化とともに、職業ごと静かに消えた。",
    },
  },
  {
    id: "pc-operator",
    theme: "punchcard",
    title: "計算センターの夜間オペレーター",
    client: "計算受託センター",
    work: "夜間計算のカード束を装置にかけ、結果の帳票を仕分けて朝までに揃える",
    skills: [],
    rate: 28,
    days: 10,
    era: {
      period: "1960-70年代",
      kioku:
        "コンピュータが会社に1台もない時代、企業は計算センターに袋いっぱいのカードを持ち込んで計算を「外注」した。オペレーターは夜通し装置にカードをかけ、帳票を仕分けた。カードの束を落とすと順序が失われるため、束の側面に斜線を引いておくのが知恵だった。",
    },
  },
  // --- 汎用機の間（1980年代） ---
  {
    id: "mf-tape",
    theme: "mainframe",
    title: "磁気テープ交換オペレーター",
    client: "銀行系計算事務所",
    work: "夜間バッチの指示書どおりにテープを掛け替え、世代管理を守る",
    skills: [],
    rate: 30,
    days: 10,
    era: {
      period: "1980年代",
      kioku:
        "汎用機の記憶装置はオープンリールの磁気テープ。夜間バッチはテープの掛け替えなしには進まず、オペレーターが指示書を睨みながら夜通しリールを交換した。ラベルの貼り間違い一つで翌朝の口座残高が狂う。自動化ライブラリ装置とディスクの大容量化が、この夜勤を過去にした。",
    },
  },
  {
    id: "mf-print",
    theme: "mainframe",
    title: "帳票センターの出力担当",
    client: "官公庁系データセンター",
    work: "ラインプリンタの連続帳票を管理し、裁断・封入して発送台車に載せる",
    skills: [],
    rate: 26,
    days: 10,
    era: {
      period: "1980年代",
      kioku:
        "「システムの成果物」はかつて紙だった。ラインプリンタは1分に数千行を打ち、緑の縞の連続帳票が山と積まれた。紙を運び、裁断し、封入する人たちがデータセンターの一角に必ずいた。Web画面とPDFがその山を消し、紙の匂いだけが語り草に残った。",
    },
  },
  // --- 2000年対策室（1999年） ---
  {
    id: "yk-audit",
    theme: "y2k",
    title: "西暦2000年問題の全数調査",
    client: "金融機関の対策プロジェクト",
    work: "全ソースから日付処理を洗い出し、2桁年の危険箇所に印をつけていく",
    skills: [],
    rate: 40,
    days: 15,
    era: {
      period: "1999年",
      kioku:
        "メモリが貴重だった時代、年は「99」のように2桁で持つのが常識だった。その節約が2000年に牙をむくとされ、世界中で膨大なソースの全数調査が行われた。結果、大きな破局は起きなかった——それは奇跡ではなく、この地味な調査を数年やり抜いた人たちの成果だった。",
    },
  },
  {
    id: "yk-eve",
    theme: "y2k",
    title: "大晦日の年越し待機要員",
    client: "社会インフラ系システム部門",
    work: "1999年12月31日、対策室に泊まり込み、日付が変わる瞬間を見届ける",
    skills: [],
    rate: 45,
    days: 10,
    era: {
      period: "1999年",
      kioku:
        "1999年の大晦日、世界中のエンジニアが職場で年を越した。テレビの年越し番組を誰も見ず、全員が時計とコンソールを見ていた。0時0分、何も起きない。それが数年がかりの仕事の完成形だった。「何も起きないことが成果」——この仕事の孤独は、いまも語り継がれている。",
    },
  },
  // --- ケータイ公式サイト（2000年代） ---
  {
    id: "im-official",
    theme: "imode",
    title: "ケータイ公式サイトの運用",
    client: "モバイルコンテンツ企業",
    work: "3キャリア対応の公式サイトを更新し、絵文字の互換とパケット量に気を配る",
    skills: [],
    rate: 35,
    days: 10,
    era: {
      period: "2000年代",
      kioku:
        "iモードの登場で、日本は世界より早く「ケータイでネット」を実現した。公式サイトの運用者は3キャリアの絵文字変換表を手元に置き、機種ごとの画面幅と容量制限と戦った。ガラパゴスと笑われたその技術の蓄積は、のちのスマホ時代の土台になった。",
    },
  },
  {
    id: "im-flash",
    theme: "imode",
    title: "待受Flashコンテンツ職人",
    client: "デコ素材配信サイト",
    work: "100KBの container に収まる待受Flashを作る。1バイト単位の削りが腕の見せどころ",
    skills: [],
    rate: 32,
    days: 10,
    era: {
      period: "2000年代",
      kioku:
        "ケータイFlash職人は数十KBの制限の中でアニメと音を詰め込む圧縮の名手だった。容量との戦いが生んだ表現の工夫は、いま見ても驚くほど豊かだ。スマホの普及とFlashのサポート終了で職業は消え、作品の多くは端末と一緒に引き出しの中で眠っている。",
    },
  },
  // --- ソシャゲ運営室（2010年代） ---
  {
    id: "sg-event",
    theme: "socialgame",
    title: "ソシャゲ運営のイベント当番",
    client: "ソーシャルゲーム運営会社",
    work: "イベント開始と深夜メンテの立ち会い。KPIダッシュボードの監視当番",
    skills: [],
    rate: 42,
    days: 10,
    era: {
      period: "2010年代",
      kioku:
        "ガラケーソシャゲの運営室には「祭りの裏側」があった。イベント開始の瞬間にサーバーが軋み、深夜メンテの明けにお詫び石を配る。データを見ながらゲームを毎週作り替える運営スタイルはここで生まれ、いまのライブサービス運営の原型になった。",
    },
  },
  {
    id: "sg-port",
    theme: "socialgame",
    title: "ガラケー版からのスマホ移植",
    client: "ゲームデベロッパー",
    work: "ガラケー版とスマホ版の二重運用。仕様書はなく、動いているものが仕様",
    skills: [],
    rate: 40,
    days: 15,
    era: {
      period: "2010年代",
      kioku:
        "スマホへの移行期、現場は「ガラケー版を止められないままスマホ版を作る」二重生活だった。何年も動き続けた資産には仕様書がなく、コードだけが真実を知っていた。この時代の移植職人たちの苦労話は、レガシー移行という仕事の原点として今も現場で語られる。",
    },
  },
];

export const offerTemplateById = (id: string): OfferTemplate | undefined =>
  OFFER_TEMPLATES.find((t) => t.id === id);

// ---- 面接 ----
// SESの客先面談の実際の流れに合わせる（2026-08-02ユーザーフィードバック）:
//   ① 面接官がプロジェクト内容を説明（採点なし・相槌のみ）
//   ② 経歴書の説明（こちらから語る。筆頭スキルの実務経験が最大の武器）
//   ③ 質疑応答（面接官からの確認 → 最後に逆質問）
// mod は通過率への加算。needSkill はそのスキルを承認済みで保有していないと選択肢が出ない。
export type InterviewChoice = {
  label: string;
  mod: number;
  needSkill?: string;
};
export type InterviewQuestion = {
  phase: string; // 画面に出す段階ラベル（経歴書 / 質疑応答）
  ask: string;
  choices: InterviewChoice[];
};
export type InterviewPlan = {
  intro: string; // ① プロジェクト説明（面接官のセリフ・採点なし）
  questions: InterviewQuestion[];
};

const DAYS_TO_TERM: Record<number, string> = {
  10: "1ヶ月",
  15: "2ヶ月",
  20: "3ヶ月",
};

export function interviewPlan(offer: OfferTemplate): InterviewPlan {
  // きおくの現場: 面接官はいない。扉の前でツルさんと顔合わせをするだけ。
  // スキル要件なし（fulfillment=1）なので、姿勢さえ示せばほぼ通る＝記憶に入るハードルは低く。
  if (offer.era) {
    return {
      intro:
        `ようこそ。ここは「${offer.title}」——${offer.era.period}の、もうこの世のどこにもない現場。` +
        `ハトリさんから話は聞いているよ。${offer.work}。` +
        `報酬は当時の相場で悪いが、ここでしか見られないものがある。`,
      questions: [
        {
          phase: "質疑応答",
          ask: "ひとつだけ聞かせておくれ。——なぜ、この扉を叩いたんだい？",
          choices: [
            { label: "消えた仕事を、この目で見てみたいんです", mod: 0.08 },
            { label: "ハトリさんが妙に推してくるので", mod: 0.04 },
            { label: "実は、ENに釣られました", mod: 0 },
          ],
        },
        {
          phase: "質疑応答",
          ask: "よろしい。では約束をひとつ。——昔のやり方を、笑わないこと。当時はそれが最先端だったんだ。",
          choices: [
            { label: "約束します。教わるつもりで働きます", mod: 0.08 },
            { label: "……効率化したくなったら、どうすれば？", mod: 0.02 },
            { label: "善処します", mod: 0 },
          ],
        },
      ],
    };
  }
  const main = offer.skills[0];
  const term = DAYS_TO_TERM[offer.days] ?? `${offer.days}日`;
  // 再訪（次フェーズ）: 面接というより顔合わせ。担当者は前フェーズからの顔なじみで話が早い。
  // 経歴書フェーズは省略（もう知られている）ので設問は2問。受け答えの上振れは通常より
  // 控えめにし、その分を固定の顔なじみボーナス（GENBA.REVISIT_INTERVIEW_BONUS）で補う。
  if (offer.revisitOf) {
    return {
      intro:
        `おかえりなさい。またご一緒できるのを楽しみにしていました。` +
        `前フェーズでの働きぶりは現場から聞いています。` +
        `今回は「${offer.title}」——${offer.work}。期間は${term}です。` +
        `経歴のご説明は結構ですので、いくつか確認だけさせてください。`,
      questions: [
        {
          phase: "質疑応答",
          ask: `今回は前回より一歩踏み込んで、${main.name}まわりを引っ張っていただきたい。いけそうですか？`,
          choices: [
            {
              label: `前フェーズの経験があります。${main.name}は私が巻き取ります`,
              mod: 0.12,
              needSkill: main.name,
            },
            { label: "現場を知っているぶん、立ち上がりは速いと思います", mod: 0.06 },
            { label: "正直すこし不安ですが、挑戦させてください", mod: 0.02 },
          ],
        },
        {
          phase: "質疑応答",
          ask: "前フェーズから体制も少し変わります。確認しておきたいことはありますか？",
          choices: [
            { label: "体制図と、前フェーズからの引き継ぎ事項を教えてください", mod: 0.08 },
            { label: "単価は上がりますか", mod: -0.04 },
            { label: "特にありません。勝手はわかっているので", mod: 0 },
          ],
        },
      ],
    };
  }
  return {
    intro:
      `本日はお時間をいただきありがとうございます。まず案件のご説明から。` +
      `${offer.client}様の「${offer.title}」で、${offer.work}をお願いする想定です。` +
      `期間は${term}、チームに入っていただく形になります。`,
    questions: [
      {
        phase: "経歴書",
        ask: "それでは、これまでのご経歴を教えていただけますか。",
        choices: [
          {
            label: `経歴書に沿って、${main.name}の実務経験を軸に説明した`,
            mod: 0.2,
            needSkill: main.name,
          },
          { label: "経歴書に沿って、時系列でていねいに説明した", mod: 0.06 },
          { label: "学習中の技術と意欲を中心にアピールした", mod: 0 },
        ],
      },
      {
        phase: "質疑応答",
        ask: `${main.name}まわりをお任せしたいのですが、立ち上がりはどう進めますか？`,
        choices: [
          { label: "既存コードとドキュメントを読み、小さいタスクから入ります", mod: 0.08 },
          { label: "チームの進め方に合わせて動きます", mod: 0.04 },
          { label: "なんとかなると思います！", mod: -0.05 },
        ],
      },
      {
        phase: "質疑応答",
        ask: "最後に、こちらへ何か質問はありますか？",
        choices: [
          { label: "チームの開発の進め方について教えてください", mod: 0.08 },
          { label: "残業は月何時間くらいですか", mod: -0.06 },
          { label: "特にありません", mod: 0 },
        ],
      },
    ],
  };
}

// ---- 現場イベント辞書 ----
// おさんぽのセリフ辞書と同方針のデータ駆動。テーマ指定なし=共通（ただしそのテーマの
// roster に居るNPCのイベントだけが出る）。peaceful はどれを選んでも成功する癒やし枠。
export type GenbaChoice = {
  label: string;
  baseRate: number; // 基礎成功率 0..1
  skillTag?: string; // Skill.name。保有していると+15%
  needSkill?: string; // Skill.name。保有していないと選択肢自体が出ない
  stamina?: number; // たいりょく増減（選んだ時点で適用）
  success: { text: string; trust: number };
  fail: { text: string; trust: number };
};
export type GenbaEvent = {
  id: string;
  themes?: GenbaTheme[];
  npc: NpcId;
  text: string;
  peaceful?: boolean;
  choices: GenbaChoice[];
};

export const EVENTS: GenbaEvent[] = [
  // ================= 共通（フクロPM） =================
  {
    id: "c-standup-stuck",
    npc: "owl",
    text: "朝会で進捗を聞かれた。実は昨日ハマって、ほとんど進んでいない。",
    choices: [
      {
        label: "正直に「詰まってます」と言う",
        baseRate: 0.85,
        success: { text: "フクロPMは静かにうなずき、有識者を繋いでくれた。午後には解決。", trust: 5 },
        fail: { text: "「なぜ昨日のうちに言わない」と静かに問われた。ぐうの音も出ない。", trust: -4 },
      },
      {
        label: "「順調です」と言ってしまう",
        baseRate: 0.35,
        success: { text: "昼までに自力で抜けた。セーフ。心臓に悪い。", trust: 2 },
        fail: { text: "夕会でバレた。「順調とは…？」フクロPMの首が180度回った。", trust: -8 },
      },
      {
        label: "先輩に相談してから答える",
        baseRate: 0.75,
        skillTag: "チームリード",
        success: { text: "先輩が補足してくれて、正確な状況共有になった。", trust: 4 },
        fail: { text: "先輩も知らない箇所だった。結局二人で頭を抱えた。", trust: -3 },
      },
    ],
  },
  {
    id: "c-midnight-review",
    npc: "owl",
    text: "出社すると、フクロPMからレビュー指摘が30件届いていた。「夜のうちに見ておいた。今週中に頼む」（夜行性なだけで、無茶は言わない）",
    choices: [
      {
        label: "優先度をつけて重要な10件から潰す",
        baseRate: 0.8,
        success: { text: "「対応方針、承知した」重いものから順に。プロの捌きだった。", trust: 6 },
        fail: { text: "優先度の判断を誤り、軽微な指摘から潰してしまった。", trust: -4 },
      },
      {
        label: "今日じゅうに全件いっきに対応する",
        baseRate: 0.6,
        stamina: -25,
        success: { text: "夕方、全件対応完了。フクロPMの目が少し見開かれた（喜びの表現）。", trust: 8 },
        fail: { text: "急いだせいでデグレを出した。指摘が32件に増えた。", trust: -6 },
      },
      {
        label: "対応計画を先に共有する",
        baseRate: 0.75,
        success: { text: "「では水曜までに重要分を」計画を示す姿勢そのものが信頼になった。", trust: 4 },
        fail: { text: "計画づくりに時間をかけすぎて、今日は1件も進まなかった。", trust: -3 },
      },
    ],
  },
  {
    id: "c-estimate",
    npc: "owl",
    text: "「この機能、何日でできる？」フクロPMが見積もりを求めている。",
    choices: [
      {
        label: "バッファ込みで正直に答える",
        baseRate: 0.8,
        success: { text: "「妥当だな」見積もり通りに進み、信頼が積み上がった。", trust: 5 },
        fail: { text: "「長すぎないか」と削られた。結局その日数かかったのに。", trust: -3 },
      },
      {
        label: "気合いの短納期を宣言する",
        baseRate: 0.35,
        stamina: -15,
        success: { text: "宣言通り完成させた。伝説の1日として語り継がれる。", trust: 8 },
        fail: { text: "全然終わらなかった。見積もりは気合いではなかった。", trust: -7 },
      },
    ],
  },
  {
    id: "c-scope-creep",
    npc: "owl",
    text: "仕様確認のつもりの会議で、いつのまにか機能が2つ増えていた。",
    choices: [
      {
        label: "議事録に「追加分は別途見積もり」と書く",
        baseRate: 0.75,
        skillTag: "顧客折衝",
        success: { text: "後日その議事録が全員を救った。書く者が現場を制す。", trust: 6 },
        fail: { text: "議事録の展開を忘れた。増えた機能は既成事実になった。", trust: -4 },
      },
      {
        label: "その場で「工数が増えます」と言う",
        baseRate: 0.6,
        success: { text: "「では優先度を整理しよう」と健全な流れに。", trust: 5 },
        fail: { text: "「まぁなんとかなるでしょ」の一言で会議は終わった。", trust: -4 },
      },
      { label: "黙って持ち帰る", baseRate: 0.4, success: { text: "先輩が気づいて巻き取ってくれた。次は自分で言おう。", trust: 1 }, fail: { text: "気づけば自分のタスクになっていた。", trust: -5 } },
    ],
  },
  {
    id: "c-release-day",
    npc: "owl",
    text: "今日はリリース日。手順書のとおりに進めれば、いいだけ、なのだが。",
    choices: [
      {
        label: "手順書どおり指差し確認で進める",
        baseRate: 0.85,
        skillTag: "本番リリース",
        success: { text: "リリース完了。何も起きないリリースこそ最高のリリース。", trust: 6 },
        fail: { text: "手順書に載っていない画面が出た。震える指でPMを呼ぶ。", trust: -4 },
      },
      {
        label: "慣れてるので流れで進める",
        baseRate: 0.5,
        success: { text: "スムーズに完了。ただし次回は手順書を守ろうと心に誓った。", trust: 3 },
        fail: { text: "手順を1つ飛ばした。ロールバックの夜が始まる。", trust: -8 },
      },
    ],
  },
  {
    id: "c-doc-nobody-reads",
    npc: "owl",
    peaceful: true,
    text: "設計書の更新を任された。誰も読まないと噂のあの設計書だ。",
    choices: [
      {
        label: "未来の自分のために丁寧に書く",
        baseRate: 1,
        success: { text: "3ヶ月後、その設計書に救われるのは自分である。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "最低限の差分だけ書く",
        baseRate: 1,
        success: { text: "サッと終わらせて実装に戻った。それも判断。", trust: 1 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-onboarding-newbie",
    npc: "owl",
    text: "新しく入った要員のオンボーディングを頼まれた。自分もまだ2週目なのに。",
    choices: [
      {
        label: "自分の詰まりポイントをメモにして渡す",
        baseRate: 0.85,
        skillTag: "メンバー育成",
        success: { text: "「これ神資料っすね」メモは現場の公式ドキュメントに昇格した。", trust: 6 },
        fail: { text: "メモの手順が古かった。二人で一緒に詰まった。", trust: -2 },
      },
      { label: "「自分も新人なので…」と断る", baseRate: 0.5, success: { text: "適任の先輩にパスできた。無理しない判断も大事。", trust: 1 }, fail: { text: "「教えることが一番の勉強だぞ」と結局担当に。", trust: -3 } },
    ],
  },
  // ================= 共通（トサカ先輩） =================
  {
    id: "c-nomikai",
    npc: "chicken",
    peaceful: true,
    text: "定時のチャイムと同時にトサカ先輩の声。「おつかれ！ちょっと飲んでくか」",
    choices: [
      {
        label: "行く",
        baseRate: 1,
        stamina: -15,
        success: { text: "現場の歴史と人間関係が2時間でぜんぶわかった。飲みニケーションおそるべし。", trust: 5 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "「明日の朝会にそなえます」と帰る",
        baseRate: 1,
        stamina: 15,
        success: { text: "「おう、えらいな！」先輩は笑って手を振った。ちゃんと休むのも仕事。", trust: 1 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-loud-question",
    npc: "chicken",
    text: "「これ誰か知ってるかー！」トサカ先輩がフロア全体に響く声で聞いている。自分、それ知ってるかもしれない。",
    choices: [
      {
        label: "「たぶん分かります」と手を挙げる",
        baseRate: 0.7,
        success: { text: "ビンゴだった。「たすかった！」フロアに響く声で褒められた。照れる。", trust: 6 },
        fail: { text: "違った。フロア全体が自分を見ている。穴があったら入りたい。", trust: -3 },
      },
      { label: "様子を見る", baseRate: 0.8, success: { text: "別の人が答えた。次は勇気を出そう。", trust: 0 }, fail: { text: "誰も答えず、結局全員で調べることに。最初に言えばよかった。", trust: -2 } },
    ],
  },
  {
    id: "c-senpai-cover",
    npc: "chicken",
    text: "自分のミスでビルドが壊れた。トサカ先輩が「まず直そうぜ」と隣に座った。",
    choices: [
      {
        label: "原因を説明しながら一緒に直す",
        baseRate: 0.85,
        success: { text: "30分で復旧。「報告が早いのは良いことだ！」と大声で褒められた。", trust: 5 },
        fail: { text: "説明があやふやで、先輩の首をかしげさせた。復旧はしたが反省。", trust: -2 },
      },
      {
        label: "とにかく平謝りする",
        baseRate: 0.6,
        success: { text: "「謝るより手を動かそうぜ」先輩の言葉が刺さった。一緒に直した。", trust: 2 },
        fail: { text: "謝っている間にCIが赤いまま昼になった。", trust: -4 },
      },
    ],
  },
  {
    id: "c-asakai-turn",
    npc: "chicken",
    peaceful: true,
    text: "「朝会の司会、今日からローテなー」トサカ先輩が当然のように言った。今日は自分の番らしい。",
    choices: [
      {
        label: "時間どおりテキパキ回す",
        baseRate: 1,
        success: { text: "5分で終わる朝会。「いいね、今日の司会」と評判だった。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "アイスブレイクを入れてみる",
        baseRate: 1,
        success: { text: "スベったが、場は和んだ。それでいい。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-lunch-info",
    npc: "chicken",
    peaceful: true,
    text: "「メシ行こうぜ」トサカ先輩に誘われた。現場の近くにうまい定食屋があるらしい。",
    choices: [
      {
        label: "ついていく",
        baseRate: 1,
        success: { text: "生姜焼きが絶品だった。ついでに来月の体制変更の話も聞けた。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "弁当があるので断る",
        baseRate: 1,
        success: { text: "自席で静かに充電。午後の集中力が違う。", trust: 0 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  // ================= 共通（カメ長老） =================
  {
    id: "c-legacy-spec",
    npc: "turtle",
    text: "誰も知らない仕様にぶつかった。知っているはずのカメ長老は、本日休暇。",
    choices: [
      {
        label: "コードを読んで挙動から推理する",
        baseRate: 0.6,
        skillTag: "SQL",
        success: { text: "コメントアウトされた10年前のコードに答えがあった。考古学の勝利。", trust: 6 },
        fail: { text: "推理は外れた。翌日、長老は一言「それはね、仕様だよ」。", trust: -4 },
      },
      {
        label: "明日、長老の出社を待つ",
        baseRate: 0.85,
        success: { text: "翌朝、長老は5分で答えた。「聞くのが一番はやい」金言である。", trust: 2 },
        fail: { text: "待っている間に別の箇所も詰まった。1日が静かに溶けた。", trust: -3 },
      },
      {
        label: "勘で直して先に進む",
        baseRate: 0.3,
        success: { text: "なんと正解だった。野生の勘、恐るべし。", trust: 4 },
        fail: { text: "翌日、関連バッチが3本こけた。勘は勘でしかなかった。", trust: -8 },
      },
    ],
  },
  {
    id: "c-turtle-story",
    npc: "turtle",
    peaceful: true,
    text: "カメ長老が遠い目をして昔話を始めた。「このシステムが生まれた頃はな…」",
    choices: [
      {
        label: "じっくり聞く",
        baseRate: 1,
        success: { text: "昔話の中に、いま詰まっている箇所のヒントがあった。歴史は役に立つ。", trust: 4 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "仕事しながら相槌を打つ",
        baseRate: 1,
        success: { text: "「ふぉっふぉ、忙しいのはいいことだ」長老は満足げに去った。", trust: 1 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-turtle-handover",
    npc: "turtle",
    text: "カメ長老が「わしの知っていることを、そろそろ誰かに」と引き継ぎ資料の作成相手に自分を指名した。",
    choices: [
      {
        label: "聞き書きしながらドキュメント化する",
        baseRate: 0.75,
        skillTag: "基本設計",
        success: { text: "20年分の口伝が初めて文字になった。現場の宝が生まれた。", trust: 8 },
        fail: { text: "長老の話が四方八方に飛び、資料は迷宮になった。", trust: -2 },
      },
      {
        label: "録音して後でまとめる",
        baseRate: 0.55,
        success: { text: "文字起こしから重要部分を抽出。効率的だった。", trust: 4 },
        fail: { text: "3時間の録音を聞き直す気力が、なかった。", trust: -3 },
      },
    ],
  },
  // ================= 共通（ペンさん） =================
  {
    id: "c-prod-incident",
    npc: "penguin",
    text: "本番障害発生。ペンさんが黒い画面越しに、無言でこちらに手招きしている。",
    choices: [
      {
        label: "ついていく",
        baseRate: 0.65,
        skillTag: "障害対応",
        stamina: -20,
        success: { text: "ログの海から原因を釣り上げた。ペンさんが初めて口を開いた。「やるね」", trust: 8 },
        fail: { text: "夕方まで粘ったが原因は掴めず。それでも隣に居たことは覚えていてくれた。", trust: -2 },
      },
      {
        label: "自分の作業を続ける",
        baseRate: 0.7,
        success: { text: "担当分をきっちり進めた。障害はペンさんが仕留めたらしい。", trust: 0 },
        fail: { text: "後で「あのとき人手が欲しかった」と知った。少し悔しい。", trust: -4 },
      },
      {
        label: "周囲に声をかけて応援を集める",
        baseRate: 0.75,
        success: { text: "有識者が2人捕まった。障害対応は数だ。ペンさんも満足げ。", trust: 5 },
        fail: { text: "全員会議中だった。結局ペンさんと2人きり。", trust: -1 },
      },
    ],
  },
  {
    id: "c-server-cleanup",
    npc: "penguin",
    text: "ペンさんがディスク使用率98%のグラフを見せてきた。「消していいログ、わかる?」",
    choices: [
      {
        label: "一緒に調べてから消す",
        baseRate: 0.8,
        skillTag: "保守運用",
        success: { text: "安全に20GB確保。ペンさんが親指を立てた（ヒレだが）。", trust: 5 },
        fail: { text: "消したログが監査対象だったと後で判明。復元に奔走。", trust: -6 },
      },
      {
        label: "「たぶんこれです」と即答する",
        baseRate: 0.4,
        success: { text: "当たっていた。ペンさんは無言でうなずいた。", trust: 3 },
        fail: { text: "違うログだった。ペンさんの目が細くなった。", trust: -5 },
      },
    ],
  },
  {
    id: "c-docker-test",
    npc: "penguin",
    text: "「環境構築、Dockerでやっといて」とペンさん。スキルシートの「Docker: 実務経験あり」が試される日が来た。",
    choices: [
      {
        label: "堂々と構築する",
        baseRate: 0.45,
        skillTag: "Docker",
        success: { text: "compose一発で環境が立ち上がった。シートに嘘はなかった。", trust: 6 },
        fail: { text: "イメージのビルドが謎のエラーで止まった。冷や汗でキーボードが滑る。", trust: -5 },
      },
      {
        label: "昼休みにこっそり素振りしてから挑む",
        baseRate: 0.7,
        stamina: -10,
        success: { text: "素振りの成果が出た。準備は裏切らない。", trust: 5 },
        fail: { text: "素振りと本番は別物だった。ペンさんが静かに隣に座った。", trust: -3 },
      },
    ],
  },
  // ================= 共通（クジャク部長） =================
  {
    id: "c-color-change",
    npc: "peacock",
    text: "月末、クジャク部長が現れて羽をひろげた。「この画面、ぜんぶ青色に。今週中にできるかね」",
    choices: [
      {
        label: "影響範囲を説明して優先度を交渉する",
        baseRate: 0.65,
        skillTag: "顧客折衝",
        success: { text: "「ふむ、では来週で」羽が静かに閉じた。交渉成立。", trust: 7 },
        fail: { text: "「若いの、できない理由より、やる方法を」羽がさらに開いた。", trust: -4 },
      },
      {
        label: "集中作業で一気に対応する",
        baseRate: 0.7,
        stamina: -20,
        success: { text: "翌夕、画面は青くなっていた。部長は満足し、自分はへとへとになった。", trust: 6 },
        fail: { text: "急いだ作業でボタンを1つ消してしまった。青いが動かない画面が完成。", trust: -8 },
      },
      {
        label: "フクロPMにエスカレーションする",
        baseRate: 0.8,
        success: { text: "PM間で調整され、正式な変更依頼として次期対応に。大人の解決。", trust: 4 },
        fail: { text: "「本人に直接頼んだのだがね」部長の羽が不服そうに揺れた。", trust: -2 },
      },
    ],
  },
  {
    id: "c-peacock-praise",
    npc: "peacock",
    peaceful: true,
    text: "クジャク部長が視察に来た。「最近ここのチームは調子がいいらしいな」と機嫌がいい。",
    choices: [
      {
        label: "チームの成果としてアピールする",
        baseRate: 1,
        success: { text: "「うむ、チームワークは大事だ」羽が誇らしげに開いた。全員の株が上がった。", trust: 4 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "静かに頭を下げておく",
        baseRate: 1,
        success: { text: "礼儀正しさは伝わった。羽が小さく会釈した（ように見えた）。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-demo-request",
    npc: "peacock",
    text: "「来週、上に見せるデモを頼む」クジャク部長じきじきの依頼。まだ半分しかできていない機能で、だ。",
    choices: [
      {
        label: "できている範囲で筋のいいデモ台本を作る",
        baseRate: 0.75,
        success: { text: "動く半分だけを堂々と見せた。「順調だな」羽が満足げに揺れた。", trust: 7 },
        fail: { text: "デモ中、押してはいけないボタンを部長が押した。画面が白くなった。", trust: -6 },
      },
      {
        label: "残り半分をハリボテで用意する",
        baseRate: 0.5,
        stamina: -20,
        success: { text: "ハリボテは完璧に動いた（ように見えた）。デモは大成功。", trust: 6 },
        fail: { text: "「ここも触っていいか？」ハリボテの奥の白い画面が露出した。", trust: -8 },
      },
    ],
  },
  // ================= 共通（チュン太） =================
  {
    id: "c-shoryu-info",
    npc: "sparrow",
    peaceful: true,
    text: "チュン太が声をひそめて言った。「うちの商流、1個多いらしいっす」",
    choices: [
      {
        label: "詳しく聞く",
        baseRate: 1,
        success: { text: "業界の構造に詳しくなった。知識は身を守る。", trust: 1 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "「仕事しよっか」と流す",
        baseRate: 1,
        success: { text: "チュン太は「っすよね」と素直に画面に戻った。", trust: 1 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-sparrow-error",
    npc: "sparrow",
    text: "「先輩、これ見てもらっていいっすか」チュン太が謎のエラーで詰まっている。自分のタスクも山盛りだ。",
    choices: [
      {
        label: "15分だけ一緒に見る",
        baseRate: 0.75,
        skillTag: "メンバー育成",
        success: { text: "タイポだった。「まじ神っす」15分の投資で仲間の1日を救った。", trust: 5 },
        fail: { text: "15分では歯が立たない深いエラーだった。二人で沼に沈んだ。", trust: -3 },
      },
      {
        label: "「エラーメッセージでググった?」と自走を促す",
        baseRate: 0.6,
        success: { text: "「あ、一番上に答えありました」自走力が1上がった音がした。", trust: 3 },
        fail: { text: "1時間後、チュン太はまだ同じ画面の前にいた。最初から見ればよかった。", trust: -2 },
      },
    ],
  },
  {
    id: "c-sparrow-leaving",
    npc: "sparrow",
    text: "チュン太がぽつりと言った。「おれ、今月で現場変わるかもっす」。引き継ぎ相手は、たぶん自分だ。",
    choices: [
      {
        label: "今のうちに担当範囲を聞き出しておく",
        baseRate: 0.8,
        success: { text: "チュン太しか知らない設定が3つも発掘された。危なかった。", trust: 6 },
        fail: { text: "雑談で終わってしまった。引き継ぎ資料は「あとで書くっす」。", trust: -2 },
      },
      { label: "送別ランチの算段を始める", baseRate: 1, success: { text: "「まだ決まってないっすけどね!?」でも嬉しそうだった。", trust: 2 }, fail: { text: "", trust: 0 } },
    ],
  },
  // ================= 共通（ハチ子） =================
  {
    id: "c-meeting-storm",
    npc: "humming",
    text: "ハチ子が高速で3つの会議招集を置いていった。全部でると今日の開発時間が消える。",
    choices: [
      {
        label: "1つに絞って残りは議事録で追う",
        baseRate: 0.8,
        success: { text: "重要な1つで発言もできた。議事録で十分な2つだった。", trust: 5 },
        fail: { text: "欠席した会議で自分のタスクが決まっていた。議事録は3日後に届いた。", trust: -4 },
      },
      {
        label: "全部でる",
        baseRate: 0.45,
        stamina: -15,
        success: { text: "会議の合間の10分×3で今日のタスクを終わらせた。神業だった。", trust: 4 },
        fail: { text: "気づけば定時。今日書いたコードは0行だった。", trust: -5 },
      },
      {
        label: "「アジェンダをください」と返信する",
        baseRate: 0.65,
        skillTag: "顧客折衝",
        success: { text: "アジェンダのない会議が1つ消滅した。世界が少し良くなった。", trust: 6 },
        fail: { text: "「会議で説明します」と返ってきた。それを聞いている。", trust: -2 },
      },
    ],
  },
  {
    id: "c-status-sheet",
    npc: "humming",
    text: "ハチ子から新しい進捗管理シートが届いた。既存の3枚と合わせて4枚目である。",
    choices: [
      {
        label: "「1枚に統合しませんか」と提案する",
        baseRate: 0.55,
        skillTag: "要件定義",
        success: { text: "「それ！ずっと思ってました！」シートは1枚になり、現場に光が差した。", trust: 8 },
        fail: { text: "統合案を検討する会議が新たに設定された。本末転倒とはこのこと。", trust: -3 },
      },
      {
        label: "粛々と4枚更新する",
        baseRate: 0.9,
        success: { text: "コピペ職人の朝は早い。全シート更新完了。", trust: 2 },
        fail: { text: "1枚だけ更新を忘れ、ハチ子が高速で飛んできた。", trust: -3 },
      },
    ],
  },
  {
    id: "c-humming-praise",
    npc: "humming",
    peaceful: true,
    text: "ハチ子が珍しくホバリングを止めて言った。「あなたの報告、読みやすくて助かってます」",
    choices: [
      {
        label: "「ありがとうございます」と素直に受け取る",
        baseRate: 1,
        success: { text: "褒められると伸びるタイプなので、今日の報告はさらに読みやすい。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "報告フォーマットのコツを共有する",
        baseRate: 1,
        success: { text: "コツはチームのWikiに載った。良い文化がひとつ増えた。", trust: 4 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-spec-freeze",
    npc: "owl",
    text: "仕様凍結日。なのに「1個だけいい？」という小声の依頼が3方向から届いている。",
    choices: [
      {
        label: "全部フクロPMの裁定に回す",
        baseRate: 0.85,
        success: { text: "「凍結とは凍結である」PMの一言で全て来期送りに。仕組みが守ってくれた。", trust: 5 },
        fail: { text: "1件だけ「これは例外」と通ってしまった。例外は前例になる。", trust: -3 },
      },
      {
        label: "軽そうな1件だけこっそり入れる",
        baseRate: 0.4,
        success: { text: "誰にも気づかれず取り込めた。今回だけ、今回だけだ。", trust: 3 },
        fail: { text: "その1件がリグレッションを起こした。こっそりは、バレる。", trust: -7 },
      },
    ],
  },
  {
    id: "c-teiji-dash",
    npc: "chicken",
    peaceful: true,
    text: "今日は珍しく手が空いた。定時前の微妙な30分、トサカ先輩は既に帰り支度をしている。",
    choices: [
      {
        label: "明日の準備と机の整理をする",
        baseRate: 1,
        stamina: 10,
        success: { text: "明日の自分への申し送りが完璧に仕上がった。良い定時。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "気になっていた技術記事を読む",
        baseRate: 1,
        success: { text: "ちょうど今の現場で使えるTipsを拾った。インプットも仕事。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-turtle-excel",
    npc: "turtle",
    text: "カメ長老から渡された設計書は、Excel方眼紙だった。セル結合の海が広がっている。",
    choices: [
      {
        label: "郷に入っては郷に従い、方眼紙を極める",
        baseRate: 0.8,
        success: { text: "セル結合を崩さず追記する技を会得した。長老がにっこりした。", trust: 4 },
        fail: { text: "保存した瞬間、レイアウトが崩壊した。復元に1時間。", trust: -4 },
      },
      {
        label: "「Markdownに移行しませんか」と提案する",
        baseRate: 0.4,
        skillTag: "基本設計",
        success: { text: "「時代かのう」新規分だけMarkdown化が認められた。歴史的一歩。", trust: 7 },
        fail: { text: "「この形式で20年やっとる」方眼紙の壁は厚かった。", trust: -3 },
      },
    ],
  },
  {
    id: "c-vpn-down",
    npc: "penguin",
    text: "朝からVPNが繋がらない。リモートの自分は現場から切り離された島になった。",
    choices: [
      {
        label: "すぐ電話でペンさんに状況を伝える",
        baseRate: 0.85,
        success: { text: "全社障害と判明。第一報が早かったおかげでチームの混乱が最小で済んだ。", trust: 5 },
        fail: { text: "「再起動した?」…自分のルーターが原因だった。気まずい。", trust: -2 },
      },
      {
        label: "復旧を待ちながらローカルでできる作業を進める",
        baseRate: 0.7,
        success: { text: "オフラインでテストコードを書き溜めた。復旧後の自分が喜んだ。", trust: 4 },
        fail: { text: "昼まで待ったが復旧せず、進捗はほぼゼロ。先に言えばよかった。", trust: -4 },
      },
    ],
  },
  {
    id: "c-cert-expire",
    npc: "penguin",
    text: "ペンさんが静かにカレンダーを指した。SSL証明書の期限が、あさってで切れる。",
    choices: [
      {
        label: "更新手順を確認して先回りで申請する",
        baseRate: 0.8,
        skillTag: "保守運用",
        success: { text: "期限前日に無事更新。何も起きなかった。それが最高の仕事。", trust: 6 },
        fail: { text: "申請の承認者が出張中だった。ギリギリ滑り込んだが心臓に悪い。", trust: -1 },
      },
      {
        label: "「担当、自分でしたっけ…?」",
        baseRate: 0.5,
        success: { text: "担当はペンさんだった。だが一緒に確認したことは覚えていてくれた。", trust: 2 },
        fail: { text: "誰の担当でもなかった。それが一番こわい。当日は軽く騒ぎに。", trust: -5 },
      },
    ],
  },
  {
    id: "c-hanko-wait",
    npc: "peacock",
    text: "リリース承認のハンコが、クジャク部長の机の上で3日眠っている。リリースは明日だ。",
    choices: [
      {
        label: "秘書経由でそっとリマインドする",
        baseRate: 0.8,
        skillTag: "顧客折衝",
        success: { text: "「おお、忘れておった」羽を広げながら即決裁。根回しの勝利。", trust: 5 },
        fail: { text: "リマインドが本人に「催促」と伝わった。羽がちょっと逆立った。", trust: -3 },
      },
      {
        label: "直接デスクへ突撃する",
        baseRate: 0.55,
        success: { text: "「話が早いのは良いことだ」その場で決裁。度胸の勝利。", trust: 6 },
        fail: { text: "会議直前を直撃してしまった。「あとでな」ハンコはまだ眠っている。", trust: -4 },
      },
    ],
  },
  {
    id: "c-sparrow-tanka",
    npc: "sparrow",
    peaceful: true,
    text: "ランチでチュン太が声をひそめた。「ぶっちゃけ先輩の単価、いくらっすか」",
    choices: [
      {
        label: "「それは秘密」とかわす",
        baseRate: 1,
        success: { text: "「っすよね〜」代わりに業界の単価相場の話で盛り上がった。", trust: 1 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "相場観だけ語り合う",
        baseRate: 1,
        success: { text: "お互いの市場価値を高める作戦会議になった。前向きなランチ。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "c-humming-nolaptop",
    npc: "humming",
    text: "ハチ子主催の会議に呼ばれた。議題は「会議を減らすには」。皮肉ではないらしい。",
    choices: [
      {
        label: "定例の半分を非同期報告にする案を出す",
        baseRate: 0.7,
        skillTag: "チームリード",
        success: { text: "採用された。翌週から水曜の午後に静寂が戻った。英雄の誕生である。", trust: 8 },
        fail: { text: "「非同期だと温度感が…」温度感には勝てなかった。", trust: -2 },
      },
      {
        label: "静かに議事録係を買って出る",
        baseRate: 0.9,
        success: { text: "的確な議事録が「この会議は必要か」の判断材料になった。地味に効く仕事。", trust: 4 },
        fail: { text: "議論が白熱しすぎて議事録が追いつかなかった。", trust: -2 },
      },
    ],
  },
  // ================= テーマ限定 =================
  {
    id: "t-fin-dress",
    themes: ["finance"],
    npc: "chicken",
    peaceful: true,
    text: "明日は客先の役員説明に同席することに。トサカ先輩が「いちおうネクタイな」と言った。",
    choices: [
      {
        label: "クローゼットの奥から正装を発掘する",
        baseRate: 1,
        success: { text: "ビシッと決めた姿にトサカ先輩が「おっ、できる男」と大声で言った。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "この機会に一式そろえる",
        baseRate: 1,
        success: { text: "形から入るのも大事。背筋が伸びた気がする。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "t-emb-osc",
    themes: ["embedded"],
    npc: "penguin",
    text: "ペンさんがオシロスコープを指して言った。「波形、読める?」信号がどこかで化けている。",
    choices: [
      {
        label: "一緒に波形を追いかける",
        baseRate: 0.7,
        skillTag: "結合テスト",
        success: { text: "ノイズの入る瞬間を捉えた。「いい目してる」とペンさん。", trust: 6 },
        fail: { text: "波形は読めたが原因は別の基板だった。深い、組み込みは深い。", trust: -2 },
      },
      {
        label: "ソフト側のログから攻める",
        baseRate: 0.65,
        skillTag: "Python",
        success: { text: "ログ解析スクリプトが化けの瞬間を特定した。ソフト屋の意地。", trust: 6 },
        fail: { text: "ログには何も残っていなかった。ハードの世界は証拠を残さない。", trust: -3 },
      },
    ],
  },
  {
    id: "t-web-friday",
    themes: ["web"],
    npc: "penguin",
    text: "金曜17時。「これ、今日中に出せる?」の声。ペンさんが静かに首を横に振っている。",
    choices: [
      {
        label: "「月曜朝イチで出しましょう」と提案する",
        baseRate: 0.8,
        skillTag: "本番リリース",
        success: { text: "「それもそうか」金曜の夜とサービスの平和が守られた。", trust: 6 },
        fail: { text: "「今日中で」押し切られた。せめてロールバック手順を磨いて備えた。", trust: -2 },
      },
      {
        label: "出す。金曜デプロイの伝説に挑む",
        baseRate: 0.45,
        stamina: -15,
        success: { text: "何も起きなかった。ペンさんが無言で親指を立てた。二度とやらないが。", trust: 5 },
        fail: { text: "18時30分、アラートが鳴った。金曜デプロイ、ダメ絶対。", trust: -8 },
      },
    ],
  },
  {
    id: "t-ec-photo",
    themes: ["ec"],
    npc: "humming",
    text: "「商品画像、全部で800点、明日のセールまでに差し替えです」ハチ子が高速で通達していった。",
    choices: [
      {
        label: "一括変換スクリプトを書く",
        baseRate: 0.7,
        skillTag: "PHP",
        success: { text: "20分のスクリプトが8時間の手作業を消した。エンジニアの本懐。", trust: 7 },
        fail: { text: "スクリプトが3点だけ縦横比を壊した。よりによってセール目玉商品を。", trust: -4 },
      },
      {
        label: "チーム総出の手作業に加わる",
        baseRate: 0.8,
        stamina: -15,
        success: { text: "全員で黙々と差し替えて完走。妙な連帯感が生まれた。", trust: 4 },
        fail: { text: "夕方、集中力が切れて差し替えミスが混入した。", trust: -3 },
      },
    ],
  },
  {
    id: "t-gov-nengou",
    themes: ["gov"],
    npc: "turtle",
    text: "テストデータの日付が全部和暦だった。カメ長老いわく「西暦はハイカラすぎる」とのこと。",
    choices: [
      {
        label: "和暦⇔西暦の変換ユーティリティを整備する",
        baseRate: 0.75,
        skillTag: "Java",
        success: { text: "改元にも耐える変換部品が生まれ、チームの共有財産になった。", trust: 6 },
        fail: { text: "昭和64年1月7日の境界処理で沼にはまった。和暦、奥が深い。", trust: -3 },
      },
      {
        label: "既存の変換処理を探して使う",
        baseRate: 0.7,
        success: { text: "カメ長老の甲羅（過去資産）から完璧な変換モジュールが発掘された。", trust: 4 },
        fail: { text: "見つけた変換処理が平成までしか対応していなかった。", trust: -3 },
      },
    ],
  },
  {
    id: "t-fin-seisan",
    themes: ["finance"],
    npc: "owl",
    text: "今月の稼働、精算幅の下限140hを割りそうだとフクロPMが真顔で言っている。",
    choices: [
      {
        label: "残タスクの巻き取りを申し出る",
        baseRate: 0.8,
        success: { text: "テスト消化を巻き取って下限クリア。「助かる」と低い声。", trust: 6 },
        fail: { text: "巻き取ったタスクが想像の3倍重かった。稼働は超過側に振り切れた。", trust: -3 },
      },
      {
        label: "「暇です」と正直に言う",
        baseRate: 0.5,
        success: { text: "改善タスクを貰えた。正直は時に得をする。", trust: 3 },
        fail: { text: "翌週、隣のチームの応援に貸し出された。", trust: -3 },
      },
    ],
  },
  {
    id: "t-fin-audit",
    themes: ["finance", "gov"],
    npc: "peacock",
    text: "監査の季節が来た。クジャク部長が「アクセスログの提出を」と羽で指し示している。",
    choices: [
      {
        label: "手順書どおりに証跡を揃える",
        baseRate: 0.8,
        skillTag: "保守運用",
        success: { text: "完璧な証跡一式。「ここのチームは信頼できる」羽が満足げに閉じた。", trust: 6 },
        fail: { text: "1ファイルだけ命名規則が違った。差し戻しの羽が開いた。", trust: -4 },
      },
      {
        label: "前回の提出物をベースに流用する",
        baseRate: 0.55,
        success: { text: "効率よく完成。先人の遺産に感謝。", trust: 3 },
        fail: { text: "前回の日付が残ったまま提出してしまった。気まずい。", trust: -6 },
      },
    ],
  },
  {
    id: "t-ec-sale",
    themes: ["ec"],
    npc: "owl",
    text: "明日は年に一度のビッグセール。フクロPMが当日の監視シフト表を眺めている。",
    choices: [
      {
        label: "朝イチの監視シフトに志願する",
        baseRate: 0.7,
        skillTag: "障害対応",
        stamina: -15,
        success: { text: "ピーク時アクセス10倍を無事故で乗り切った。戦友の絆が生まれた。", trust: 8 },
        fail: { text: "昼のピークでカートが詰まった。冷や汗の復旧作業になった。", trust: -3 },
      },
      {
        label: "日中の増強対応に回る",
        baseRate: 0.8,
        success: { text: "事前のキャッシュ増強が効いた。備えあれば憂いなし。", trust: 5 },
        fail: { text: "増強した箇所とは別のところが詰まった。世の中そんなもの。", trust: -3 },
      },
    ],
  },
  {
    id: "t-ec-review",
    themes: ["ec"],
    npc: "sparrow",
    text: "「やばいっす、レビュー星1ついてます」チュン太が画面を見せてきた。決済エラーの報告だった。",
    choices: [
      {
        label: "再現手順を特定して即修正する",
        baseRate: 0.65,
        skillTag: "PHP",
        success: { text: "特定条件のポイント併用バグだった。即日修正、星は4に戻った。", trust: 7 },
        fail: { text: "再現しない。「自分の環境では動くんすけどね」二人で首をひねる。", trust: -4 },
      },
      {
        label: "まずCSチームに状況を共有する",
        baseRate: 0.8,
        success: { text: "CS経由で詳細な発生条件が取れた。連携プレーの勝利。", trust: 5 },
        fail: { text: "共有した頃には星1が3件に増えていた。初動が全て。", trust: -3 },
      },
    ],
  },
  {
    id: "t-emb-jikki",
    themes: ["embedded"],
    npc: "penguin",
    text: "実機が1台しかないのに、検証待ちが3人並んでいる。ペンさんが実機の前で仁王立ちしている。",
    choices: [
      {
        label: "予約表を作って回す",
        baseRate: 0.85,
        success: { text: "手書きの予約表が現場の平和を守った。仕組みは偉大。", trust: 6 },
        fail: { text: "予約表を無視する猛者が現れた。世紀末である。", trust: -2 },
      },
      {
        label: "エミュレータで先に検証を進める",
        baseRate: 0.6,
        skillTag: "Python",
        success: { text: "実機待ちゼロでログ解析まで完了。スマートな回避。", trust: 5 },
        fail: { text: "エミュレータでは通ったのに実機で落ちた。それが組み込み。", trust: -4 },
      },
    ],
  },
  {
    id: "t-emb-noise",
    themes: ["embedded"],
    npc: "turtle",
    text: "「再現しないバグはな、だいたい配線かノイズじゃよ」カメ長老が実機の裏の配線を見つめている。",
    choices: [
      {
        label: "長老と一緒に配線を1本ずつ確認する",
        baseRate: 0.8,
        success: { text: "緩んだコネクタが1つ。バグは物理だった。長老の目が光る。", trust: 6 },
        fail: { text: "配線は完璧だった。バグはコードの中に居た。長老は「ふむ」と一言。", trust: -2 },
      },
      {
        label: "ログを増やして気長に待ち構える",
        baseRate: 0.65,
        success: { text: "3日後、ついに尻尾を掴んだ。粘り勝ち。", trust: 5 },
        fail: { text: "ログを増やしたらタイミングが変わってバグが消えた。忘れた頃に再発するやつだ。", trust: -3 },
      },
    ],
  },
  {
    id: "t-gov-hanko",
    themes: ["gov"],
    npc: "turtle",
    text: "設計書の誤字1文字の修正に、承認印が3つ必要だと判明した。カメ長老は「そういうものじゃ」と動じない。",
    choices: [
      {
        label: "手順に従い粛々と回付する",
        baseRate: 0.9,
        success: { text: "2週間後、誤字は正式に修正された。ローマは一日にして成らず。", trust: 4 },
        fail: { text: "承認ルートの1人が長期休暇だった。誤字はまだそこにいる。", trust: -2 },
      },
      {
        label: "次回改版でまとめて直す提案をする",
        baseRate: 0.7,
        skillTag: "顧客折衝",
        success: { text: "「合理的じゃな」修正候補リストという新しい運用が生まれた。", trust: 6 },
        fail: { text: "「前例がない」の一言で却下された。前例は今作るものでは…。", trust: -3 },
      },
    ],
  },
  {
    id: "t-gov-madoguchi",
    themes: ["gov"],
    npc: "owl",
    text: "リリースは日曜の朝6時、市役所の窓口が開く前に完了せよ、との指令が来た。",
    choices: [
      {
        label: "前日リハーサルを提案して備える",
        baseRate: 0.85,
        skillTag: "本番リリース",
        success: { text: "リハで手順書の穴を2つ潰した。当日は5時50分に完了。完璧。", trust: 7 },
        fail: { text: "リハは完璧だったのに、当日だけ回線が遅かった。6時10分、窓口に間に合ったのが救い。", trust: -2 },
      },
      {
        label: "ぶっつけ本番に賭ける",
        baseRate: 0.4,
        success: { text: "何事もなく完了。だが二度とやりたくない。", trust: 3 },
        fail: { text: "6時、手順の途中で朝日が昇った。窓口開放は30分遅れた。", trust: -8 },
      },
    ],
  },
  {
    id: "t-web-pr",
    themes: ["web"],
    npc: "humming",
    text: "自分のプルリクに、社員エンジニアから鋭いレビューコメントが12件ついた。",
    choices: [
      {
        label: "1件ずつ意図を確認しながら直す",
        baseRate: 0.85,
        skillTag: "TypeScript",
        success: { text: "議論の末、3件は自分の設計が採用された。レビューは戦いではなく対話。", trust: 6 },
        fail: { text: "議論が白熱しすぎて1日が溶けた。楽しかったのが救い。", trust: -2 },
      },
      {
        label: "全部言われたとおりに直す",
        baseRate: 0.7,
        success: { text: "素直さも才能。マージされ、次のレビューは6件に減った。", trust: 3 },
        fail: { text: "言われたとおり直したら別の箇所が壊れた。「意図、確認してもろて」", trust: -4 },
      },
    ],
  },
  {
    id: "t-web-hackathon",
    themes: ["web"],
    npc: "sparrow",
    peaceful: true,
    text: "「金曜の社内ハッカソン、常駐メンバーも出ていいらしいっすよ」チュン太が目を輝かせている。",
    choices: [
      {
        label: "チュン太と組んで出る",
        baseRate: 1,
        stamina: -10,
        success: { text: "作った小ネタツールが3位入賞。社員との距離がぐっと縮まった。", trust: 5 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "観客として応援にまわる",
        baseRate: 1,
        success: { text: "発表を見ているだけで技術の引き出しが増えた。良い金曜日。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },

  // ================= きおくの現場: 計算センター（1960-70年代） =================
  {
    id: "pc-box-drop",
    themes: ["punchcard"],
    npc: "tsuru",
    text: "廊下で先輩が転んだ。3000枚のパンチカードが宙を舞う。順序が命のカードたちだ。ツルさんが静かに聞いた。「箱に斜線、引いといたかい」",
    choices: [
      {
        label: "斜線を頼りに、みんなで並べ直す",
        baseRate: 0.8,
        success: { text: "束の側面の斜線が道しるべになった。1時間で復旧。先人の知恵、恐るべし。", trust: 6 },
        fail: { text: "斜線のない束が1つあった。その束だけ、夜までかかった。", trust: -3 },
      },
      {
        label: "ソーター（分類機）の空きを取りに走る",
        baseRate: 0.65,
        success: { text: "連番欄を頼りに機械で分類。ガシャンガシャンと小気味よく直っていく。", trust: 5 },
        fail: { text: "ソーターは今夜の給与計算で埋まっていた。「人間ソーターの出番だね」", trust: -2 },
      },
      {
        label: "徹夜で手作業の並べ直しを引き受ける",
        baseRate: 0.7,
        stamina: -18,
        success: { text: "朝までに全束復旧。先輩が涙目で何度も頭を下げた。", trust: 8 },
        fail: { text: "夜明け前、集中力が切れて自分も束を崩した。悪夢の連鎖。", trust: -5 },
      },
    ],
  },
  {
    id: "pc-verify",
    themes: ["punchcard"],
    npc: "tsuru",
    text: "きょうの仕事は検孔（ベリファイ）。昨日打ったカードと同じ伝票をもう一度打ち、機械が食い違いを検出する。単調さとの戦いだ。",
    choices: [
      {
        label: "リズムを作って淡々と打ち続ける",
        baseRate: 0.8,
        success: { text: "夕方までノーミス。ツルさんが「いい耳をしてる」と褒めた。打鍵は音楽らしい。", trust: 5 },
        fail: { text: "午後、リズムが崩れて誤打が続いた。単調は、強敵。", trust: -3 },
      },
      {
        label: "30分ごとに小休止を挟んで精度を保つ",
        baseRate: 0.85,
        success: { text: "休み方も技術のうち。検出された食い違いはすべて元伝票の側のミスだった。", trust: 4 },
        fail: { text: "休憩のたびに調子が戻らず、かえって効率が落ちた。", trust: -2 },
      },
    ],
  },
  {
    id: "pc-real-bug",
    themes: ["punchcard"],
    npc: "turtle",
    text: "計算機が突然止まった。カメ長老（まだ甲羅が小さい）がリレー室の奥を指す。「……見てごらん。本物の虫だ」。接点に蛾が挟まっている。",
    choices: [
      {
        label: "ピンセットで慎重に取り除く",
        baseRate: 0.75,
        skillTag: "障害対応",
        success: { text: "無事に除去、計算機は再び唸り始めた。「これがバグ取りの語源だぞ」と長老。", trust: 6 },
        fail: { text: "手が滑って接点を曲げた。技師さんが呼ばれ、こってり絞られた。", trust: -4 },
      },
      {
        label: "作業日誌に「バグ発見」と記録してから対処する",
        baseRate: 0.8,
        success: { text: "「記録を先にするのは良い癖だ」。日誌の1行が、後の障害調査で役に立った。", trust: 5 },
        fail: { text: "記録に時間をかけすぎた。「虫より先に計算を生かしておくれ」", trust: -2 },
      },
    ],
  },
  {
    id: "pc-sorter-queue",
    themes: ["punchcard"],
    npc: "peacock",
    text: "月末。ソーターも計算機も予約でいっぱいだ。電算室長のクジャク部長が羽を広げる。「割り込みたいなら、理由を聞こうか」",
    choices: [
      {
        label: "給与計算より先に終わる小さな処理だと数字で示す",
        baseRate: 0.7,
        skillTag: "顧客折衝",
        success: { text: "「15分で返すなら」と割り込み許可。数字は偉い人に効く、いつの時代も。", trust: 6 },
        fail: { text: "見積もりが甘く20分かかった。羽をたたむ音が部屋に響いた。", trust: -5 },
      },
      {
        label: "深夜の空き枠に自分から回る",
        baseRate: 0.8,
        stamina: -12,
        success: { text: "誰も取り合わない枠は静かで良い。仕事も進んだ。", trust: 4 },
        fail: { text: "深夜、装置の暖機に手間取り枠を使い切った。", trust: -3 },
      },
      {
        label: "順番を待ちつつ、伝票の下ごしらえを進める",
        baseRate: 0.85,
        success: { text: "待ち時間がゼロにならないなら、待ち時間の仕事を作ればいい。段取り勝ち。", trust: 4 },
        fail: { text: "下ごしらえに没頭して、順番が来たのを聞き逃した。", trust: -2 },
      },
    ],
  },
  {
    id: "pc-one-typo",
    themes: ["punchcard"],
    npc: "tsuru",
    text: "朝、青い顔の技師が駆け込んできた。「昨夜の給与計算、1桁ずれてる」。原因はカード1枚の穿孔ミスらしい。数千枚から1枚を探す。",
    choices: [
      {
        label: "計算結果の側から逆算して範囲を絞る",
        baseRate: 0.7,
        skillTag: "結合テスト",
        success: { text: "ずれ方から部署を特定、20分で1枚を発見。「探し方が現代的だねえ」とツルさん。", trust: 7 },
        fail: { text: "逆算を誤って別の部署の束を総ざらいしてしまった。", trust: -4 },
      },
      {
        label: "検孔記録を頼りに未照合の束から当たる",
        baseRate: 0.75,
        success: { text: "検孔を飛ばした束が1つだけあった。そこにいた。手順は裏切らない。", trust: 5 },
        fail: { text: "記録の字が読めない。昭和の手書きは手強い。", trust: -3 },
      },
    ],
  },
  {
    id: "pc-aircon",
    themes: ["punchcard"],
    npc: "turtle",
    text: "電算室は今日も凍えるほど寒い。冷房は計算機様のためのもので、人間は毛布持参だ。見学に来た重役が「贅沢な部屋だ」と勘違いしている。",
    choices: [
      {
        label: "「機械のための温度です」と丁寧に説明する",
        baseRate: 0.75,
        success: { text: "重役は感心して帰った。翌週、人間用のひざ掛けが支給された。小さな勝利。", trust: 5 },
        fail: { text: "説明が専門的すぎて伝わらなかった。「若いのに難しい話をするね」", trust: -2 },
      },
      {
        label: "黙って毛布を貸してさしあげる",
        baseRate: 0.85,
        success: { text: "毛布にくるまった重役が「これは現場に手当が要るな」と呟いた。行動は言葉より強い。", trust: 4 },
        fail: { text: "毛布が1枚しかなく、自分が凍えた。", trust: -1 },
      },
    ],
  },
  {
    id: "pc-rooftop",
    themes: ["punchcard"],
    npc: "tsuru",
    peaceful: true,
    text: "昼休み、ツルさんに誘われて屋上へ。弁当を広げると、眼下の街には電線と、建設中のビルばかり。「この街の計算を、ぜんぶウチが預かってるんだよ」",
    choices: [
      {
        label: "ツルさんの昔語りに耳を傾ける",
        baseRate: 1,
        success: { text: "「そろばんから機械に変わる時もね、大騒ぎだったの」。変化はいつも二度目らしい。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "使い終わったカードの行き先を聞いてみる",
        baseRate: 1,
        success: { text: "「メモ帳にしたり、しおりにしたり」。ポケットから穿孔済みのしおりが出てきた。もらった。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "pc-farewell-machine",
    themes: ["punchcard"],
    npc: "peacock",
    peaceful: true,
    text: "旧型の統計機が今日で引退し、新しい計算機が搬入される。電算室のみんなが機械の前に集まって、なぜか自然と拍手が起きた。",
    choices: [
      {
        label: "一緒に拍手で見送る",
        baseRate: 1,
        success: { text: "十年働いた機械への拍手。道具に礼を言う文化は、この部屋から始まった気がする。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "銘板をスケッチして日誌に残す",
        baseRate: 1,
        success: { text: "「あんた、記録屋の素質があるよ」とツルさん。日誌の隅に機械の似顔絵が残った。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },

  // ================= きおくの現場: 汎用機の間（1980年代） =================
  {
    id: "mf-tape-swap",
    themes: ["mainframe"],
    npc: "penguin",
    text: "23時。夜間バッチの指示書には「JOB07終了後、テープ13番に交換」。ペンさん（当時から黒い画面の住人）が無言でリールを指差した。",
    choices: [
      {
        label: "ラベルを指差し確認してから掛け替える",
        baseRate: 0.85,
        success: { text: "「13番、よし」。指差しの声が誰もいない機械室に響く。バッチは静かに次へ進んだ。", trust: 5 },
        fail: { text: "指差した先のラベルが薄れて読めなかった。予備のリストと突き合わせて事なきを得たが、冷や汗。", trust: -2 },
      },
      {
        label: "先に全テープの並びを確認しておく",
        baseRate: 0.75,
        skillTag: "保守運用",
        success: { text: "並び順の誤りを1本発見。事前確認が夜間の事故を未然に防いだ。", trust: 7 },
        fail: { text: "確認中にJOB07が終わってしまい、交換が遅れて後続が待ち状態に。", trust: -3 },
      },
    ],
  },
  {
    id: "mf-jcl-abend",
    themes: ["mainframe"],
    npc: "turtle",
    text: "朝、夜間バッチがABENDしていた。カメ長老がJCLを睨む。「……カンマが1つ、多いの」。修正して今夜再実行するしかない。",
    choices: [
      {
        label: "再実行の手順書を書いてから直す",
        baseRate: 0.8,
        success: { text: "「手順を紙にする者は信用できる」。長老が甲羅から秘蔵の再実行ノウハウを出してくれた。", trust: 6 },
        fail: { text: "手順書に別の誤字が混入。「紙も裏切ることがあるのう」", trust: -3 },
      },
      {
        label: "類似のJCL全部を点検する",
        baseRate: 0.65,
        stamina: -10,
        success: { text: "同じ癖のカンマを3箇所発見。将来のABENDを3回分予防した。", trust: 8 },
        fail: { text: "点検範囲が広すぎて日が暮れた。本命の修正が雑になりかけて長老に止められた。", trust: -4 },
      },
    ],
  },
  {
    id: "mf-pocket-bell",
    themes: ["mainframe"],
    npc: "penguin",
    text: "深夜2時、枕元のポケベルが鳴った。表示は「0840」——オペレーターの緊急コールだ。公衆電話まで走るしかない。",
    choices: [
      {
        label: "走る。小銭は枕元に用意してある",
        baseRate: 0.8,
        stamina: -15,
        success: { text: "10円玉3枚で状況把握、指示を伝えて復旧。準備がいい者だけが夜を制す。", trust: 7 },
        fail: { text: "電話口で伝えた再実行手順が1つ抜けていた。朝、青い顔で出勤した。", trust: -5 },
      },
      {
        label: "電話の前に障害内容を予想して手を打っておく",
        baseRate: 0.6,
        skillTag: "障害対応",
        success: { text: "予想的中、電話一本で的確に指示。「……できるな」とペンさんが小さく言った。", trust: 8 },
        fail: { text: "予想が外れ、見当違いの指示で30分を失った。", trust: -6 },
      },
    ],
  },
  {
    id: "mf-copy-master",
    themes: ["mainframe"],
    npc: "turtle",
    text: "COBOLの帳票プログラムを任された。カメ長老が分厚い緑の用紙の束をめくる。「コピー句はな、書いた者の人柄が出るんじゃ」",
    choices: [
      {
        label: "長老の書いたコピー句を読み込んで真似る",
        baseRate: 0.8,
        success: { text: "桁位置の揃え方ひとつに理由があった。読めるコードは、思いやりでできている。", trust: 6 },
        fail: { text: "真似たつもりが桁ずれ。帳票の余白に長老の赤ペンが走った。", trust: -3 },
      },
      {
        label: "現代の流儀で整理して書いてみる",
        baseRate: 0.6,
        success: { text: "「ほう、未来の書き方か」。長老が眼鏡を上げて熟読し、一部を採用してくれた。", trust: 7 },
        fail: { text: "この時代のコンパイラには通らない書き方だった。「気持ちはわかるがの」", trust: -4 },
      },
    ],
  },
  {
    id: "mf-paper-jam",
    themes: ["mainframe"],
    npc: "tsuru",
    text: "ラインプリンタが月末の請求書2万枚を打ち出している。突然、ガリッと嫌な音。紙詰まりだ。止まった分だけ発送が遅れる。",
    choices: [
      {
        label: "手順どおり慎重に詰まりを取り除く",
        baseRate: 0.8,
        success: { text: "破れ紙を残さず除去、印字位置も再調整。「紙の機嫌が取れれば一人前だよ」", trust: 5 },
        fail: { text: "焦って引き抜き、印字ヘッドの位置がずれた。技師待ちで1時間停止。", trust: -4 },
      },
      {
        label: "詰まった帳票の番号を控えてから再開する",
        baseRate: 0.85,
        success: { text: "欠番リストのおかげで再印字は最小限。発送台車は定時に出た。", trust: 6 },
        fail: { text: "控えた番号が1つずれていて、二重発送しかけた。検品係に拾われて事なきを得る。", trust: -3 },
      },
    ],
  },
  {
    id: "mf-dasd-full",
    themes: ["mainframe"],
    npc: "penguin",
    text: "「DASDの空きが今夜もたない」とペンさん。ディスクは金庫より高価な時代。消せるものを探して容量をひねり出すしかない。",
    choices: [
      {
        label: "世代管理の古い世代から整理する",
        baseRate: 0.8,
        skillTag: "保守運用",
        success: { text: "規約どおり3世代残して整理。夜間バッチは無事に走り切った。", trust: 6 },
        fail: { text: "「消していい」と言われた世代が、実は監査用だった。テープから書き戻す羽目に。", trust: -6 },
      },
      {
        label: "各課に不要ファイルの棚卸しを頼んで回る",
        baseRate: 0.65,
        success: { text: "「いつか使う」の山から本当の不要品が大量に出た。人間の棚卸しがいちばん効く。", trust: 5 },
        fail: { text: "どの課も「ぜんぶ要る」の一点張り。日が暮れた。", trust: -2 },
      },
    ],
  },
  {
    id: "mf-warm-room",
    themes: ["mainframe"],
    npc: "tsuru",
    peaceful: true,
    text: "機械室は今日も寒い。休憩室に入ると、ツルさんが魔法瓶の熱いお茶を注いでくれた。「機械の間で働く者は、体温で苦労するのよね」",
    choices: [
      {
        label: "お茶をもらって温まる",
        baseRate: 1,
        success: { text: "湯呑みから立つ湯気。機械の唸りが遠くに聞こえる。悪くない夜勤だ。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "ツルさんの若い頃の失敗談を聞く",
        baseRate: 1,
        success: { text: "「テープを逆巻きにしてね……」笑い話になるまで20年かかったらしい。失敗は熟成する。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "mf-manual-notes",
    themes: ["mainframe"],
    npc: "turtle",
    peaceful: true,
    text: "書棚の分厚い紙マニュアルをめくると、歴代の担当者の書き込みがびっしり。「ここ罠」「S0C7はまずデータを疑え」——時を超えた申し送りだ。",
    choices: [
      {
        label: "書き込みを読みふける",
        baseRate: 1,
        success: { text: "何十年も前の「ここ罠」に今日も救われる。ドキュメント文化の原風景を見た。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "自分も後世への書き込みを残す",
        baseRate: 1,
        success: { text: "余白に一言添えた。この1行が、いつか誰かの徹夜を1つ減らすかもしれない。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
    ],
  },

  // ================= きおくの現場: 2000年対策室（1999年） =================
  {
    id: "yk-grep-date",
    themes: ["y2k"],
    npc: "owl",
    text: "対策室の初日。フクロPM（当時は現役バリバリ）が印刷されたソース一覧の山を置いた。「日付を触る処理に、すべて印を。見落とし1つが事故1つだ」",
    choices: [
      {
        label: "検索条件を工夫して機械的に洗い出す",
        baseRate: 0.75,
        success: { text: "「DATE」以外に「YMD」「NENGETSU」変数も網にかけた。命名の癖まで読むのが調査だ。", trust: 6 },
        fail: { text: "ローマ字命名「HIZUKE」を見落とした。翌日の突き合わせで発覚。", trust: -4 },
      },
      {
        label: "一覧を分担して目視で潰していく",
        baseRate: 0.7,
        stamina: -10,
        success: { text: "目視班の意地。機械検索が拾えない「間接的に日付を使う処理」を2件見つけた。", trust: 5 },
        fail: { text: "夕方には目が霞み、印の位置が1行ずれていた。", trust: -3 },
      },
    ],
  },
  {
    id: "yk-99-flag",
    themes: ["y2k"],
    npc: "chicken",
    text: "トサカ先輩が変なコードを見つけた。「年が『99』のとき、これ『未定』って意味で使ってるぞ……」。2桁年の節約が生んだ、恐ろしい多義語だ。",
    choices: [
      {
        label: "「99」の用法を全部台帳に分類する",
        baseRate: 0.7,
        success: { text: "「年の99」「未定の99」「テストの99」——3つの99を仕分けた台帳がチームの宝になった。", trust: 7 },
        fail: { text: "分類の境界が曖昧で、台帳が逆に混乱を呼んだ。", trust: -3 },
      },
      {
        label: "元の設計者を探して意図を確認する",
        baseRate: 0.6,
        skillTag: "顧客折衝",
        success: { text: "退職した設計者に電話が繋がった。「ああ、それはね」——一次情報がすべてを解決した。", trust: 8 },
        fail: { text: "設計者は海外赴任中。国際電話の時差で今日は掴まらなかった。", trust: -2 },
      },
    ],
  },
  {
    id: "yk-19100",
    themes: ["y2k"],
    npc: "penguin",
    text: "テスト環境の日付を2000年1月1日に進めた瞬間、画面の年表示が「19100年」になった。ペンさんが静かにメモを取る。「……西暦5桁。ロマンはあるな」",
    choices: [
      {
        label: "表示ロジックの「19+2桁」連結を修正する",
        baseRate: 0.8,
        success: { text: "原因は文字列連結だった。19100年から現代へ、無事に帰還。", trust: 6 },
        fail: { text: "直した先で今度は「1900年」に。時空の狭間で二晩さまよった。", trust: -4 },
      },
      {
        label: "同じ連結パターンを全画面から探す",
        baseRate: 0.7,
        skillTag: "結合テスト",
        success: { text: "帳票にも同じ罠が3つ。画面で見つけたバグは、紙にも棲んでいる。", trust: 7 },
        fail: { text: "探索範囲が広がりすぎて、本命の修正が翌日に持ち越された。", trust: -3 },
      },
    ],
  },
  {
    id: "yk-family-call",
    themes: ["y2k"],
    npc: "tsuru",
    text: "世間はノストラダムスと2000年問題で大騒ぎ。実家から対策室に電話が来た。「あんたの仕事、大丈夫なの？　飛行機が落ちるってテレビで……」",
    choices: [
      {
        label: "「そのために僕らが調べてるんだよ」と説明する",
        baseRate: 0.85,
        success: { text: "「あんたが言うなら安心だね」。世界の不安を1つ減らした。仕事の意味を実感する。", trust: 4 },
        fail: { text: "説明が長くなりすぎて「難しい仕事なのね」で切られた。", trust: -1 },
      },
      {
        label: "「万一に備えて水は買っておいて」と現実的に返す",
        baseRate: 0.8,
        success: { text: "備えは科学、パニックは無知から。ツルさんが「良い答えだ」と頷いた。", trust: 4 },
        fail: { text: "翌週、実家に水が30箱届いたと連絡が来た。買いすぎである。", trust: -1 },
      },
    ],
  },
  {
    id: "yk-leap-2000",
    themes: ["y2k"],
    npc: "chicken",
    text: "「2000年は閏年か？」会議が紛糾している。100で割れる年は平年、でも400で割れる年は閏年——2000年はどっちだ。トサカ先輩がこっちを見た。",
    choices: [
      {
        label: "「400で割れるので閏年です」と即答する",
        baseRate: 0.85,
        success: { text: "正解。しかも「100年ルールだけ実装したシステムが世界に結構ある」と付け加えて場を締めた。", trust: 6 },
        fail: { text: "答えは合っていたが説明の途中でこんがらがり、ホワイトボードが樹形図になった。", trust: -2 },
      },
      {
        label: "2月29日のテストケースを黙って追加する",
        baseRate: 0.8,
        success: { text: "議論より検証。2000-02-29のテストが3システムで閏年バグを検出した。", trust: 7 },
        fail: { text: "テスト環境の日付変更に失敗し、検証は明日へ。会議は結論なしで散会した。", trust: -3 },
      },
    ],
  },
  {
    id: "yk-eve-room",
    themes: ["y2k"],
    npc: "owl",
    text: "1999年12月31日 23時50分。対策室のテレビは年越し番組を映しているが、誰も見ていない。全員が時計と監視端末を見ている。",
    choices: [
      {
        label: "チェックリストを最終確認して0時を待つ",
        baseRate: 0.85,
        success: { text: "0:00。……何も起きない。誰かが小さく拍手し、それが部屋中に広がった。", trust: 8 },
        fail: { text: "0:03、1台の端末で日付表示だけが狂った。実害なし——リストの想定内。淡々と対処した。", trust: 3 },
      },
      {
        label: "緊張する新人に缶コーヒーを配って回る",
        baseRate: 0.85,
        skillTag: "チームリード",
        success: { text: "「配る係」がいるチームは強い。0時、温かい缶を握ったまま全員で無事を見届けた。", trust: 6 },
        fail: { text: "配り終える前に0時が来た。何も起きなかったので、それはそれで良し。", trust: 2 },
      },
    ],
  },
  {
    id: "yk-quiet-hero",
    themes: ["y2k"],
    npc: "owl",
    peaceful: true,
    text: "年明けの世間は「結局何も起きなかったじゃないか」ムード。フクロPMがぽつりと言った。「何も起きないように働いた者の名は、新聞に載らない」",
    choices: [
      {
        label: "「それでいい仕事だったと思います」と返す",
        baseRate: 1,
        success: { text: "PMの目が細くなった（微笑の表現）。「その感覚を、次の現場にも持っていけ」", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "対策室の記録を綴じて保管庫に納める",
        baseRate: 1,
        success: { text: "誰も読まないかもしれない記録。でも、確かに世界を支えた仕事の証拠だ。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "yk-soba",
    themes: ["y2k"],
    npc: "tsuru",
    peaceful: true,
    text: "大晦日の対策室に、ツルさんがカップの年越しそばを人数分抱えてきた。「歳を越す仕事なんて、そうそうないよ。記念に食べときな」",
    choices: [
      {
        label: "みんなで啜る",
        baseRate: 1,
        success: { text: "監視端末の前で啜るそばの味は、二十年経っても語り草になる味だった。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "お湯を注ぐ係を買って出る",
        baseRate: 1,
        success: { text: "給湯室を3往復。そばの手配ができる者は、障害対応の手配もできる。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },

  // ================= きおくの現場: ケータイ公式サイト（2000年代） =================
  {
    id: "im-emoji-map",
    themes: ["imode"],
    npc: "sparrow",
    text: "「ハートの絵文字が、あっちのキャリアだと『〓』になるんです！」クレームの電話。チュン太が手作りの3キャリア絵文字対応表をバサッと広げた。",
    choices: [
      {
        label: "対応表を睨んで変換処理を直す",
        baseRate: 0.75,
        success: { text: "ハートは無事3社でハートになった。この対応表、国宝級では。", trust: 6 },
        fail: { text: "直した先で今度は星が音符になった。絵文字の海は深い。", trust: -3 },
      },
      {
        label: "対応表にない絵文字の変換ルールを決めて文書化する",
        baseRate: 0.7,
        skillTag: "詳細設計",
        success: { text: "「対応なし絵文字は『（ハート）』表記」——ルール1行が今後のクレームを何十件も防ぐ。", trust: 7 },
        fail: { text: "ルール案が会議で紛糾。「（ハート）はときめかない」と真剣に議論された。", trust: -2 },
      },
    ],
  },
  {
    id: "im-pakeshi",
    themes: ["imode"],
    npc: "chicken",
    text: "「パケット代が3万円になったって、お客さんカンカンだぞ」とトサカ先輩。画像の重いページが原因らしい。パケ死は社会問題だ。",
    choices: [
      {
        label: "画像を減色して容量を1/3にする",
        baseRate: 0.8,
        success: { text: "見た目ほぼそのまま容量激減。「軽さは正義」がこの時代の鉄則だ。", trust: 6 },
        fail: { text: "減色しすぎてキャラの顔が別人になった。ファンからの指摘が辛辣だった。", trust: -3 },
      },
      {
        label: "ページ冒頭に容量の目安を表示する",
        baseRate: 0.75,
        success: { text: "「このページ:約8KB」表示が好評。誠実さはUIになる。", trust: 5 },
        fail: { text: "目安の計算が機種依存でズレた。正確さより難しい、正直さ。", trust: -2 },
      },
    ],
  },
  {
    id: "im-3carrier",
    themes: ["imode"],
    npc: "humming",
    text: "ハチ子が高速で飛び回っている。「3キャリア同時リリース、画面幅が240と176と132！　どれに合わせるの会議、始めるよ！」",
    choices: [
      {
        label: "最小の132px基準で組んで上位は余白で吸収",
        baseRate: 0.75,
        success: { text: "「最小に合わせて壊れない」原則が通った。のちのレスポンシブ思想の遠い祖先だ。", trust: 6 },
        fail: { text: "最大画面のユーザーから「余白がさみしい」の声。全員を幸せにする幅はない。", trust: -2 },
      },
      {
        label: "機種判定で3種類の画面を出し分ける",
        baseRate: 0.6,
        stamina: -12,
        success: { text: "手間は3倍、体験は3倍。「この現場、丁寧」とユーザー掲示板で評判に。", trust: 8 },
        fail: { text: "判定テーブルに新機種が漏れて、最新端末だけ崩れた。皮肉なものだ。", trust: -5 },
      },
    ],
  },
  {
    id: "im-flash-diet",
    themes: ["imode"],
    npc: "sparrow",
    text: "待受Flashが容量制限を2KBオーバー。チュン太が唸る。「あと2KB……音を削るか、コマを削るか、それが問題だ」",
    choices: [
      {
        label: "ベクター図形を共有パーツ化して削る",
        baseRate: 0.7,
        success: { text: "同じ形の再利用で3KB減。見た目は無傷。職人の技が決まった。", trust: 7 },
        fail: { text: "共有化の副作用で全部の星が同じ角度に。夜空が整列してしまった。", trust: -3 },
      },
      {
        label: "音源のループを短くして誤魔化す",
        baseRate: 0.75,
        success: { text: "2秒ループでも違和感なし。耳は意外と騙せる。無事に納品。", trust: 5 },
        fail: { text: "ループの継ぎ目が「プツッ」。音のアラは、目より耳が先に気づく。", trust: -2 },
      },
    ],
  },
  {
    id: "im-chakumelo",
    themes: ["imode"],
    npc: "tsuru",
    text: "着メロの新曲データが届いた。ツルさんが試聴機を差し出す。「16和音。……いい時代になったもんだ。3和音の頃はドラムを諦めてたのよ」",
    choices: [
      {
        label: "原曲と聴き比べて音の割り当てを調整する",
        baseRate: 0.75,
        success: { text: "サビのメロディを最優先に配分。試聴機の前で思わず口ずさんだ。配信数も好調。", trust: 6 },
        fail: { text: "ベースに和音を割きすぎてメロディが埋もれた。「渋すぎるアレンジだね」", trust: -2 },
      },
      {
        label: "機種ごとの音源差を一覧にしてから作業する",
        baseRate: 0.8,
        success: { text: "同じデータでも鳴り方は機種次第。一覧表が品質チェックの標準になった。", trust: 5 },
        fail: { text: "一覧作りに熱中して、締切がすぐそこに来ていた。", trust: -3 },
      },
    ],
  },
  {
    id: "im-iphone-news",
    themes: ["imode"],
    npc: "humming",
    text: "休憩室のテレビが海外ニュースを流している。「アップルが電話を発表——画面を指で触って操作」。ハチ子の羽が一瞬、止まった。",
    choices: [
      {
        label: "「日本のケータイの方が多機能だよ」と論じる",
        baseRate: 0.7,
        success: { text: "おサイフもワンセグもこっちが先。議論は白熱し、そして誰かが言った。「でも、触ってみたいね」", trust: 4 },
        fail: { text: "多機能の列挙に夢中で、変化の匂いを語り損ねた。", trust: -2 },
      },
      {
        label: "「これは大きな波かも」と静かにメモを取る",
        baseRate: 0.85,
        success: { text: "メモには「タッチ操作、アプリ、単一画面幅」。数年後、このメモの意味を全員が知る。", trust: 6 },
        fail: { text: "メモを取ったが、翌日の3キャリア対応に忙殺されて忘れた。現場は今日も回る。", trust: 0 },
      },
    ],
  },
  {
    id: "im-keitai-novel",
    themes: ["imode"],
    npc: "sparrow",
    peaceful: true,
    text: "昼休み、チュン太が親指を高速で動かしている。「いま話題のケータイ小説、読んでる。改行が多いのはね、親指のリズムなんだよ」",
    choices: [
      {
        label: "おすすめを1本読んでみる",
        baseRate: 1,
        success: { text: "縦に流れる短い文。小さい画面が生んだ新しい文体だった。メディアは器の形に育つ。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "サイトの読みやすさ改善のヒントにする",
        baseRate: 1,
        success: { text: "「改行は多め、1画面1トピック」。ユーザーの読み方から学ぶのが一番早い。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "im-strap",
    themes: ["imode"],
    npc: "tsuru",
    peaceful: true,
    text: "ツルさんのケータイには、ストラップが5本ついている。「お守りと、旅行の思い出と、限定品と……端末は着せ替えるものなのよ」",
    choices: [
      {
        label: "ストラップ文化の話を聞く",
        baseRate: 1,
        success: { text: "機械を飾って持ち歩く文化は、この国のケータイから始まった。愛着はカスタムから生まれる。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "サイトの限定壁紙をストラップ風にデザインしてみる",
        baseRate: 1,
        success: { text: "「画面の中のストラップ」が小ヒット。文化は形を変えて生き残る。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
    ],
  },

  // ================= きおくの現場: ソシャゲ運営室（2010年代） =================
  {
    id: "sg-midnight-maint",
    themes: ["socialgame"],
    npc: "owl",
    text: "深夜1時、新イベント公開前のメンテナンス。フクロPMは平常運転（夜行性）。「開けた瞬間に10万人が来る。手順の読み合わせを」",
    choices: [
      {
        label: "手順書を全員で指差し読み合わせする",
        baseRate: 0.8,
        success: { text: "2時00分、メンテ明け。トラフィックの波を全員で見守り、静かに乗り切った。", trust: 6 },
        fail: { text: "手順書の1項目が古いままだった。3分の延長メンテ。お詫び文の起草役になった。", trust: -3 },
      },
      {
        label: "ロールバック手順だけ先に単独リハーサルする",
        baseRate: 0.75,
        skillTag: "障害対応",
        success: { text: "「戻れる」確信があると人は冷静になれる。リハーサルは使われないのが最高の結果。", trust: 7 },
        fail: { text: "リハ中に検証環境を壊した。本番前の冷や汗はしかし、良い薬。", trust: -4 },
      },
    ],
  },
  {
    id: "sg-double-impl",
    themes: ["socialgame"],
    npc: "sparrow",
    text: "新機能の仕様が来た。チュン太が乾いた笑い。「はい、ガラケー版とスマホ版、2回実装しまーす。同じ機能を、2つの世界に」",
    choices: [
      {
        label: "共通ロジックを切り出して差分を最小にする",
        baseRate: 0.7,
        success: { text: "共通部分を1箇所に。次の機能追加から工数が目に見えて減った。移行期の設計力。", trust: 8 },
        fail: { text: "共通化の抽象が漏れて、両方で微妙に動きが違った。抽象化は焦ると噛む。", trust: -4 },
      },
      {
        label: "ガラケー版を先に作って仕様の穴を洗い出す",
        baseRate: 0.75,
        success: { text: "制約の強い側から作ると穴が早く見つかる。スマホ版は倍速で書けた。", trust: 5 },
        fail: { text: "ガラケー版に最適化しすぎて、スマホ版で作り直しが発生した。", trust: -3 },
      },
    ],
  },
  {
    id: "sg-kpi-watch",
    themes: ["socialgame"],
    npc: "humming",
    text: "イベント2日目の朝会。ハチ子がダッシュボードを映す。「継続率が予測より3ポイント低い！　テコ入れ案、今日中に出すよ！」",
    choices: [
      {
        label: "離脱ポイントのデータを深掘りして原因を特定する",
        baseRate: 0.7,
        success: { text: "3戦目の難易度が壁だった。1箇所の調整で数字が戻る。データは嘘をつかない。", trust: 7 },
        fail: { text: "深掘りに時間をかけすぎて、テコ入れは明日に。数字は待ってくれない。", trust: -3 },
      },
      {
        label: "ログイン報酬の追加をすぐ提案する",
        baseRate: 0.65,
        success: { text: "即効薬が効いて数字は回復。ただし「報酬インフレに注意」と自分でメモも残した。", trust: 5 },
        fail: { text: "報酬だけ受け取って離脱する動きが増えた。対症療法の限界を学ぶ。", trust: -4 },
      },
    ],
  },
  {
    id: "sg-gacha-rule",
    themes: ["socialgame"],
    npc: "owl",
    text: "業界にコンプガチャ規制のニュースが走った日。フクロPMが会議室に全員を集めた。「うちの仕様も総点検する。遊びの信頼は、失うのは一瞬だ」",
    choices: [
      {
        label: "確率表記と仕様の点検リストを作る",
        baseRate: 0.75,
        success: { text: "点検は3日で完了、先回りの表記改善も入れた。「守りが早いチームは攻めも速い」", trust: 8 },
        fail: { text: "リストの網羅に穴。後日、法務からの指摘で見つかり、二度手間になった。", trust: -4 },
      },
      {
        label: "ユーザー告知文の草案を先に用意する",
        baseRate: 0.7,
        success: { text: "「先に誠実に言う」戦略が功を奏し、掲示板の空気は穏やかだった。", trust: 6 },
        fail: { text: "告知が先行しすぎて「で、いつ直るの？」の問い合わせが殺到した。", trust: -3 },
      },
    ],
  },
  {
    id: "sg-flash-eol",
    themes: ["socialgame"],
    npc: "sparrow",
    text: "「Flashのサポート終了、正式発表だって」。チュン太がPCから顔を上げた。うちのゲームの演出は、ほぼ全部Flashでできている。",
    choices: [
      {
        label: "移行先技術の検証を今日から始める",
        baseRate: 0.7,
        success: { text: "半日で簡易プロトタイプが動いた。終わりの発表は、始まりの合図でもある。", trust: 7 },
        fail: { text: "検証環境の構築で丸一日溶けた。新技術の初日はだいたいこう。", trust: -2 },
      },
      {
        label: "演出データの棚卸しをして移行量を見積もる",
        baseRate: 0.75,
        success: { text: "「全852本、うち再利用可能618本」。数字にした瞬間、漠然とした不安が計画に変わった。", trust: 6 },
        fail: { text: "棚卸しの途中で命名規則が3世代あることが発覚。考古学の様相を呈した。", trust: -3 },
      },
    ],
  },
  {
    id: "sg-sunset-letter",
    themes: ["socialgame"],
    npc: "tsuru",
    text: "サービス終了が決まった。告知文の起草が回ってきて、手が止まる。ツルさんがそっと言った。「終わらせ方は、続け方と同じくらい大事な仕事よ」",
    choices: [
      {
        label: "遊んでくれた年月への感謝を軸に書く",
        baseRate: 0.8,
        success: { text: "掲示板には悲しみと、それ以上の「ありがとう」が並んだ。良い葬送は良い記憶を残す。", trust: 8 },
        fail: { text: "感謝を尽くしたが、オフライン版を望む声には応えられなかった。心が残る。", trust: 2 },
      },
      {
        label: "思い出を残せる機能（アルバム保存）を提案する",
        baseRate: 0.65,
        success: { text: "「カードをローカル保存できる機能」が実装され、最終日は写真撮影会のようだった。", trust: 8 },
        fail: { text: "提案は喜ばれたが工数が足りず、簡易版のみ。それでも喜ばれた。", trust: 3 },
      },
    ],
  },
  {
    id: "sg-fan-letter",
    themes: ["socialgame"],
    npc: "humming",
    peaceful: true,
    text: "お問い合わせフォームに「不具合でも要望でもないのですが」と前置きされた長文が届いた。読んでみると、入院中にこのゲームに救われたという感謝の手紙だった。",
    choices: [
      {
        label: "チーム全員に共有する",
        baseRate: 1,
        success: { text: "深夜メンテの疲れが吹き飛ぶ音がした。この一通のために作っている、と誰かが言った。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "運営名義で丁寧に返信を書く",
        baseRate: 1,
        success: { text: "定型文ではない返事を書いた。画面の向こうに人がいることを、互いに確かめ合った。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
    ],
  },
  {
    id: "sg-user-meetup",
    themes: ["socialgame"],
    npc: "tsuru",
    peaceful: true,
    text: "ユーザー有志のオフ会が近くのカフェであるらしい。ツルさんが窓の外を見て微笑む。「画面の中の祭りが、現実の友達を作ったのね」",
    choices: [
      {
        label: "そっと様子を見に行く（運営とは名乗らずに）",
        baseRate: 1,
        success: { text: "攻略談義に花が咲いていた。自分の書いたイベントが誰かの思い出になっている。", trust: 3 },
        fail: { text: "", trust: 0 },
      },
      {
        label: "差し入れを匿名で送る",
        baseRate: 1,
        success: { text: "後日、掲示板に「運営さん？」のスレが立った。永遠に白状しないでおく。", trust: 2 },
        fail: { text: "", trust: 0 },
      },
    ],
  },

  // ================= 現代編: AIの波（既存テーマに混ざる） =================
  {
    id: "ai-review-flip",
    themes: ["web", "ec"],
    npc: "owl",
    text: "今日から試験導入のAIコーディング支援。朝イチで叩き台のプルリクが3本できていた。フクロPMが言う。「書く仕事から、見極める仕事へ。今日は君がレビュアーだ」",
    choices: [
      {
        label: "自分で書くつもりで1行ずつ検証する",
        baseRate: 0.75,
        success: { text: "もっともらしい境界値バグを2つ検出。「見極める力こそ、これからの商品だな」", trust: 7 },
        fail: { text: "うっかり通した1本にバグ。「読んだ」と「検証した」は違うと骨身に沁みた。", trust: -5 },
      },
      {
        label: "テストを先に書いてAIの出力を通す",
        baseRate: 0.7,
        skillTag: "結合テスト",
        success: { text: "テストが仕様書代わりになり、レビューが倍速に。新しい時代の型が見えた。", trust: 6 },
        fail: { text: "テスト自体の考慮漏れで抜け穴ができた。検問所は、門の位置がすべて。", trust: -3 },
      },
    ],
  },
  {
    id: "ai-evidence",
    themes: ["finance", "gov"],
    npc: "chicken",
    text: "テスト工程の風景が変わりつつある。スクリーンショットを1枚ずつ貼っていたエビデンス作業に自動化ツールが入るらしい。トサカ先輩が腕を組む。「俺、この作業10年やったんだよなあ」",
    choices: [
      {
        label: "「先輩の目の付け所をルール化しましょう」と提案する",
        baseRate: 0.7,
        success: { text: "10年分の「怪しい画面の勘」が検証観点表になった。技は消えない、形を変えるだけ。", trust: 8 },
        fail: { text: "勘の言語化は難航。「見ればわかる」は、なかなか言葉にならない。", trust: -2 },
      },
      {
        label: "ツール導入の検証役を買って出る",
        baseRate: 0.75,
        success: { text: "ツールの苦手分野を洗い出し「人の目が要る箇所リスト」を作った。共存の設計図だ。", trust: 6 },
        fail: { text: "検証環境の権限申請で1週間停滞。変化はいつも書類より速い。", trust: -2 },
      },
    ],
  },
  {
    id: "ai-hougan",
    themes: ["gov", "finance"],
    npc: "peacock",
    text: "クジャク部長が方眼紙Excelの設計書の山を前に言った。「これをAIに読ませて設計書を作り直す実験をする。……20年分ある。読めるかね？」",
    choices: [
      {
        label: "まず数枚で精度を検証してから計画を立てる",
        baseRate: 0.8,
        success: { text: "セル結合の迷宮でAIも人も迷うことが判明。「前処理が9割」の見積もりが正確に立った。", trust: 7 },
        fail: { text: "試した数枚がたまたま綺麗で、楽観的な計画を出してしまった。山は深かった。", trust: -4 },
      },
      {
        label: "「読ませる前に書式の統一を」と正直に進言する",
        baseRate: 0.7,
        skillTag: "顧客折衝",
        success: { text: "「ふむ、急がば回れか」。部長の一声で書式統一プロジェクトが先に立った。", trust: 6 },
        fail: { text: "「統一に何年かかるかね」と羽を広げられた。正論は、時に羽で返される。", trust: -3 },
      },
    ],
  },
  {
    id: "ai-junior-path",
    themes: ["web", "ec"],
    npc: "humming",
    text: "ハチ子が珍しくゆっくり飛んでいる。「新人に切り出してた簡単なタスク、AIが先にやっちゃうのよね。新人はどこで経験を積めばいいんだろう」",
    choices: [
      {
        label: "「AIの出力を新人がレビューする」育成案を出す",
        baseRate: 0.7,
        success: { text: "読む力から育てる新カリキュラム始動。学び方が変わるだけで、学びは消えない。", trust: 7 },
        fail: { text: "レビューだけでは手が動かず、新人の顔が曇った。写経の時間も、やはり要る。", trust: -2 },
      },
      {
        label: "自分の新人時代の学び方を話してみる",
        baseRate: 0.8,
        success: { text: "「困って調べて怒られて覚えた」経験談が意外とヒントに。困る権利を新人に残す設計になった。", trust: 5 },
        fail: { text: "思い出話が長くなり、会議が1本増えた（ハチ子製）。", trust: -1 },
      },
    ],
  },
  {
    id: "ai-minutes",
    themes: ["ec", "web"],
    npc: "sparrow",
    text: "議事録係が要らなくなった。AIが会議を文字起こしして要約までする。チュン太がしみじみ言う。「議事録番だった俺、あれで会議の力学を全部覚えたんだけどな」",
    choices: [
      {
        label: "AI議事録の「決定事項」欄だけ人間が確認する運用にする",
        baseRate: 0.8,
        success: { text: "決定と宿題だけは人の目で。会議の速度と正確さが両立した。", trust: 6 },
        fail: { text: "確認が形骸化して、誤った決定事項が1週間生き残った。仕組みは運用が命。", trust: -4 },
      },
      {
        label: "空いた時間で会議の設計そのものを見直す",
        baseRate: 0.7,
        success: { text: "「書く係」から「会議を減らす係」へ。役割は消えても、価値は上流に移った。", trust: 7 },
        fail: { text: "会議削減案がまさかの会議で否決。会議は強い。", trust: -2 },
      },
    ],
  },
  {
    id: "ai-turtle-legacy",
    themes: ["finance", "gov", "embedded"],
    npc: "turtle",
    text: "カメ長老がAIチャットの画面を睨んでいる。「わしの甲羅の中の仕様、こやつに語って聞かせようかと思うてな。……わしも、いつまでもおらんからの」",
    choices: [
      {
        label: "長老へのインタビューを申し出て一緒に記録する",
        baseRate: 0.8,
        success: { text: "「この分岐はな、平成9年の制度改正での」——語りが仕様書になっていく。生きた知識の継承だ。", trust: 8 },
        fail: { text: "話が横道の武勇伝に逸れ続けた。それはそれで、記録する価値があった気もする。", trust: 2 },
      },
      {
        label: "AIの要約を長老に読み返してもらい誤りを正す",
        baseRate: 0.75,
        success: { text: "「ここは違う。逆じゃ」——確認の往復で精度が上がる。人が最後の砦になる形が見えた。", trust: 6 },
        fail: { text: "要約の誤りが微妙に多く、長老が疲れてしまった。「今日はここまでにしようかの」", trust: -2 },
      },
    ],
  },
];

export const eventById = (id: string): GenbaEvent | undefined =>
  EVENTS.find((e) => e.id === id);

/** そのテーマの現場で出うるイベント（テーマ一致 かつ 語り手が配属されている）。
 *  きおくの現場（era付きテーマ）では専用イベントのみ——現代の共通イベントは時代錯誤なので出さない */
export function eventsForTheme(theme: GenbaTheme): GenbaEvent[] {
  const def = themeById(theme);
  if (!def) return [];
  return EVENTS.filter((e) =>
    def.era
      ? (e.themes?.includes(theme) ?? false)
      : (!e.themes || e.themes.includes(theme)) && def.roster.includes(e.npc)
  );
}
