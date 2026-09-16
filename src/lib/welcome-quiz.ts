// /welcome のヒーローに置く「いきなり1問」の純ロジック（DBに触らない部分）。
//
// ねらい: 初めて来た人に、説明を読ませる前に1問だけ解かせて EXP を受け取らせる。
// 問題は日替わりで1問だけ（良問プールから日付で決定的に選ぶ）。答えをこの1問だけ
// 登録前に見せるのは意図した例外で、/q/[id] の「答えは登録の見返り」方針は
// 「今日の1問以外は受け付けない」（loadWelcomeQuestion 側）ことで守る。

/** 日替わりプールの大きさ（良問を評価順に上からこの数だけ） */
export const WELCOME_QUIZ_POOL = 30;

/** ローカル日付の通し番号（今日の一問と同じく JST 0時で切る） */
export function dayNumber(now = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** 日付番号からプール内の添字を決める（size<=0 は -1） */
export function pickIndex(day: number, size: number): number {
  if (size <= 0) return -1;
  return ((day % size) + size) % size;
}

/** クエリ／フォームで来た選択肢番号を検証する。範囲外・非整数は null */
export function parseChoice(raw: string | null | undefined, size: number): number | null {
  if (raw == null || raw === "") return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < size ? n : null;
}
