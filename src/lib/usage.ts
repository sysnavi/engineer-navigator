import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { GUEST_BLOCKED_MESSAGE } from "@/lib/guest";

// スパム・いたずらによる過剰なトークン消費を防ぐレート制限＆アカウント停止。
// すべてのAI呼び出しの入口で assertAiAllowed() を通す（トークンを使う前に弾く）。

// 上限は「個人〜少人数の正常利用」を十分に上回り、機械的な連打だけを止める値。
// 必要なら環境変数で上書きできる。
const num = (v: string | undefined, d: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const AI_LIMITS = {
  perMinute: num(process.env.AI_RATE_PER_MINUTE, 15), // 直近1分の上限（連打対策）
  perDay: num(process.env.AI_RATE_PER_DAY, 50), // 1ユーザーの24時間上限（到達で当日打ち止め）
  autoSuspendPerDay: num(process.env.AI_AUTO_SUSPEND_PER_DAY, 600), // これを超えたら自動停止
  // 全ユーザー合算の24時間上限（Issue #17）。個人運営なので、ユーザー数が
  // 想定外に増えた日に請求が青天井にならないための防波堤。到達したら当日は
  // 全体でAIを止める（週報の保存などAI以外の機能は生きる）。
  //
  // 既定300回。1回あたりの実測は 入力1964tok/出力371tok（claude-sonnet-5、
  // 通常$3/$15 per 1Mtok）で約1.8円、チャットを含め安全側に2.5円/回と見ると
  // **1日あたり最大およそ750円**。予算感が変わったらこの値を動かす。
  // ⚠これは「回数」の上限であり、実コストは1回の重さでぶれる。厳密に
  //   金額で抑えるならトークン量での集計に切り替える必要がある（未実装）。
  globalPerDay: num(process.env.AI_GLOBAL_PER_DAY, 300),
};

export type AiBlockCode =
  | "SUSPENDED"
  | "GUEST"
  | "RATE_MINUTE"
  | "RATE_DAY"
  | "AUTO_SUSPENDED"
  | "GLOBAL_DAY";

export class AiBlockedError extends Error {
  code: AiBlockCode;
  userMessage: string;
  constructor(code: AiBlockCode, userMessage: string) {
    super(`AI blocked: ${code}`);
    this.name = "AiBlockedError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

/**
 * AI呼び出しの可否を判定する。トークンを消費する処理の直前に必ず呼ぶこと。
 * - 停止中ユーザーは即拒否
 * - 直近1分 / 24時間の呼び出し数が上限を超えたら拒否
 * - 24時間の呼び出し数が自動停止しきい値を超えたらアカウントを停止して拒否
 * 問題なければ利用ログ(AiUsage)を1件記録して通す。
 */
// 新規ユーザーの慣らし期間（Issue #8: OAuth開放でのスパム対策）。
// 登録からこの日数の間は 1日上限・自動停止しきい値を 1/3 に絞る（1分上限は共通）。
const NEWCOMER_DAYS = 7;
const NEWCOMER_FACTOR = 3;

export async function assertAiAllowed(
  userId: string,
  kind: string
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { suspendedAt: true, createdAt: true, role: true },
  });
  // ゲストはAI機能を一切使えない（Issue #18）。全AI入口がこの関数を通るので、
  // ここで弾けば画面ごとの個別ガードの漏れを防げる。
  if (user.role === "GUEST") {
    throw new AiBlockedError("GUEST", GUEST_BLOCKED_MESSAGE);
  }
  if (user.suspendedAt) {
    throw new AiBlockedError(
      "SUSPENDED",
      "このアカウントは現在停止中です。AI機能はご利用いただけません。"
    );
  }

  const now = new Date();
  const isNewcomer =
    now.getTime() - user.createdAt.getTime() < NEWCOMER_DAYS * 86400_000;
  const perDay = isNewcomer
    ? Math.ceil(AI_LIMITS.perDay / NEWCOMER_FACTOR)
    : AI_LIMITS.perDay;
  const autoSuspendPerDay = isNewcomer
    ? Math.ceil(AI_LIMITS.autoSuspendPerDay / NEWCOMER_FACTOR)
    : AI_LIMITS.autoSuspendPerDay;

  const minuteAgo = new Date(now.getTime() - 60_000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);

  // 上限の消費は「実際に通った呼び出し（blocked=false）」だけで数える。
  // 一方 autoSuspend は「試行回数（拒否も含む）」で数える — 拒否を数えないと
  // 24h件数が1日上限を超えられず、自動停止が永久に発火しないため（Issue #17）。
  const [lastMinute, lastDay, globalDay, attempts24h] = await Promise.all([
    prisma.aiUsage.count({
      where: { userId, blocked: false, createdAt: { gte: minuteAgo } },
    }),
    prisma.aiUsage.count({
      where: { userId, blocked: false, createdAt: { gte: dayAgo } },
    }),
    prisma.aiUsage.count({
      where: { blocked: false, createdAt: { gte: dayAgo } },
    }),
    prisma.aiUsage.count({ where: { userId, createdAt: { gte: dayAgo } } }),
  ]);

  // 24時間の試行回数が自動停止しきい値を超えたら、アカウントを停止する
  if (attempts24h >= autoSuspendPerDay) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        suspendedAt: now,
        suspendReason: `自動停止: 24時間で${attempts24h}回のAI試行（上限${autoSuspendPerDay}${isNewcomer ? "・新規アカウント慣らし中" : ""}）`,
      },
    });
    throw new AiBlockedError(
      "AUTO_SUSPENDED",
      "利用量が上限を大きく超えたため、アカウントを自動停止しました。心当たりがなければ管理者にご連絡ください。"
    );
  }
  // 全体上限（個人ユーザーの落ち度ではないので、文言は詫びと再開見込みを添える）。
  // 悪用者の自動停止判定はこの前に済ませているので、全体が止まっても検知は効く。
  if (globalDay >= AI_LIMITS.globalPerDay) {
    await alertGlobalCapOnce(globalDay);
    throw new AiBlockedError(
      "GLOBAL_DAY",
      "今日のAI利用枠を使い切りました（サービス全体の上限です）。また明日おいでください。週報の保存など、AI以外の機能はそのまま使えます。"
    );
  }
  // 本人の連打による拒否は試行として記録する（自動停止の判定材料）。
  // 全体上限・停止中による拒否は本人の落ち度ではないので記録しない
  // （記録すると、混雑した日に無関係のユーザーが自動停止に近づいてしまう）。
  if (lastMinute >= AI_LIMITS.perMinute) {
    await recordBlockedAttempt(userId, kind);
    throw new AiBlockedError(
      "RATE_MINUTE",
      "短時間のリクエストが多すぎます。少し時間をおいてからお試しください。"
    );
  }
  if (lastDay >= perDay) {
    await recordBlockedAttempt(userId, kind);
    throw new AiBlockedError(
      "RATE_DAY",
      isNewcomer
        ? "本日のAI利用上限に達しました（新規アカウントは1週間、上限を控えめにしています）。"
        : "本日のAI利用上限に達しました。時間をおいて（翌日以降に）ご利用ください。"
    );
  }

  await prisma.aiUsage.create({ data: { userId, kind } });
}

/** 拒否された試行を記録する（枠は消費しない = blocked:true）。失敗しても本流は止めない */
async function recordBlockedAttempt(userId: string, kind: string): Promise<void> {
  await prisma.aiUsage
    .create({ data: { userId, kind, blocked: true } })
    .catch((e) => console.error("failed to record blocked attempt:", e));
}

// 全体上限に達したことを運営に知らせる。到達後はリクエストのたびに呼ばれるため、
// プロセス内で日付が変わるまで1回だけ通知する（DBに状態を持つほどの価値はない。
// 複数インスタンス構成ならインスタンスごとに1通届く程度の粗さは許容）。
let lastGlobalAlertDay: string | null = null;

async function alertGlobalCapOnce(count: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastGlobalAlertDay === today) return;
  lastGlobalAlertDay = today;
  await notify(
    `⚠ AIのグローバル日次上限に到達しました（直近24時間で${count}回 / 上限${AI_LIMITS.globalPerDay}回）。当日のAI機能は全体停止中です。上限は AI_GLOBAL_PER_DAY で調整できます。`
  ).catch(() => {});
}

/** 直近24時間のAI利用回数（管理画面の表示用。拒否された試行は含まない） */
export async function aiUsageToday(userId: string): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
  return prisma.aiUsage.count({
    where: { userId, blocked: false, createdAt: { gte: dayAgo } },
  });
}
