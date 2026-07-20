// 問い合わせ（Issue #9）の共通定義とルール。
//
// 【設計の芯】このサイトは個人情報を持たない方針なので、問い合わせでも
// 「返信先メールアドレス」を集めない。代わりに:
//   ログイン済み … アカウントに紐づけて保存し、返信もサイト内（マイページ）で返す
//   未ログイン   … DBに残さず notify()（Slack）へ流して破棄する一方通行
// つまり「返信が必要な相談はログインしてから」という導線に自然と寄せている。

export const INQUIRY_CATEGORIES = {
  bug: "不具合の報告",
  request: "こうしてほしい（要望）",
  other: "その他",
} as const;
export type InquiryCategory = keyof typeof INQUIRY_CATEGORIES;

export function isInquiryCategory(v: unknown): v is InquiryCategory {
  return typeof v === "string" && v in INQUIRY_CATEGORIES;
}

export const BODY_MAX = 1000;
export const BODY_MIN = 5;
/** ログイン済みユーザーの1日あたり上限（荒らし対策。普通に使う分には当たらない） */
export const PER_DAY_LIMIT = 3;

export type InquiryStatus = "OPEN" | "REPLIED" | "CLOSED";
export const STATUS_LABELS: Record<InquiryStatus, string> = {
  OPEN: "未対応",
  REPLIED: "返信済み",
  CLOSED: "クローズ",
};

/** 本文の検証。エラーメッセージは利用者にそのまま見せる文言にする */
export function validateBody(body: unknown): string {
  if (typeof body !== "string" || body.trim().length < BODY_MIN) {
    return "";
  }
  return body.trim().slice(0, BODY_MAX);
}
