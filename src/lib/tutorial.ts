// 初回チュートリアル（アプリの歩き方）のステップ定義。データ駆動なので、
// 将来の機能（ペット #2 / ローグライク #3 / シェア #6 など）が入ったら
// この配列に1ステップ追記するだけで拡張できる。sprite は PixelAvatar の段階名。

export type TutorialStep = {
  sprite: string; // PixelAvatar の sprite（演出用に段階を変える）
  title: string;
  body: string;
  cta?: { href: string; label: string }; // 最終ステップ等の誘導（任意）
  // 説明だけでなく、その場で設定を選ばせるステップ（今は接し方のみ）。
  // 選ばなくても既定（ふつう）で進めるので、フローは止めない。
  pick?: "stance";
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    sprite: "egg",
    title: "ようこそ！",
    body: "ここは、きみの毎日の頑張りが“ぜんぶ経験値”になる成長の場所。30秒で歩き方を紹介するね。",
  },
  {
    sprite: "chick",
    title: "まずは週報",
    body: "今週やったことを書いて出すだけ。AIが解析して、スキルを見つけ、経歴書が自動で育つよ。5分でOK。",
  },
  {
    sprite: "chick",
    title: "スキルが育つ",
    body: "AIの提案を承認するとスキルが上がる。承認するかは自分で決められる。",
  },
  {
    sprite: "chick",
    title: "どう言われたい？",
    body: "AIメンターの接し方を選べるよ。あとから変えられるし、スキル判定のきびしさは変わらない。",
    pick: "stance",
  },
  {
    sprite: "minarai",
    title: "アバターも育つ",
    body: "週報・腕試し・よもやま…ここでの行動は全部EXPになって、TOPのアバターが育つ。毎日ログインすると🔥連続ボーナスも。",
  },
  {
    sprite: "ichininmae",
    title: "みんなと学び合う",
    body: "四択の『腕試し』を作って解き合ったり、『よもやま』で現場の話をシェアしたり、『発見』で他の人の道筋を覗いたり。",
  },
  {
    sprite: "meister",
    title: "マイスター、その先へ",
    body: "レベルが上がりきると、アバターが卵を産んで“次の世代”へ。継承限定の姿も現れる。",
  },
  {
    sprite: "ichininmae",
    title: "さあ、はじめよう！",
    body: "まずは今週の週報から。書けば、すべてが動き出す。",
    cta: { href: "/report", label: "▶ 週報を書く" },
  },
];

// ゲスト専用のツアー（Issue #18 / #15）。フル版は週報やAIメンターに誘導するが、
// ゲストはそれらを使えない。フル版をそのまま見せると「行けない週報」に導いて
// 迷子にする（実際に起きた不備）ので、いま遊べることと登録の見返りだけを正直に伝える。
// 最後のCTAは**ゲストが実際に行ける先**（腕試し）にする。
export const GUEST_TUTORIAL_STEPS: TutorialStep[] = [
  {
    sprite: "egg",
    title: "ようこそ！（お試し中）",
    body: "登録なしで“育てて、潜る”を試せるよ。30秒で遊び方を紹介するね。",
  },
  {
    sprite: "chick",
    title: "いま遊べること",
    body: "腕試しの四択に答えるとEXPが貯まる。アバターが育って、ダンジョンでは戦利品も持ち帰れる。マイホームに飾れるよ。",
  },
  {
    sprite: "minarai",
    title: "アバターが育つ",
    body: "腕試し・ダンジョン…ここでの行動は全部EXPになって、TOPのアバターが育つ。毎日ログインすると🔥連続ボーナスも。",
  },
  {
    sprite: "ichininmae",
    title: "登録するともっと",
    body: "週報・AIメンター・経歴書は、登録すると使えるようになる。育てたアバターや戦利品はそのまま引き継がれるよ（マイページから連携）。",
    cta: { href: "/quiz", label: "▶ まずは腕試し" },
  },
];
