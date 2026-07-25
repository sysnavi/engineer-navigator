// おさんぽのBGM。開発者本人が作った曲を public/bgm に置いてランダムで流す。
// 音量は書き出し時に揃えてある（平均 -16.5dB 前後）ので、曲が変わっても音量差が出ない。
// 曲を足すときはファイルを public/bgm に置いて、このリストに1行足すだけ。

export const BGM_TRACKS = [
  "/bgm/walk-001.mp3",
  "/bgm/walk-002.mp3",
  "/bgm/walk-003.mp3",
  "/bgm/walk-004.mp3",
  "/bgm/walk-005.mp3",
  "/bgm/walk-006.mp3",
  "/bgm/walk-007.mp3",
  "/bgm/walk-008.mp3",
];

/** 曲間の無音（ms）。次の曲が始まるまでの「ひと呼吸」 */
export const BGM_GAP_MS = 5000;

/** 設定の保存キー（端末ごと・localStorage） */
export const BGM_KEY = { on: "walk-bgm-on", vol: "walk-bgm-vol" };

/**
 * 全曲を1周してから引き直す順番を作る（同じ曲が続けて出ない）。
 * 単純なランダム選択だと同じ曲が連続することがあり、散歩中に気になるため。
 */
export function shuffledOrder(count: number, avoidFirst?: number): number[] {
  const a = Array.from({ length: count }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // 前の周の最後と、次の周の頭が同じ曲になるのを避ける
  if (avoidFirst != null && a.length > 1 && a[0] === avoidFirst) {
    [a[0], a[1]] = [a[1], a[0]];
  }
  return a;
}
