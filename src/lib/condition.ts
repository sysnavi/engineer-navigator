import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";
import { notifyAlertCreated, notifyReportReminder } from "@/lib/notify";

// コンディション検知（Phase 2）— 設計は docs/roadmap.md / docs/data-model.md
//
// 方針:
// - スコアの絶対値ではなく「変化」で検知する（移動平均からの急落・連続下降）
// - 自己申告とAIトーン解析の乖離は「弱音を書けない」シグナルとして単独ルール化
// - 同じルールの未クローズアラートがある間は重複発火しない（対応フローを邪魔しない）
// - 相談フラグだけは提出時に解析を待たず即時発火（createConsultationAlert）

export type WeekPoint = {
  weekStart: Date;
  /** 自己申告 1-4 を 0-100 に正規化 */
  selfNorm: number | null;
  /** AIトーン解析 0-100 */
  conditionAi: number | null;
  /** |自己申告 - AI| */
  divergence: number | null;
  /** 稼働の体感 1(限界)-4(余裕) */
  workloadSelf: number | null;
  /** 総合スコア: AI優先、無ければ自己申告 */
  score: number | null;
  wantsConsultation: boolean;
};

// しきい値（運用しながら調整する。変更時は trigger 名も見直すこと）
const DROP_WARN = 25; // 移動平均からの下落幅（WARN）
const DROP_CRIT = 35; // 〃（CRITICAL）
const LOW_CRIT = 25; // このスコア以下への下落は常にCRITICAL
const DIVERGENCE_MIN = 35; // 乖離シグナル（自己申告が高いのにAIが低い）
const DECLINE_STEPS = 3; // 連続下降と見なすステップ数（4週で3下降）
const WORKLOAD_WEEKS = 3; // 高負荷（忙しい/限界）の連続週数

export async function getConditionSeries(
  userId: string,
  weeks = 8
): Promise<WeekPoint[]> {
  const reports = await prisma.weeklyReport.findMany({
    where: { userId, status: "SUBMITTED" },
    include: { analysis: true },
    orderBy: { weekStart: "desc" },
    take: weeks,
  });
  return reports.reverse().map((r) => {
    const selfNorm =
      r.conditionSelf != null ? ((r.conditionSelf - 1) / 3) * 100 : null;
    const ai = r.analysis?.status === "DONE" ? r.analysis.conditionAi : null;
    return {
      weekStart: r.weekStart,
      selfNorm,
      conditionAi: ai ?? null,
      divergence: r.analysis?.divergence ?? null,
      workloadSelf: r.workloadSelf,
      score: ai ?? selfNorm,
      wantsConsultation: r.wantsConsultation,
    };
  });
}

type Detected = {
  level: "INFO" | "WARN" | "CRITICAL";
  trigger: string;
  reason: string;
};

/** 週次系列からルール判定（純関数・テスト可能） */
export function detectSignals(series: WeekPoint[]): Detected[] {
  const out: Detected[] = [];
  const scored = series.filter((p) => p.score != null);
  const latest = scored.at(-1);
  if (!latest) return out;

  // 1) 急落: 直近スコアが「直前最大3週の平均」から大きく下落
  const prev = scored.slice(0, -1).slice(-3);
  if (prev.length >= 2) {
    const avg = prev.reduce((a, p) => a + p.score!, 0) / prev.length;
    const drop = avg - latest.score!;
    if (drop >= DROP_WARN) {
      const crit = drop >= DROP_CRIT || latest.score! <= LOW_CRIT;
      out.push({
        level: crit ? "CRITICAL" : "WARN",
        trigger: "急落",
        reason: `コンディションスコアが直近平均${Math.round(avg)}から${Math.round(
          latest.score!
        )}へ${Math.round(drop)}pt下落しました。`,
      });
    }
  }

  // 2) 連続下降トレンド: 直近4週で3回連続の下降
  const tail = scored.slice(-(DECLINE_STEPS + 1));
  if (tail.length === DECLINE_STEPS + 1) {
    const declining = tail.every(
      (p, i) => i === 0 || p.score! < tail[i - 1].score!
    );
    if (declining) {
      out.push({
        level: "WARN",
        trigger: "3週連続下降トレンド",
        reason: `コンディションスコアが${DECLINE_STEPS}週連続で下降しています（${tail
          .map((p) => Math.round(p.score!))
          .join(" → ")}）。`,
      });
    }
  }

  // 3) 乖離シグナル: 自己申告は良いのにAIトーンが低い＝弱音を書けない可能性
  if (
    latest.selfNorm != null &&
    latest.conditionAi != null &&
    latest.selfNorm - latest.conditionAi >= DIVERGENCE_MIN
  ) {
    out.push({
      level: "WARN",
      trigger: "乖離シグナル",
      reason: `自己申告(${Math.round(latest.selfNorm)})に対しAIトーン解析(${Math.round(
        latest.conditionAi
      )})が大きく低く、弱音を書けていない可能性があります。`,
    });
  }

  // 4) 高負荷の継続: 「忙しい/限界が近い」が連続
  const wl = series.filter((p) => p.workloadSelf != null).slice(-WORKLOAD_WEEKS);
  if (
    wl.length === WORKLOAD_WEEKS &&
    wl.every((p) => p.workloadSelf! <= 2)
  ) {
    out.push({
      level: wl.at(-1)!.workloadSelf === 1 ? "WARN" : "INFO",
      trigger: "高負荷の継続",
      reason: `稼働の体感が${WORKLOAD_WEEKS}週連続で「忙しい」以下です。`,
    });
  }

  // 5) 相談フラグ（提出時の即時発火が本線。スキャン時のバックストップ）
  if (latest.wantsConsultation) {
    out.push({
      level: "WARN",
      trigger: "相談フラグ",
      reason: "週報で「営業に直接相談したい」にチェックがありました。",
    });
  }

  return out;
}

/** 同一トリガーの未クローズがなければ ConditionAlert を作成し、外部通知する */
async function createIfNew(userId: string, d: Detected): Promise<boolean> {
  const dup = await prisma.conditionAlert.findFirst({
    where: { userId, trigger: d.trigger, status: { not: "CLOSED" } },
  });
  if (dup) return false;
  await prisma.conditionAlert.create({
    data: { userId, level: d.level, trigger: d.trigger, reason: d.reason },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  // 通知には reason（週報本文由来）を含めない — src/lib/notify.ts のプライバシー注記参照
  await notifyAlertCreated({
    level: d.level,
    trigger: d.trigger,
    userName: user?.name ?? "(不明)",
  }).catch((e) => console.error("notifyAlertCreated failed:", e));
  return true;
}

/** 1ユーザー分のルール実行（週報解析の完了後に呼ぶ）。作成件数を返す */
export async function runConditionRules(userId: string): Promise<number> {
  const series = await getConditionSeries(userId);
  let created = 0;
  for (const d of detectSignals(series)) {
    if (await createIfNew(userId, d)) created++;
  }
  return created;
}

/** 「営業に直接相談したい」— 提出時に解析を待たず即時発火 */
export async function createConsultationAlert(userId: string): Promise<void> {
  await createIfNew(userId, {
    level: "WARN",
    trigger: "相談フラグ",
    reason: "週報で「営業に直接相談したい」にチェックがありました。",
  });
}

/** 全エンジニアを再スキャン */
export async function scanAllEngineers(): Promise<{
  scanned: number;
  created: number;
}> {
  const engineers = await prisma.user.findMany({
    where: { role: "ENGINEER" },
    select: { id: true },
  });
  let created = 0;
  for (const e of engineers) {
    created += await runConditionRules(e.id);
  }
  return { scanned: engineers.length, created };
}

/**
 * 未提出チェック（週次ジョブ・月曜朝実行想定）
 * - 先週分が未提出 → リマインド通知（それ自体もコンディションシグナル）
 * - 2週連続未提出 → WARNアラート。在籍2週未満の新規ユーザーは対象外
 */
export async function checkMissingReports(): Promise<{
  reminded: number;
  alerted: number;
}> {
  const thisMonday = mondayOf(new Date());
  const lastWeek = new Date(thisMonday);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const twoWeeksAgo = new Date(thisMonday);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

  const engineers = await prisma.user.findMany({
    where: { role: "ENGINEER" },
    select: { id: true, name: true, createdAt: true },
  });

  let reminded = 0;
  let alerted = 0;
  for (const e of engineers) {
    const submitted = await prisma.weeklyReport.findMany({
      where: {
        userId: e.id,
        status: "SUBMITTED",
        weekStart: { in: [lastWeek, twoWeeksAgo] },
      },
      select: { weekStart: true },
    });
    const missedLast = !submitted.some(
      (r) => r.weekStart.getTime() === lastWeek.getTime()
    );
    const missedPrev = !submitted.some(
      (r) => r.weekStart.getTime() === twoWeeksAgo.getTime()
    );

    if (missedLast) {
      await notifyReportReminder(e.name).catch((err) =>
        console.error("notifyReportReminder failed:", err)
      );
      reminded++;
    }
    if (missedLast && missedPrev && e.createdAt < twoWeeksAgo) {
      const created = await createIfNew(e.id, {
        level: "WARN",
        trigger: "連続未提出",
        reason:
          "週報が2週以上連続で未提出です。提出が途切れるのは不調の兆候の可能性があります。",
      });
      if (created) alerted++;
    }
  }
  return { reminded, alerted };
}

/** 週次スキャン一式（cronジョブ / ダッシュボードの手動実行から呼ぶ） */
export async function runWeeklyScan(): Promise<{
  scanned: number;
  created: number;
  reminded: number;
  alerted: number;
}> {
  const missing = await checkMissingReports();
  const scan = await scanAllEngineers();
  return { ...scan, ...missing };
}

/**
 * 閲覧スコープ（労務センシティブ: ADMINと担当営業のみ）
 * ADMIN → 全エンジニア / SALES → 自分が担当する案件のエンジニアのみ
 */
export async function getScopedEngineers(viewer: {
  id: string;
  role: string;
}) {
  if (viewer.role === "ADMIN") {
    return prisma.user.findMany({
      where: { role: "ENGINEER" },
      orderBy: { name: "asc" },
    });
  }
  if (viewer.role === "SALES") {
    return prisma.user.findMany({
      where: {
        role: "ENGINEER",
        assignments: {
          some: {
            project: { salesRepId: viewer.id },
            OR: [{ endedAt: null }, { endedAt: { gte: new Date() } }],
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }
  return [];
}
