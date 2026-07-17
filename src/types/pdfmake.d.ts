// pdfmake 0.3 は型定義を同梱していないため、使用する範囲だけ最小限に宣言する。
// ドキュメント定義は構造が広大なので実用上 DocDefinition として緩く受ける。

declare module "pdfmake" {
  export type PdfContent = unknown;

  export interface DocDefinition {
    pageSize?: string;
    pageMargins?: [number, number, number, number];
    defaultStyle?: Record<string, unknown>;
    styles?: Record<string, Record<string, unknown>>;
    content: PdfContent[];
    footer?: unknown;
    info?: Record<string, string>;
  }

  export interface OutputDocument {
    getBuffer(): Promise<Buffer>;
    getStream(): Promise<NodeJS.ReadableStream>;
  }

  export interface FontDefinition {
    normal: string;
    bold: string;
    italics: string;
    bolditalics: string;
  }

  interface Pdfmake {
    setFonts(fonts: Record<string, FontDefinition>): void;
    setLocalAccessPolicy(cb: (path: string) => boolean): void;
    setUrlAccessPolicy(cb: (url: string) => boolean): void;
    createPdf(dd: DocDefinition, options?: Record<string, unknown>): OutputDocument;
  }

  const pdfmake: Pdfmake;
  export default pdfmake;
}
