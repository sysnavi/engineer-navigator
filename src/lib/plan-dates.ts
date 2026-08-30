import { mondayOf } from "@/lib/week";

// 学習プランの日付まわりの純ロジック（試験日→残り日数・週数・週次の目安日）。
// AI呼び出しやDBには触らない。作成フォームの検証とバックグラウンド生成の両方から使う。

export const DAY_MS = 86400_000;

/** プラン作成に必要な最低リード日数。フォームのmin属性とサーバー検証の両方で使う。 */
export const MIN_PLAN_LEAD_DAYS = 3;

/** 試験日までの残り日数（切り上げ）。 */
export function daysUntilExam(examDate: Date, now: Date): number {
  return Math.ceil((examDate.getTime() - now.getTime()) / DAY_MS);
}

/**
 * 検証（daysUntilExam >= MIN_PLAN_LEAD_DAYS）を満たす最小の試験日（UTC基準のYYYY-MM-DD）。
 * 試験日は "YYYY-MM-DD" + T00:00:00Z で解釈されるため、min属性もUTCの日付で揃える。
 */
export function minExamDateStr(now: Date): string {
  return new Date(now.getTime() + MIN_PLAN_LEAD_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/** 試験日から逆算した週数。生成プロンプトの前提に合わせて1〜16に丸める。 */
export function planWeeks(examDate: Date, now: Date): number {
  const daysLeft = daysUntilExam(examDate, now);
  return Math.min(16, Math.max(1, Math.ceil(daysLeft / 7)));
}

/** i番目（0始まり）の項目の目安完了日。最終週は試験日に固定する。 */
export function itemTargetDate(params: {
  index: number;
  total: number;
  examDate: Date;
  now: Date;
}): Date {
  if (params.index === params.total - 1) return params.examDate;
  const monday = mondayOf(params.now);
  return new Date(monday.getTime() + (params.index + 1) * 7 * DAY_MS);
}
