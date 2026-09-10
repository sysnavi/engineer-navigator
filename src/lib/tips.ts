// サイトTIPS（たまに右下に出る豆知識）。データ駆動: ここに足すだけで巡回に入る。
// 表示制御は src/components/tips-toast.tsx（1日1回・未読優先・localStorage管理）。
// 新機能を追加したら、気づかれにくい入口をここで宣伝すると発見率が上がる
// （/feature の検証チェックリストにも入っている）。
// href の実在・idの重複は src/lib/tips.test.ts が npm run check で検査する。
// 数値（EXP・日数・レベル）を書くときは src/lib/exp.ts 等の定数と合わせること。

export type Tip = {
  id: string; // 既読管理キー（変えると再表示されるので安定させる）
  emoji: string;
  text: string;
  href?: string; // 「見にいく」リンク（任意）
  // 新規ユーザー期間（登録3日以内）に、この順で優先表示するオンボーディングTIP（Issue #20）。
  // 数字が小さいほど先。未設定のTIPは通常のランダム巡回のみ。
  onboarding?: number;
  // ブラウザ版だけで意味があるTIP（「ホーム画面に追加」等）。アプリ版（Capacitor）では出さない
  webOnly?: true;
};

// 新規期間のオンボーディングキュー（週報→腕試し→ダンジョン→げんば→マイホーム→きせかえ）。
// 通常のTIPS（豆知識）とは役割が違う＝「次に何をするか」を指示する。既存idは変えない方針。
export const ONBOARDING_TIPS: Tip[] = [
  {
    id: "nc-report",
    onboarding: 1,
    emoji: "📝",
    text: "まずは今週の週報を書いてみよう。5分でOK。AIがスキルを見つけて、経歴書が自動で育つよ",
    href: "/report",
  },
  {
    id: "nc-quiz",
    onboarding: 2,
    emoji: "🎯",
    text: "腕試しの四択に挑戦してみよう。正解でEXPが貯まって、アバターが育つよ",
    href: "/quiz",
  },
  {
    id: "nc-dungeon",
    onboarding: 3,
    emoji: "🗺",
    text: "ダンジョンは迷路を歩いて階段を探す。出会った相手には問いで答える。知ってることが、そのまま強さになる",
    href: "/dungeon",
  },
  {
    id: "nc-genba",
    onboarding: 4,
    emoji: "💼",
    text: "「げんば」で案件を選んで面接へ。現場を乗り切るとENが貯まって、おかいものに使えるよ",
    href: "/genba",
  },
  {
    id: "nc-home",
    onboarding: 5,
    emoji: "🏠",
    text: "マイホームで戦利品を飾ったり、遊びに来たペットをなでたりできるよ",
    href: "/home",
  },
  {
    id: "nc-palette",
    onboarding: 6,
    emoji: "🎨",
    text: "マイページの「きせかえ」で画面の色を変えられる。GAME BOY風も選べるよ",
    href: "/mypage",
  },
];

export const TIPS: Tip[] = [
  // ---- きろく（週報・スキル・経歴書） ----
  {
    id: "interview-mode",
    emoji: "🎙",
    text: "週報は「インタビューで答える」モードなら、AIとおしゃべりするだけで下書きができるよ",
    href: "/report?mode=interview",
  },
  {
    id: "voice-interview",
    emoji: "🗣",
    text: "インタビューの「ハンズフリーで話す」なら、AIの声に答えるだけで週報が進む。手がふさがっていてもOK",
    href: "/report?mode=interview",
  },
  {
    id: "mic-input",
    emoji: "🎤",
    text: "テキスト欄のマイクボタンで音声入力できるよ。歩きながらの週報もあり",
  },
  {
    id: "skills-verify",
    emoji: "✅",
    text: "⚠仮判定のスキルは、承認時の深掘りインタビューか、腕試しで同じお題に2問正解すると検証済みになるよ",
    href: "/skills",
  },
  {
    id: "resume-pdf",
    emoji: "📄",
    text: "経歴書は週報から自動で組版される。「PDF出力」でそのまま渡せる普通の書式になるよ",
    href: "/resume",
  },

  // ---- まなぶ（腕試し・学習プラン・メンター） ----
  {
    id: "quiz-daily",
    emoji: "🔥",
    text: "腕試しには「今日の一問」があるよ。1日1問だけ、7日連続ごとにボーナスEXP",
    href: "/quiz/daily",
  },
  {
    id: "quiz-review",
    emoji: "🔁",
    text: "間違えた問題は復習ボックスに入って、3日後・7日後・30日後にまた出てくるよ",
    href: "/quiz/review",
  },
  {
    id: "quiz-cert",
    emoji: "📖",
    text: "腕試しは「資格の範囲から選ぶ」で試験ごとの問題に絞れるよ。受験前の総ざらいに",
    href: "/quiz",
  },
  {
    id: "quiz-author",
    emoji: "✏️",
    text: "腕試しの問題を作ると+20EXP。みんなから良問評価されるとさらにボーナスがあるよ",
    href: "/quiz/new",
  },
  {
    id: "quiz-rate",
    emoji: "⭐",
    text: "解いたあとの0〜10点評価が良問ランキングになるよ。評価するだけでもEXPがつく",
    href: "/quiz",
  },
  {
    id: "plan-chapter-quiz",
    emoji: "📚",
    text: "学習プランの各週から、その章の腕試しへ直接飛べるよ。資格の範囲ごとに問題があるんだ",
    href: "/plan",
  },
  {
    id: "mentor-propose",
    emoji: "🧭",
    text: "AIメンターの「先回り提案」は、週報の詰まったことから次に学ぶトピックを出してくれるよ",
    href: "/mentor",
  },
  {
    id: "mentor-stance",
    emoji: "🗨",
    text: "メンターの言い方はマイページの「接し方」で変えられるよ。判定のきびしさは変わらない",
    href: "/mypage",
  },

  // ---- かせぐ・おかいもの（げんば・ショップ） ----
  {
    id: "genba-revisit",
    emoji: "🤝",
    text: "げんばで しんらい70以上で満了すると、同じ現場の「再訪案件」が解禁。役割が一段上がるよ",
    href: "/genba",
  },
  {
    id: "genba-album",
    emoji: "📼",
    text: "げんばの「きおくの現場」を満了すると、消えていった仕事の話がアルバムに1ページ残るよ",
    href: "/genba/album",
  },
  {
    id: "shop-rotation",
    emoji: "🛒",
    text: "おかいものの新シリーズは週替わり入荷。シリーズをコンプすると壁紙や床のきせかえが解放されるよ",
    href: "/shop",
  },
  {
    id: "shop-expansion",
    emoji: "📐",
    text: "おかいものの「拡張キット」でリビングが横に広がるよ。家具を置く場所が足りなくなったら",
    href: "/shop",
  },

  // ---- あそぶ・つながる（ダンジョン・ペット・よもやま・発見・おさんぽ） ----
  {
    id: "dungeon-shield",
    emoji: "🛡",
    text: "週報を出した週は「週報の盾」がついて、ダンジョンで1回だけ敗走を無効にできるよ",
    href: "/dungeon",
  },
  {
    id: "dungeon-loot",
    emoji: "🎒",
    text: "ダンジョンは敗走しても戦利品は持ち帰れるよ。無理せず引き返すのも判断のうち",
    href: "/dungeon",
  },
  {
    id: "rare-visitor",
    emoji: "👾",
    text: "ごくたまに、画面の左下に見知らぬキャラが遊びにくることがあるよ。見かけたら話しかけてみて",
  },
  {
    id: "visitor-revisit",
    emoji: "🐾",
    text: "来訪者を逃しても、翌日にもう一度だけ来てくれるよ。左下の🐾は明日への気配",
  },
  {
    id: "myhome",
    emoji: "🏠",
    text: "ダンジョンの戦利品はマイホームに飾れるよ。ペットをなでるのも忘れずに",
    href: "/home",
  },
  {
    id: "pet-favorite",
    emoji: "🍙",
    text: "ペットには種族ごとに好物がひとつ。当てるとなつき度が2倍。ヒントは話しかけると教えてくれるよ",
    href: "/home",
  },
  {
    id: "yomoyama",
    emoji: "💬",
    text: "「よもやま」は現場の話をハンドル名で共有する場所。投稿するとEXPにもなるよ",
    href: "/yomoyama",
  },
  {
    id: "discover",
    emoji: "🔭",
    text: "「発見」では他の人の成長の道筋が見られるよ。目標にしたい人を探してみて",
    href: "/discover",
  },
  {
    id: "walk",
    emoji: "🌳",
    text: "「おさんぽ」でうちの子とのんびり歩けるよ。ときどき ひとことつぶやく",
    href: "/walk",
  },
  {
    id: "walk-weather",
    emoji: "☁️",
    text: "おさんぽの「いまの天気にあわせる」で、外の空模様が画面に反映されるよ",
    href: "/walk",
  },

  // ---- じぶん（アバター・きせかえ・設定） ----
  {
    id: "rebirth",
    emoji: "🥚",
    text: "アバターがLv12（マイスター）になると卵を産んで転生できるよ。継承でしか出会えない姿も…",
    href: "/mypage",
  },
  {
    id: "streak",
    emoji: "🔥",
    text: "7日連続でログインするとボーナスEXP。毎日ちょっと覗くだけでアバターが育つよ",
  },
  {
    id: "palette",
    emoji: "🎨",
    text: "マイページの「きせかえ」でサイト全体のカラーを変えられるよ。GAME BOY風も",
    href: "/mypage",
  },
  {
    id: "ui-shell",
    emoji: "🖥",
    text: "マイページの「UIモード」で、レトロOSデスクトップ風の画面に切り替えられるよ",
    href: "/mypage",
  },
  {
    id: "dock",
    emoji: "📌",
    text: "デスクトップUIのスマホ表示なら、下部ドックの3枠をマイページで好きな機能に入れ替えられるよ",
    href: "/mypage",
  },
  {
    id: "support",
    emoji: "📮",
    text: "困ったら「問い合わせ」から運営へ。返信はメールでなく、マイページの「運営とのやりとり」に届くよ",
    href: "/contact",
  },
  {
    id: "pwa",
    emoji: "📱",
    text: "スマホのブラウザメニューから「ホーム画面に追加」すると、アプリみたいに使えるよ",
    webOnly: true,
  },
];
