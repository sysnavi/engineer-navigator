import { getCurrentUser } from "@/lib/auth";
import { loadResumeData } from "@/lib/resume-data";
import { renderResumePdf } from "@/lib/pdf/resume-pdf";

// 経歴書のPDFダウンロード。印刷ダイアログを経由せず、そのまま渡せる通常組版のPDFを直接返す。

export async function GET() {
  const user = await getCurrentUser();
  const data = await loadResumeData(user.id);
  const buf = await renderResumePdf(user.name, data);

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="career-sheet.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
