import type { ReactNode } from "react";
import { type Block, type Inline, parseChatMarkdown } from "./markdown-parser";

// チャット吹き出しのMarkdown描画（メンター回答用）。
// パースは markdown.ts の純関数、ここは見た目だけ。Reactノードとして組み立てるので
// dangerouslySetInnerHTML は使わない（エスケープはReact任せで安全）。
// ストリーミング中は50msごとに全文再パースされるが、数KBの線形処理なので問題ない。

function renderInline(inline: Inline[]): ReactNode[] {
  return inline.map((node, i) => {
    if (node.t === "bold")
      return (
        <b key={i} className="font-extrabold">
          {node.text}
        </b>
      );
    if (node.t === "code")
      return (
        <code
          key={i}
          className="rounded bg-surface2 px-1 font-mono8 text-[12.5px]"
        >
          {node.text}
        </code>
      );
    return node.text;
  });
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.t) {
    case "heading":
      // ## はレトロなセクション見出しに（PixelLabelの意匠に寄せる）。###以下は控えめに
      return block.level === 2 ? (
        <h3
          key={key}
          className="mt-3 mb-1.5 flex items-center gap-1.5 font-pixel text-[12px] tracking-[0.08em] text-royal2 first:mt-0"
        >
          <span aria-hidden="true">▸</span>
          {renderInline(block.inline)}
        </h3>
      ) : (
        <h4
          key={key}
          className="mt-2.5 mb-1 font-pixel text-[11px] tracking-[0.08em] text-inksoft first:mt-0"
        >
          {renderInline(block.inline)}
        </h4>
      );
    case "para":
      return (
        <p key={key} className="my-1.5 first:mt-0 last:mb-0">
          {block.lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {renderInline(line)}
            </span>
          ))}
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          key={key}
          className={`my-1.5 list-inside space-y-1 ${
            block.ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case "codeblock":
      return (
        <pre
          key={key}
          className="my-2 overflow-x-auto whitespace-pre rounded-md border-2 border-line8 bg-surface2 p-2.5 font-mono8 text-[12px] leading-relaxed"
        >
          {block.text}
        </pre>
      );
  }
}

export function ChatMarkdown(props: { text: string }) {
  return <>{parseChatMarkdown(props.text).map(renderBlock)}</>;
}
