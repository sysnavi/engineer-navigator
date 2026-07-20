// サイトTIPS（たまに右下に出る豆知識）。データ駆動: ここに足すだけで巡回に入る。
// 表示制御は src/components/tips-toast.tsx（1日1回・未読優先・localStorage管理）。
// 新機能を追加したら、気づかれにくい入口をここで宣伝すると発見率が上がる。

export type Tip = {
  id: string; // 既読管理キー（変えると再表示されるので安定させる）
  emoji: string;
  text: string;
  href?: string; // 「見にいく」リンク（任意）
};

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
