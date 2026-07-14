"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mondayOf } from "@/lib/week";
import { analyzeReport } from "@/lib/ai/analyzeReport";
import { isPaletteId } from "@/lib/palettes";
import {
  createConsultationAlert,
  scanAllEngineers,
  getScopedEngineers,
} from "@/lib/condition";

// ---------------------------------------------------------------------------
// 週報
// ---------------------------------------------------------------------------

function reportDataFromForm(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    return v ? Number(v) : null;
  };
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };
  return {
    conditionSelf: num("conditionSelf"),
    workloadSelf: num("workloadSelf"),
    didText: str("didText"),
    newText: str("newText"),
    struggleText: str("struggleText"),
    nextText: str("nextText"),
    shareText: str("shareText"),
    wantsConsultation: formData.get("wantsConsultation") === "on",
  };
}

export async function saveReportDraft(formData: FormData) {
  const user = await getCurrentUser();
  const weekStart = mondayOf(new Date());
  const data = reportDataFromForm(formData);

  await prisma.weeklyReport.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    update: data,
    create: { ...data, userId: user.id, weekStart },
  });
  revalidatePath("/report");
}

export async function submitReport(formData: FormData) {
  const user = await getCurrentUser();
  const weekStart = mondayOf(new Date());
  const data = reportDataFromForm(formData);

  if (!data.didText || data.conditionSelf == null || data.workloadSelf == null) {
    throw new Error("必須項目（コンディション・稼働・今週やったこと）を入力してください");
  }

  const report = await prisma.weeklyReport.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    update: { ...data, status: "SUBMITTED", submittedAt: new Date() },
    create: {
      ...data,
      userId: user.id,
      weekStart,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  // 「営業に直接相談したい」は解析を待たず即時アラート（仕様: docs/weekly-report.md）
  if (data.wantsConsultation) {
    await createConsultationAlert(user.id).catch((e) =>
      console.error("createConsultationAlert failed:", e)
    );
  }

  // AI解析（MVPでは同期実行。将来はジョブキューへ）
  try {
    await analyzeReport(report.id);
  } catch (e) {
    // 解析失敗しても提出自体は成功扱い（ReportAnalysis.status=FAILEDに記録済み）
    console.error("analyzeReport failed:", e);
  }

  revalidatePath("/report");
  revalidatePath("/skills");
  revalidatePath("/condition");
}

// ---------------------------------------------------------------------------
// コンディションアラート（Phase 2）— 閲覧・操作は ADMIN / 担当営業のみ
// ---------------------------------------------------------------------------

/** viewer がこのアラートを操作できるか（ADMIN=全件 / SALES=担当エンジニアのみ） */
async function assertAlertScope(alertId: string) {
  const viewer = await getCurrentUser();
  if (viewer.role !== "ADMIN" && viewer.role !== "SALES") {
    throw new Error("コンディション情報へのアクセス権限がありません");
  }
  const alert = await prisma.conditionAlert.findUniqueOrThrow({
    where: { id: alertId },
  });
  if (viewer.role === "SALES") {
    const scoped = await getScopedEngineers(viewer);
    if (!scoped.some((e) => e.id === alert.userId)) {
      throw new Error("担当外のエンジニアのアラートは操作できません");
    }
  }
  return alert;
}

export async function startAlert(alertId: string) {
  await assertAlertScope(alertId);
  await prisma.conditionAlert.update({
    where: { id: alertId },
    data: { status: "IN_PROGRESS" },
  });
  revalidatePath("/condition");
}

export async function closeAlert(alertId: string, formData: FormData) {
  await assertAlertScope(alertId);
  const note = formData.get("note");
  if (typeof note !== "string" || note.trim() === "") {
    throw new Error("対応記録（面談メモ）を入力してください");
  }
  await prisma.conditionAlert.update({
    where: { id: alertId },
    data: { status: "CLOSED", note: note.trim(), closedAt: new Date() },
  });
  revalidatePath("/condition");
}

export async function rescanConditions() {
  const viewer = await getCurrentUser();
  if (viewer.role !== "ADMIN" && viewer.role !== "SALES") {
    throw new Error("コンディション情報へのアクセス権限がありません");
  }
  await scanAllEngineers();
  revalidatePath("/condition");
}

// ---------------------------------------------------------------------------
// 開発用ユーザー切替（DEV_LOGIN_ENABLED のときのみ・本番はSSOに置換）
// ---------------------------------------------------------------------------

export async function setDevUser(email: string) {
  if (process.env.DEV_LOGIN_ENABLED !== "true") {
    throw new Error("開発用ログインは無効です");
  }
  await prisma.user.findUniqueOrThrow({ where: { email } });
  const store = await cookies();
  store.set("dev-user", email, { path: "/" });
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------------------
// きせかえ（カラーパレット）
// ---------------------------------------------------------------------------

export async function setPalette(palette: string) {
  const user = await getCurrentUser();
  if (!isPaletteId(palette)) {
    throw new Error(`不明なパレットです: ${palette}`);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { palette },
  });
  // <html data-palette> はルートレイアウトが刻むため全体を再検証
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// スキル提案の承認 / 却下
// ---------------------------------------------------------------------------

export async function decideSuggestion(suggestionId: string, approve: boolean) {
  const user = await getCurrentUser();
  const suggestion = await prisma.skillSuggestion.findUniqueOrThrow({
    where: { id: suggestionId },
  });
  if (suggestion.userId !== user.id) {
    throw new Error("自分あての提案のみ承認できます");
  }
  if (suggestion.status !== "PENDING") return;

  if (!approve) {
    await prisma.skillSuggestion.update({
      where: { id: suggestionId },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    revalidatePath("/skills");
    return;
  }

  // 承認: スキルマスタに無ければ作成 → EngineerSkill 反映 → 履歴
  let skillId = suggestion.skillId;
  if (!skillId) {
    const skill = await prisma.skill.upsert({
      where: { name: suggestion.skillName },
      update: {},
      create: { name: suggestion.skillName, category: "OTHER", aliases: [] },
    });
    skillId = skill.id;
  }

  const level = suggestion.suggestedLevel ?? 1;
  const engineerSkill = await prisma.engineerSkill.upsert({
    where: { userId_skillId: { userId: user.id, skillId } },
    update: { level, lastUsedAt: new Date() },
    create: { userId: user.id, skillId, level, lastUsedAt: new Date() },
  });

  await prisma.skillHistory.create({
    data: {
      engineerSkillId: engineerSkill.id,
      level,
      sourceNote: `週報のAI提案を承認（${suggestion.reason}）`,
    },
  });

  await prisma.skillSuggestion.update({
    where: { id: suggestionId },
    data: { status: "APPROVED", skillId, decidedAt: new Date() },
  });

  revalidatePath("/skills");
}
