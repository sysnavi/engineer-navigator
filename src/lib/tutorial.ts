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
    body: "AIの提案を承認するとスキルのレベルが上がって、「成長の道筋」として記録に残る。承認するかは自分で決められる。",
  },
  {
    sprite: "chick",
    title: "どう言われたい？",
    body: "AIメンターの接し方を選べるよ。あとからマイページでいつでも変えられる。スキルの判定のきびしさは変わらないから安心して選んでね。",
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
    body: "レベルが上がりきると、アバターが卵を産んで“次の世代”へ。遺伝子や血統の称号を受け継いで、継承限定の姿も現れる。",
  },
  {
    sprite: "ichininmae",
    title: "さあ、はじめよう！",
    body: "まずは今週の週報から。書けば、すべてが動き出す。",
    cta: { href: "/report", label: "▶ 週報を書く" },
  },
];
