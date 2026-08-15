import { describe, expect, it } from "vitest";
import { parseChatMarkdown, parseInline } from "./markdown-parser";

describe("parseInline", () => {
  it("太字とインラインコードを混在で拾う", () => {
    expect(parseInline("SQLの**インデックス**は`CREATE INDEX`で作る")).toEqual([
      { t: "text", text: "SQLの" },
      { t: "bold", text: "インデックス" },
      { t: "text", text: "は" },
      { t: "code", text: "CREATE INDEX" },
      { t: "text", text: "で作る" },
    ]);
  });

  it("コード内の**は太字にしない", () => {
    expect(parseInline("`a ** b`")).toEqual([{ t: "code", text: "a ** b" }]);
  });

  it("閉じていない**はリテラルのまま（ストリーミング途中）", () => {
    expect(parseInline("これは**大事")).toEqual([
      { t: "text", text: "これは**大事" },
    ]);
  });

  it("閉じていないバッククォートはリテラルのまま", () => {
    expect(parseInline("`SELECT")).toEqual([{ t: "text", text: "`SELECT" }]);
  });
});

describe("parseChatMarkdown", () => {
  it("見出し・段落・リストを分ける", () => {
    const blocks = parseChatMarkdown(
      "## まず考え方\n本文1行目\n本文2行目\n\n- 項目A\n- 項目B\n\n1. 手順1\n2. 手順2"
    );
    expect(blocks).toEqual([
      { t: "heading", level: 2, inline: [{ t: "text", text: "まず考え方" }] },
      {
        t: "para",
        lines: [
          [{ t: "text", text: "本文1行目" }],
          [{ t: "text", text: "本文2行目" }],
        ],
      },
      {
        t: "list",
        ordered: false,
        items: [[{ t: "text", text: "項目A" }], [{ t: "text", text: "項目B" }]],
      },
      {
        t: "list",
        ordered: true,
        items: [[{ t: "text", text: "手順1" }], [{ t: "text", text: "手順2" }]],
      },
    ]);
  });

  it("###/####は見出しレベルを保持し、#####は段落扱い", () => {
    expect(parseChatMarkdown("### 補足")).toEqual([
      { t: "heading", level: 3, inline: [{ t: "text", text: "補足" }] },
    ]);
    expect(parseChatMarkdown("##### 深すぎ")[0].t).toBe("para");
  });

  it("コードフェンスを1ブロックにまとめる", () => {
    expect(parseChatMarkdown("```\nconst a = 1;\nconst b = 2;\n```")).toEqual([
      { t: "codeblock", text: "const a = 1;\nconst b = 2;" },
    ]);
  });

  it("閉じていないフェンスもコードブロックとして出す（ストリーミング途中）", () => {
    expect(parseChatMarkdown("説明\n```\nSELECT *")).toEqual([
      { t: "para", lines: [[{ t: "text", text: "説明" }]] },
      { t: "codeblock", text: "SELECT *" },
    ]);
  });

  it("末尾改行なしの見出し（ストリーミング途中）も見出しになる", () => {
    expect(parseChatMarkdown("本文\n\n## 次の一")).toEqual([
      { t: "para", lines: [[{ t: "text", text: "本文" }]] },
      { t: "heading", level: 2, inline: [{ t: "text", text: "次の一" }] },
    ]);
  });

  it("メンター回答の形（##3セクション+太字+コード）を通しで描画できる", () => {
    const answer = [
      "## まず考え方だけつかもう",
      "インデックスは本の索引と同じで、**探す回数を減らす**仕組みです。",
      "",
      "## 現場だとこう使う",
      "遅いクエリを見つけたら `EXPLAIN` で実行計画を確認します。",
      "```sql",
      "CREATE INDEX idx_user_email ON users(email);",
      "```",
      "",
      "## 次の一歩",
      "手元のDBで `EXPLAIN` を1回叩いてみましょう。",
    ].join("\n");
    const blocks = parseChatMarkdown(answer);
    const headings = blocks.filter((b) => b.t === "heading");
    expect(headings).toHaveLength(3);
    expect(blocks.some((b) => b.t === "codeblock")).toBe(true);
    // セクション送り（sectionLimit）が見る生テキストの ## はパースで壊れていないことの裏返し:
    // 見出しタイトルが原文どおり取れている
    expect(headings[2]).toEqual({
      t: "heading",
      level: 2,
      inline: [{ t: "text", text: "次の一歩" }],
    });
  });

  it("空文字はブロックなし（ストリーミング開始直後）", () => {
    expect(parseChatMarkdown("")).toEqual([]);
  });
});
