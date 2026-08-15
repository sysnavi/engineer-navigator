// チャット吹き出し用の軽量Markdownパーサ（依存なし・純ロジック）。
//
// メンターのプロンプトは「## 見出しでセクションを区切る・太字可」を要求しており、
// その生テキストをそのまま表示するとアスタリスクだらけになる、が動機。
// 対応するのはメンター回答に実際に出る範囲だけ: 見出し / 段落 / リスト /
// コードフェンス / **太字** / `インラインコード`。リンクや画像は扱わない。
//
// ストリーミング耐性が最重要の設計制約:
// - 50ms tickごとに「途中まで」のテキストが渡ってくるため、閉じていない記法でも
//   決してテキストを隠さず、決定的に描画できること
// - 閉じていない ** や ` はリテラルのまま出す（閉じたtickで太字/コードに昇格する）
// - 閉じていないコードフェンスは、その時点までをコードブロックとして出す

export type Inline =
  | { t: "text"; text: string }
  | { t: "bold"; text: string }
  | { t: "code"; text: string };

export type Block =
  | { t: "heading"; level: 2 | 3 | 4; inline: Inline[] }
  | { t: "para"; lines: Inline[][] } // 段落内の改行は行の区切りとして保持
  | { t: "list"; ordered: boolean; items: Inline[][] }
  | { t: "codeblock"; text: string };

const HEADING_RE = /^(#{2,4})\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;
const ORDERED_RE = /^\d+[.)]\s+(.*)$/;
const FENCE_RE = /^```/;

/** 1行ぶんのインライン記法（`code` → **bold** の順）をトークン列にする */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let rest = line;
  // `code` を先に切り出す（コード内の ** を太字と誤認しないため）
  while (rest) {
    const start = rest.indexOf("`");
    if (start < 0) break;
    const end = rest.indexOf("`", start + 1);
    if (end < 0) break; // 閉じていないバッククォートはリテラルのまま残す
    if (start > 0) out.push(...parseBold(rest.slice(0, start)));
    out.push({ t: "code", text: rest.slice(start + 1, end) });
    rest = rest.slice(end + 1);
  }
  if (rest) out.push(...parseBold(rest));
  return out;
}

/** **bold** のペアだけを拾う。閉じていない ** はリテラルのまま */
function parseBold(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  for (;;) {
    const m = /\*\*([^*]+?)\*\*/.exec(rest);
    if (!m) break;
    if (m.index > 0) out.push({ t: "text", text: rest.slice(0, m.index) });
    out.push({ t: "bold", text: m[1] });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ t: "text", text: rest });
  return out;
}

/** チャット回答のMarkdownをブロック列にする（行ベース1パス） */
export function parseChatMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let para: Inline[][] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;
  let fence: string[] | null = null;

  function flushPara() {
    if (para.length) blocks.push({ t: "para", lines: para });
    para = [];
  }
  function flushList() {
    if (list) blocks.push({ t: "list", ...list });
    list = null;
  }

  for (const line of text.split("\n")) {
    if (fence) {
      if (FENCE_RE.test(line)) {
        blocks.push({ t: "codeblock", text: fence.join("\n") });
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }
    if (FENCE_RE.test(line)) {
      flushPara();
      flushList();
      fence = [];
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({
        t: "heading",
        level: heading[1].length as 2 | 3 | 4,
        inline: parseInline(heading[2]),
      });
      continue;
    }
    const bullet = BULLET_RE.exec(line);
    const ordered = ORDERED_RE.exec(line);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = !!ordered;
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(parseInline((bullet ?? ordered)![1]));
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    para.push(parseInline(line));
  }
  // 閉じていないフェンスもコードブロックとして出す（ストリーミング途中の見た目を安定させる）
  if (fence) blocks.push({ t: "codeblock", text: fence.join("\n") });
  flushPara();
  flushList();
  return blocks;
}
