// 通報カテゴリ（Issue #16）。UIのラジオと対応。
// "use server" ファイルはasync関数しかexportできないため、定数はここに分離する。
export const REPORT_CATEGORIES: Record<string, string> = {
  spam: "スパム・宣伝",
  harassment: "誹謗中傷・攻撃的",
  privacy: "個人情報・晒し",
  other: "その他",
};
