// サイトTIPS（たまに右下に出る豆知識）。データ駆動: ここに足すだけで巡回に入る。
// 表示制御は src/components/tips-toast.tsx（1日1回・未読優先・localStorage管理）。
// 新機能を追加したら、気づかれにくい入口をここで宣伝すると発見率が上がる。

export type Tip = {
  id: string; // 既読管理キー（変えると再表示されるので安定させる）
  emoji: string;
  text: string;
  href?: string; // 「見にいく」リンク（任意）
  // 新規ユーザー期間（登録3日以内）に、この順で優先表示するオンボーディングTIP（Issue #20）。
  // 数字が小さいほど先。未設定のTIPは通常のランダム巡回のみ。
  onboarding?: number;
};

// 新規期間のオンボーディングキュー（週報→腕試し→ダンジョン→マイホーム→きせかえ）。
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
    text: "育てたアバターでダンジョンに潜ろう。深いほどレアな戦利品が眠ってる",
    href: "/dungeon",
  },
  {
    id: "nc-home",
    onboarding: 4,
    emoji: "🏠",
    text: "マイホームで戦利品を飾ったり、遊びに来たペットをなでたりできるよ",
    href: "/home",
  },
  {
    id: "nc-palette",
    onboarding: 5,
    emoji: "🎨",
    text: "マイページの「きせかえ」で画面の色を変えられる。GAME BOY風も選べるよ",
    href: "/mypage",
  },
];

export const TIPS: Tip[] = [
  {
    id: "ui-shell",
    emoji: "🖥",
    text: "マイページの「UIモード」で、レトロOSデスクトップ風の画面に切り替えられるよ",
    href: "/mypage",
  },
  {
    id: "rare-visitor",
    emoji: "👾",
    text: "ごくたまに、画面の左下に見知らぬキャラが遊びにくることがあるよ。見かけたら話しかけてみて",
  },
  {
    id: "palette",
    emoji: "🎨",
    text: "マイページの「きせかえ」でサイト全体のカラーを変えられるよ。GAME BOY風も",
    href: "/mypage",
  },
  {
    id: "interview-mode",
    emoji: "🎙",
    text: "週報は「インタビューで答える」モードなら、AIとおしゃべりするだけで下書きができるよ",
    href: "/report?mode=interview",
  },
  {
    id: "mic-input",
    emoji: "🎤",
    text: "テキスト欄のマイクボタンで音声入力できるよ。歩きながらの週報もあり",
  },
  {
    id: "dungeon-shield",
    emoji: "🛡",
    text: "週報を出した週は「週報の盾」がついて、ダンジョンで1回だけ敗走を無効にできるよ",
    href: "/dungeon",
  },
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
    id: "quiz-author",
    emoji: "✏️",
    text: "腕試しの問題を作ると+20EXP。みんなから良問評価されるとさらにボーナスがあるよ",
    href: "/quiz/new",
  },
  {
    id: "pwa",
    emoji: "📱",
    text: "スマホのブラウザメニューから「ホーム画面に追加」すると、アプリみたいに使えるよ",
  },
  {
    id: "myhome",
    emoji: "🏠",
    text: "ダンジョンの戦利品はマイホームに飾れるよ。ペットをなでるのも忘れずに",
    href: "/home",
  },
  {
    id: "discover",
    emoji: "🔭",
    text: "「発見」では他の人の成長の道筋が見られるよ。目標にしたい人を探してみて",
    href: "/discover",
  },
];
