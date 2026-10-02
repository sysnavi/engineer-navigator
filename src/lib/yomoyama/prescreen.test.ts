import { describe, it, expect } from "vitest";
import { prescreenYomoyama } from "./prescreen";

describe("prescreenYomoyama", () => {
  it("メールアドレスを検出する", () => {
    expect(prescreenYomoyama("連絡は taro.yamada+dev@example.co.jp まで")).toContain("EMAIL");
  });
  it("電話番号（ハイフン有無・携帯・フリーダイヤル・+81）を検出する", () => {
    for (const t of ["03-1234-5678", "09012345678", "0120 123 456", "+81 90-1234-5678"]) {
      expect(prescreenYomoyama(`番号は ${t} です`), t).toContain("PHONE");
    }
  });
  it("日付・バージョン・金額・短い数字は電話番号と見なさない", () => {
    for (const t of ["2026-10-02 にリリース", "v1.0.12 を入れた", "単価は 650000 円", "0.5秒かかる", "Lv10 になった", "0120"]) {
      expect(prescreenYomoyama(t), t).not.toContain("PHONE");
    }
  });
  it("SNSアカウントを検出し、メール内の@は二重に数えない", () => {
    expect(prescreenYomoyama("Xは @shimadness です")).toEqual(["SNS_HANDLE"]);
    expect(prescreenYomoyama("mail: a@example.com")).toEqual(["EMAIL"]);
  });
  it("ふつうの投稿は通す", () => {
    expect(
      prescreenYomoyama("今日は本番リリースで@付きのメンションが飛び交ってた。React 19 に上げたら動いた")
    ).toEqual([]);
  });
});

import { neutralizeDelimiters } from "@/lib/ai/moderation";
describe("neutralizeDelimiters", () => {
  it("3連以上の < > を全角に置き換え、通常の記号は残す", () => {
    expect(neutralizeDelimiters("a >>> b <<<< c")).toBe("a ＞＞＞ b ＜＜＜＜ c");
    expect(neutralizeDelimiters("x >> y < z")).toBe("x >> y < z");
  });
});
