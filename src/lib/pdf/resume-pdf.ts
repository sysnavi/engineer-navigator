import { join } from "node:path";
import pdfmake, { type DocDefinition, type PdfContent } from "pdfmake";
import {
  CATEGORY_LABELS,
  LEVEL_DEFS,
  fmtMonth,
  type ResumeData,
} from "@/lib/resume-data";
import { splitByKeywords } from "@/lib/highlight";

// 経歴書のPDF組版（サーバー専用）。画面の8bit装飾は使わず、そのまま渡せる通常組版にする。
// PDFエンジンは pdfmake: UAX#14の行分割で日本語をハイフン無しで正しく折り返せる
// （react-pdf/textkit は単語内改行に必ずハイフンを描画するため日本語と相性が悪い）。
// 日本語フォントは IPAexゴシック（assets/fonts/、ライセンス同梱）。

const NAVY = "#12235F";
const BLUE = "#2A6FD6";
const GRAY = "#5B6575";
const LINE = "#C9D2E0";

const FONT = join(process.cwd(), "assets", "fonts", "ipaexg.ttf");
pdfmake.setFonts({
  IPAexGothic: { normal: FONT, bold: FONT, italics: FONT, bolditalics: FONT },
});
// フォント以外のローカル/外部リソースは読み込まない
pdfmake.setLocalAccessPolicy((p) => p.startsWith(process.cwd()));
pdfmake.setUrlAccessPolicy(() => false);

/** 単価交渉キーワードを下線＋ネイビーで強調したリッチテキスト */
function kw(text: string): PdfContent {
  return {
    text: splitByKeywords(text).map((p) =>
      p.isKeyword
        ? { text: p.text, color: NAVY, decoration: "underline" }
        : { text: p.text }
    ),
  };
}

function levelBlocks(level: number): string {
  return "■".repeat(level) + "□".repeat(5 - level);
}

/** 横罫線だけの薄いテーブルレイアウト */
const rowLines = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
  hLineColor: () => LINE,
  paddingLeft: () => 0,
  paddingRight: () => 6,
  paddingTop: () => 3.5,
  paddingBottom: () => 3.5,
};

function sectionTitle(text: string): PdfContent {
  return { text, fontSize: 11.5, color: NAVY, margin: [0, 10, 0, 5] };
}

export function buildResumeDoc(userName: string, data: ResumeData): DocDefinition {
  const {
    skills,
    experiences,
    assignments,
    roleplays,
    roleplayList,
    byCategory,
    updated,
  } = data;

  const content: PdfContent[] = [
    // ヘッダー
    {
      columns: [
        {
          stack: [
            { text: "経歴書（スキルシート）", fontSize: 17, color: NAVY },
            { text: userName, fontSize: 13, margin: [0, 2, 0, 0] },
          ],
        },
        {
          text: `更新日: ${updated}`,
          alignment: "right",
          fontSize: 8.5,
          color: GRAY,
          margin: [0, 8, 0, 0],
        },
      ],
    },
    {
      canvas: [
        { type: "line", x1: 0, y1: 0, x2: 503, y2: 0, lineWidth: 1.2, lineColor: NAVY },
      ],
      margin: [0, 6, 0, 8],
    },
    {
      text:
        `スキル ${skills.length} 件 ・ 実績 ${experiences.length} 件 ・ 経歴 ${assignments.length} 件` +
        (roleplays.length > 0 ? ` ・ リーダーシップ演習 ${roleplays.length} 回` : "") +
        " — 週報の記録と本人承認から自動生成。",
      fontSize: 9,
      color: GRAY,
      margin: [0, 0, 0, 4],
    },
  ];

  // スキル
  content.push(sectionTitle("■ スキル"));
  for (const [category, list] of byCategory.entries()) {
    content.push({
      text: CATEGORY_LABELS[category] ?? category,
      fontSize: 8.5,
      color: BLUE,
      margin: [0, 4, 0, 2],
    });
    content.push({
      table: {
        widths: ["34%", "24%", "*"],
        body: list.map((es) => [
          { text: es.skill.name },
          { text: `${levelBlocks(es.level)} Lv${es.level}`, color: NAVY },
          {
            text:
              (LEVEL_DEFS[es.level] ?? "") +
              (es.monthsExperience != null ? ` ・ ${es.monthsExperience}ヶ月` : ""),
            fontSize: 8.5,
            color: GRAY,
          },
        ]),
      },
      layout: rowLines,
    });
  }

  // 実績
  if (experiences.length > 0) {
    content.push(sectionTitle("■ 実績"));
    for (const e of experiences) {
      content.push({
        unbreakable: true,
        stack: [
          { ...(kw(e.skillName) as object), fontSize: 10.5 },
          {
            text: `${e.sourceReport.weekStart.toISOString().slice(0, 10)} の週報より`,
            fontSize: 8,
            color: GRAY,
            margin: [0, 1, 0, 2],
          },
          kw(e.reason),
          ...(e.evidenceQuote
            ? [
                {
                  text: `根拠:「${e.evidenceQuote}」`,
                  fontSize: 8.5,
                  color: GRAY,
                  margin: [8, 2, 0, 0],
                },
              ]
            : []),
        ],
        margin: [0, 0, 0, 8],
      });
    }
  }

  // リーダーシップ演習
  if (roleplayList.length > 0) {
    content.push(sectionTitle(`■ リーダーシップ演習（${roleplays.length}回）`));
    content.push({
      text: "顧客折衝・障害対応・メンバー育成の実践演習を実施し、職務定義に基づく評価を受けています。",
      fontSize: 8.5,
      color: GRAY,
      margin: [0, 0, 0, 3],
    });
    content.push({
      table: {
        widths: ["50%", "14%", "*"],
        body: roleplayList.map((r) => [
          { text: r.title },
          { text: `${r.count}回`, color: NAVY },
          {
            text:
              (r.bestScore != null ? `最高評価 ${r.bestScore}点` : "—") +
              ` ・ ${r.lastAt.toISOString().slice(0, 10)}`,
            fontSize: 8.5,
            color: GRAY,
          },
        ]),
      },
      layout: rowLines,
    });
  }

  // 経歴
  if (assignments.length > 0) {
    content.push(sectionTitle("■ 経歴"));
    content.push({
      table: {
        widths: ["*", "26%"],
        body: assignments.map((a) => [
          {
            stack: [
              {
                text:
                  a.project.name +
                  (a.project.clientAlias ? `（${a.project.clientAlias}）` : ""),
              },
              ...(a.roleNote
                ? [{ ...(kw(a.roleNote) as object), fontSize: 8.5, color: GRAY }]
                : []),
            ],
          },
          {
            text: `${fmtMonth(a.startedAt)} — ${fmtMonth(a.endedAt)}`,
            alignment: "right",
            fontSize: 8.5,
            color: GRAY,
          },
        ]),
      },
      layout: rowLines,
    });
  }

  return {
    pageSize: "A4",
    pageMargins: [46, 42, 46, 48],
    info: { title: `経歴書 - ${userName}`, author: "Engineer Navigator" },
    defaultStyle: {
      font: "IPAexGothic",
      fontSize: 9.5,
      color: "#1B1F27",
      lineHeight: 1.35,
    },
    content,
    footer: {
      text: "Engineer Navigator で自動生成 ・ 下線は単価交渉で効くキーワード",
      alignment: "center",
      fontSize: 7.5,
      color: GRAY,
      margin: [46, 10, 46, 0],
    },
  };
}

export async function renderResumePdf(
  userName: string,
  data: ResumeData
): Promise<Buffer> {
  const doc = pdfmake.createPdf(buildResumeDoc(userName, data));
  return doc.getBuffer();
}
