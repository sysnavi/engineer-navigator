// ダンジョンのBGM。開発者本人の曲を public/bgm に置き、潜行中ループで流す。
// 音量はおさんぽ曲（平均 -14.5 LUFS 前後）に揃えて書き出してある（128kbps）。
// 曲を差し替えるときはファイルを置いて、このパスを変えるだけ。

/** 探索曲（INTRO / EXPLORE / EVENT / CHOICE / BATTLE の全フェーズで流す） */
export const DUNGEON_BGM_SRC = "/bgm/dungeon-01.mp3";

/** 効果音（blip, gain 0.04）が埋もれない初期音量 */
export const DUNGEON_BGM_DEFAULT_VOL = 0.3;

/** 決着（END）時のフェードアウト（ms）。ファンファーレの後ろで静かに消える */
export const DUNGEON_BGM_FADE_MS = 900;

/** 設定の保存キー（端末ごと・localStorage） */
export const DUNGEON_BGM_KEY = { on: "dungeon-bgm-on", vol: "dungeon-bgm-vol" };

/** 保存値を 0..1 の音量に読む。壊れていれば null */
export function parseVolume(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}
