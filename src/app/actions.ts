"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mondayOf } from "@/lib/week";
import { analyzeReport } from "@/lib/ai/analyzeReport";
import { completeJson, type ChatMessage } from "@/lib/ai/client";
import { extractDraft } from "@/lib/ai/interview";
import { generatePlanItems } from "@/lib/ai/studyplan";
import { generateOpeningLine, generateFeedback } from "@/lib/ai/roleplay";
import { isPaletteId } from "@/lib/palettes";
import { isUiShell } from "@/lib/shell";
import { isDomainId } from "@/lib/domains";
import { assertAiAllowed, AiBlockedError } from "@/lib/usage";
import { performRebirth } from "@/lib/exp";
import { createInvite } from "@/lib/invite";
import { SESSION_COOKIE } from "@/lib/session";

/** AiBlockedError をフォーム表示用の分かりやすい Error に変換して投げ直す */
function throwFriendly(e: unknown): never {
  if (e instanceof AiBlockedError) throw new Error(e.userMessage);
  throw e;
}
import {
  createConsultationAlert,
  runWeeklyScan,
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
  if (!user.consentedAt) {
    throw new Error("週報の利用にはオンボーディングでの同意が必要です");
  }
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
  if (!user.consentedAt) {
    throw new Error("週報の利用にはオンボーディングでの同意が必要です");
  }
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
  // 停止中・レート超過なら解析はスキップ（提出自体は成功。ANTHROPIC_API_KEY未設定時と同じ扱い）
  try {
    await assertAiAllowed(user.id, "report-analysis");
    await analyzeReport(report.id);
  } catch (e) {
    // 解析失敗しても提出自体は成功扱い（ReportAnalysis.status=FAILEDに記録済み）
    console.error("analyzeReport skipped/failed:", e);
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
  await runWeeklyScan();
  revalidatePath("/condition");
}

// ---------------------------------------------------------------------------
// 公開共有（プロフィール / 週報）
// ---------------------------------------------------------------------------

const HANDLE_RE = /^[a-z0-9_-]{3,20}$/;

export async function updateShareSettings(formData: FormData) {
  const user = await getCurrentUser();
  const rawHandle = formData.get("handle");
  const bio = formData.get("bio");
  const isPublic = formData.get("isPublic") === "on";

  let handle: string | null = null;
  if (typeof rawHandle === "string" && rawHandle.trim() !== "") {
    handle = rawHandle.trim().toLowerCase();
    if (!HANDLE_RE.test(handle)) {
      throw new Error(
        "ハンドルは半角英数字・ハイフン・アンダースコア3〜20文字で入力してください"
      );
    }
    const taken = await prisma.user.findFirst({
      where: { handle, id: { not: user.id } },
      select: { id: true },
    });
    if (taken) throw new Error("そのハンドルは既に使われています");
  }

  // 公開するにはハンドルが必須
  if (isPublic && !handle) {
    throw new Error("公開するにはハンドルを設定してください");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      handle,
      bio: typeof bio === "string" && bio.trim() !== "" ? bio.trim() : null,
      isPublic,
    },
  });
  revalidatePath("/mypage");
  revalidatePath("/discover");
}

// 目指す技術領域（キャリアの方向性）を保存。値は src/lib/domains.ts のIDのみ許可。
export async function updateTargetDomains(formData: FormData) {
  const user = await getCurrentUser();
  const domains = formData
    .getAll("domains")
    .filter((v): v is string => typeof v === "string")
    .filter(isDomainId);
  await prisma.user.update({
    where: { id: user.id },
    data: { targetDomains: Array.from(new Set(domains)) },
  });
  revalidatePath("/mypage");
}

export async function toggleReportPublic(reportId: string, isPublic: boolean) {
  const user = await getCurrentUser();
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    select: { userId: true },
  });
  if (!report || report.userId !== user.id) {
    throw new Error("この週報を更新できません");
  }
  await prisma.weeklyReport.update({
    where: { id: reportId },
    data: { isPublic },
  });
  revalidatePath("/mypage");
}

// ---------------------------------------------------------------------------
// アバター継承（転生・Issue #1）
// ---------------------------------------------------------------------------

/** 転生（継承）: 本人の明示操作からのみ。データは一切消さず、世代の墓標を1行残す。
 *  結果はマイページの孵化演出モーダルで表示する。 */
export async function rebirthAvatar() {
  const user = await getCurrentUser();
  const result = await performRebirth(user.id);
  revalidatePath("/mypage");
  revalidatePath("/");
  return result;
}

// ---------------------------------------------------------------------------
// オンボーディング同意（AI解析・閲覧範囲・評価不使用）
// ---------------------------------------------------------------------------

export async function giveConsent() {
  const user = await getCurrentUser();
  if (user.consentedAt) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { consentedAt: new Date() },
  });
  revalidatePath("/report");
  revalidatePath("/mypage");
}

/** 初回チュートリアル完了（以後は自動表示しない・Issue #5） */
export async function completeTutorial() {
  const user = await getCurrentUser();
  if (user.tutorialCompletedAt) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { tutorialCompletedAt: new Date() },
  });
  revalidatePath("/", "layout");
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
// アカウント停止（管理者のみ・スパム/過剰利用対策）
// ---------------------------------------------------------------------------

export async function setUserSuspended(userId: string, suspend: boolean) {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") {
    throw new Error("この操作は管理者のみ実行できます");
  }
  if (suspend && userId === me.id) {
    throw new Error("自分自身は停止できません");
  }
  await prisma.user.update({
    where: { id: userId },
    data: suspend
      ? { suspendedAt: new Date(), suspendReason: "管理者による手動停止" }
      : { suspendedAt: null, suspendReason: null },
  });
  revalidatePath("/mypage");
}

// ---------------------------------------------------------------------------
// 招待リンク（管理者のみ発行/失効） + ログアウト
// ---------------------------------------------------------------------------

export async function createInviteLink(formData: FormData) {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") {
    throw new Error("この操作は管理者のみ実行できます");
  }
  const note = formData.get("note");
  await createInvite(typeof note === "string" ? note : null);
  revalidatePath("/mypage");
}

export async function revokeInvite(inviteId: string) {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") {
    throw new Error("この操作は管理者のみ実行できます");
  }
  await prisma.invite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/mypage");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete("dev-user");
  redirect("/welcome");
}

// ---------------------------------------------------------------------------
// AIメンター（Phase 3）
// ---------------------------------------------------------------------------

export async function createMentorSession(formData: FormData) {
  const user = await getCurrentUser();
  const topic = formData.get("topic");
  const certification = formData.get("certification");
  const firstMessage = formData.get("firstMessage");

  const nonEmpty = (v: FormDataEntryValue | null) =>
    typeof v === "string" && v.trim().length > 0;
  // 未入力ガード: 何も書かずに空のセッションを作らせない
  if (!nonEmpty(topic) && !nonEmpty(certification) && !nonEmpty(firstMessage)) {
    throw new Error(
      "相談したいこと（資格・テーマ・聞きたいこと のいずれか）を入力してください。"
    );
  }

  const session = await prisma.mentorSession.create({
    data: {
      userId: user.id,
      topic: typeof topic === "string" && topic.trim() ? topic.trim() : null,
      certification:
        typeof certification === "string" && certification.trim()
          ? certification.trim()
          : null,
      messages:
        typeof firstMessage === "string" && firstMessage.trim()
          ? { create: { role: "USER", content: firstMessage.trim() } }
          : undefined,
    },
  });
  revalidatePath("/mentor");
  redirect(`/mentor/${session.id}`);
}

/** 週報の「詰まりごと」から学習トピックを先回り提案（本人が起動） */
export async function proposeStudyTopics() {
  const user = await getCurrentUser();
  const reports = await prisma.weeklyReport.findMany({
    where: { userId: user.id, status: "SUBMITTED" },
    orderBy: { weekStart: "desc" },
    take: 4,
    select: { struggleText: true, newText: true },
  });
  const struggles = reports
    .map((r) => [r.struggleText, r.newText].filter(Boolean).join(" / "))
    .filter(Boolean)
    .join("\n");

  if (!struggles) {
    return { topics: [] as StudyTopic[] };
  }

  try {
    await assertAiAllowed(user.id, "study-topics");
    const { data } = await completeJson<{ topics: StudyTopic[] }>({
      system: `あなたはSES企業の技術メンターです。エンジニアの週報の「詰まったこと・新しく触れた技術」から、次に学ぶと効果的な学習トピックを2〜3件提案します。
出力はJSONのみ。各トピックは title(短い学習テーマ), why(なぜ今これか・1文), firstQuestion(メンターに最初に聞くと良い具体的な問い) を持つ。
スキーマ: { "topics": [{ "title": string, "why": string, "firstQuestion": string }] }`,
      user: `## 最近の週報から\n${struggles}`,
    });
    return { topics: (data.topics ?? []).slice(0, 3) };
  } catch (e) {
    console.error("proposeStudyTopics failed:", e);
    const error =
      e instanceof AiBlockedError ? e.userMessage : "提案の生成に失敗しました";
    return { topics: [] as StudyTopic[], error };
  }
}

export type StudyTopic = { title: string; why: string; firstQuestion: string };

// ---------------------------------------------------------------------------
// 資格別学習プラン（Phase 3）
// ---------------------------------------------------------------------------

const DAY_MS = 86400_000;

export async function createStudyPlan(formData: FormData) {
  const user = await getCurrentUser();
  const certification = formData.get("certification");
  const examDateRaw = formData.get("examDate");
  if (typeof certification !== "string" || !certification.trim()) {
    throw new Error("資格名を入力してください");
  }
  if (typeof examDateRaw !== "string" || !examDateRaw) {
    throw new Error("試験日を入力してください");
  }
  const examDate = new Date(examDateRaw + "T00:00:00Z");
  const now = new Date();
  const daysLeft = Math.ceil((examDate.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft < 3) {
    throw new Error("試験日は3日以上先の日付にしてください");
  }
  const weeks = Math.min(16, Math.max(1, Math.ceil(daysLeft / 7)));

  const skills = await prisma.engineerSkill.findMany({
    where: { userId: user.id },
    include: { skill: true },
    orderBy: { level: "desc" },
    take: 15,
  });
  const currentSkills = skills
    .map((s) => `${s.skill.name}(Lv${s.level})`)
    .join(", ");

  await assertAiAllowed(user.id, "study-plan").catch(throwFriendly);

  const items = await generatePlanItems({
    certification: certification.trim(),
    weeks,
    currentSkills,
  });

  const monday = mondayOf(now);
  const plan = await prisma.studyPlan.create({
    data: {
      userId: user.id,
      certification: certification.trim(),
      examDate,
      items: {
        create: items.map((it, i) => ({
          order: i,
          weekLabel: it.weekLabel,
          title: it.title,
          detail: it.detail,
          // 週次で目安日を割り当て、最後は試験日
          targetDate:
            i === items.length - 1
              ? examDate
              : new Date(monday.getTime() + (i + 1) * 7 * DAY_MS),
        })),
      },
    },
  });
  revalidatePath("/plan");
  redirect(`/plan/${plan.id}`);
}

export async function toggleStudyItem(itemId: string, done: boolean) {
  const user = await getCurrentUser();
  const item = await prisma.studyPlanItem.findUnique({
    where: { id: itemId },
    include: { plan: true },
  });
  if (!item || item.plan.userId !== user.id) {
    throw new Error("この項目を更新できません");
  }
  await prisma.studyPlanItem.update({
    where: { id: itemId },
    data: { done, doneAt: done ? new Date() : null },
  });
  revalidatePath(`/plan/${item.planId}`);
}

// ---------------------------------------------------------------------------
// 役割シミュレーター（Phase 4）
// ---------------------------------------------------------------------------

export async function startRoleplay(scenarioId: string) {
  const user = await getCurrentUser();
  // 停止中・レート超過ならセッションを作らせない（開始時に相手役の生成でトークンを使うため）
  await assertAiAllowed(user.id, "roleplay-start").catch(throwFriendly);
  await prisma.roleplayScenario.findUniqueOrThrow({ where: { id: scenarioId } });

  const session = await prisma.roleplaySession.create({
    data: { userId: user.id, scenarioId, status: "IN_PROGRESS" },
  });

  // 相手役の第一声を生成して保存（失敗してもセッションは開始できる）
  try {
    const opening = await generateOpeningLine(scenarioId);
    if (opening.trim()) {
      await prisma.roleplayMessage.create({
        data: { sessionId: session.id, role: "ASSISTANT", content: opening },
      });
    }
  } catch (e) {
    console.error("generateOpeningLine failed:", e);
  }

  redirect(`/roleplay/${session.id}`);
}

export async function endRoleplay(sessionId: string) {
  const user = await getCurrentUser();
  const session = await prisma.roleplaySession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  if (session.userId !== user.id) throw new Error("自分の演習のみ終了できます");
  if (session.status === "COMPLETED") {
    revalidatePath(`/roleplay/${sessionId}`);
    return;
  }

  // 未入力ガード: 1回もやり取りしていない演習は評価できない。
  // UI側でも終了ボタンを無効化しているが、直接呼ばれても無駄なAI呼び出しをしないための保険。
  const userTurns = await prisma.roleplayMessage.count({
    where: { sessionId, role: "USER" },
  });
  if (userTurns === 0) {
    throw new Error(
      "まだやり取りがありません。相手役と1回はやり取りしてから終了してください。"
    );
  }

  // 停止中・レート超過なら終了処理を保留（後で再試行できるようセッションは進行中のまま）
  await assertAiAllowed(user.id, "roleplay-feedback").catch(throwFriendly);

  let feedbackText: string;
  try {
    const fb = await generateFeedback(sessionId);
    feedbackText = JSON.stringify(fb);
  } catch (e) {
    console.error("generateFeedback failed:", e);
    feedbackText = JSON.stringify({
      perObjective: [],
      overall: "フィードバックの生成に失敗しました（ANTHROPIC_API_KEYを確認してください）。",
      advice: "",
      score: 0,
    });
  }

  await prisma.roleplaySession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED", feedback: feedbackText },
  });
  revalidatePath(`/roleplay/${sessionId}`);
}

// ---------------------------------------------------------------------------
// きせかえ（カラーパレット）
// ---------------------------------------------------------------------------

/** UIシェル（デスクトップ/クラシック）の切替。旧UIへの「ロールバック」はこの設定で行う */
export async function setUiShell(shell: string) {
  const user = await getCurrentUser();
  if (!isUiShell(shell)) throw new Error("不正なUIモードです");
  await prisma.user.update({
    where: { id: user.id },
    data: { uiShell: shell },
  });
  revalidatePath("/", "layout");
}

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
// 週報インタビューモード: 会話ログ → 7設問ドラフトに変換して下書き保存
// ---------------------------------------------------------------------------

export async function summarizeInterview(transcript: ChatMessage[]) {
  const user = await getCurrentUser();
  if (!user.consentedAt) {
    throw new Error("週報の利用にはオンボーディングでの同意が必要です");
  }
  if (
    !Array.isArray(transcript) ||
    transcript.length === 0 ||
    transcript.length > 40 ||
    !transcript.every(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length <= 2000
    )
  ) {
    throw new Error("インタビューの内容が不正です");
  }

  await assertAiAllowed(user.id, "interview-summarize").catch(throwFriendly);

  const draft = await extractDraft(transcript);
  const weekStart = mondayOf(new Date());

  // 既存の下書き/提出済みに保存（提出済みステータスは変えない=フォームと同じ挙動）。
  // update はインタビューで話題に出た設問だけの部分更新にする —
  // null で上書きすると、触れなかった設問の既存の記入が消えてしまうため。
  const touched = Object.fromEntries(
    Object.entries(draft).filter(([, v]) => v !== null)
  );
  await prisma.weeklyReport.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    update: touched,
    create: { ...draft, userId: user.id, weekStart },
  });
  revalidatePath("/report");
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
