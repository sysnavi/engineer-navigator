import type { ReactNode } from "react";

// 8bit / レトロGUI の共通部品（サーバーコンポーネント）。
// 見た目のトークンとクラスは globals.css を参照。

export function Window(props: {
  title: string;
  titleEm?: string; // 拡張子部分（.exe / .sav 等）をペリ色で
  barClass?: string; // タイトルバーの色替え（例: "!bg-pinkhot"）
  className?: string;
  bodyClass?: string;
  children: ReactNode;
}) {
  return (
    <section className={`win8 ${props.className ?? ""}`}>
      <div className={`win8-bar ${props.barClass ?? ""}`}>
        <span className="win8-dot" style={{ background: "var(--pink-hot)" }} />
        <span className="win8-dot" style={{ background: "var(--lemon)" }} />
        <span className="win8-dot" style={{ background: "#7ED957" }} />
        <span className="win8-title">
          {props.title}
          {props.titleEm && <em>{props.titleEm}</em>}
        </span>
        <span className="win8-close" aria-hidden="true">
          ×
        </span>
      </div>
      <div className={props.bodyClass ?? "p-5"}>{props.children}</div>
    </section>
  );
}

/** ピクセルフォントの見出し */
export function PixelTitle(props: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const Tag = props.as ?? "h2";
  return (
    <Tag className={`font-pixel tracking-wide ${props.className ?? ""}`}>
      {props.children}
    </Tag>
  );
}

/** 英字の小ラベル（QUESTION 01 等） */
export function PixelLabel(props: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`font-pixel text-[12px] tracking-[0.12em] text-royal2 ${props.className ?? ""}`}
    >
      {props.children}
    </p>
  );
}

/** スキルレベルの光るブロック（1-5） */
export function LevelBlocks(props: { level: number; max?: number }) {
  const max = props.max ?? 5;
  return (
    <span
      className="inline-flex gap-1"
      role="img"
      aria-label={`レベル${props.level} / ${max}`}
    >
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={`blk8 ${i < props.level ? "f" : ""}`} />
      ))}
    </span>
  );
}
