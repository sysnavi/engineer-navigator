import { describe, expect, it } from "vitest";
import { sanitizeForSpeech } from "./sanitize";

describe("sanitizeForSpeech", () => {
  it("絵文字を取り除く", () => {
    expect(sanitizeForSpeech("おつかれさま！☀️今週はどうだった？🎤")).toBe(
      "おつかれさま！今週はどうだった？"
    );
  });

  it("選択肢の区切りスラッシュを読点にする", () => {
    expect(sanitizeForSpeech("☀️好調 / 🌤普通 / ☁️モヤモヤ / 🌧しんどい")).toBe(
      "好調、普通、モヤモヤ、しんどい"
    );
  });

  it("箇条書きの行頭記号を落とす", () => {
    expect(sanitizeForSpeech("・APIを直した\n・レビューした")).toBe(
      "APIを直した\nレビューした"
    );
  });

  it("装飾記号と連続改行を整理する", () => {
    expect(sanitizeForSpeech("★ 材料がそろいました\n\n\n▶ 次へ")).toBe(
      "材料がそろいました\n次へ"
    );
  });

  it("通常の日本語文はそのまま", () => {
    const text = "先週はNext.jsのアップグレードやるって言ってたけど、どうだった？";
    expect(sanitizeForSpeech(text)).toBe(text);
  });

  it("空・記号のみは空文字になる", () => {
    expect(sanitizeForSpeech("☀️ ★ ▶")).toBe("");
  });
});
