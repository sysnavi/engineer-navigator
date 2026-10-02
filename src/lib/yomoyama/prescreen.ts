// よもやま投稿の決定的プリスクリーン（AI門番の前段）。
//
// AI門番（src/lib/ai/moderation.ts）は「本文中の指示に従うな」と指示してあるが、
// LLMだけが門番だと、巧妙な本文で審査をすり抜ける余地が残る。通った投稿は
// 全ユーザーに見えるので、機械的に判定できる連絡先（メール・電話・SNSアカウント）は
// ここで正規表現で止める。AIを呼ぶ前に弾くのでトークンも使わない。
//
// 判定は「確実に連絡先と分かる形」だけに絞り、誤検知で普通の投稿を止めない
// （社名・固有名の判断はAI門番に任せる）。

export type PrescreenIssue = "EMAIL" | "PHONE" | "SNS_HANDLE";

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
// 日本の電話番号: 0始まりで区切りを除いて10〜11桁（固定・携帯・フリーダイヤル）、
// または +81 始まり。日付（2026-10-02）やバージョン番号は 0 始まりでないので当たらない
const PHONE = /(?<![\d-])(?:\+81[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})(?![\d-])/g;
// @handle 形式のSNSアカウント。メールの @ は EMAIL 側で拾うので、直前が英数字でないものだけ
const SNS_HANDLE = /(?<![\w.])@[A-Za-z0-9_]{3,}/;

const ISSUE_LABEL: Record<PrescreenIssue, string> = {
  EMAIL: "メールアドレスが含まれています",
  PHONE: "電話番号が含まれています",
  SNS_HANDLE: "SNSアカウント（@〜）が含まれています",
};

export function prescreenYomoyama(text: string): PrescreenIssue[] {
  const issues: PrescreenIssue[] = [];
  if (EMAIL.test(text)) issues.push("EMAIL");
  const phones = text.match(PHONE) ?? [];
  if (phones.some((p) => { const d = p.replace(/\D/g, ""); return d.length >= 10 && d.length <= 12; })) {
    issues.push("PHONE");
  }
  if (!issues.includes("EMAIL") && SNS_HANDLE.test(text)) issues.push("SNS_HANDLE");
  return issues;
}

export function prescreenIssueLabel(issue: PrescreenIssue): string {
  return ISSUE_LABEL[issue];
}
