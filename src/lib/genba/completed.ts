// 再訪案件の解禁判定に使う満了履歴の導出（サーバー専用・クライアントからimport禁止）。
// logic.ts は prisma 依存禁止のためここに分離。page.tsx と actions.ts は必ずこれを
// 使うこと——導出がズレると resolveOffer の「きょうの提示に実在するか」検証が壊れる。

import { prisma } from "@/lib/db";
import { completedTrustMap } from "./logic";

/** テンプレID → 満了時しんらいの最大値（COMPLETEDの契約のみ） */
export async function completedTrustByTemplate(
  userId: string
): Promise<Map<string, number>> {
  const rows = await prisma.genbaContract.findMany({
    where: { userId, status: "COMPLETED" },
    select: { offerId: true, trust: true },
  });
  return completedTrustMap(rows);
}
