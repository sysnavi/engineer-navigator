import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";

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
  perDay: num(process.env.AI_RATE_PER_DAY, 300), // 24時間の上限（到達で当日打ち止め）
  autoSuspendPerDay: num(process.env.AI_AUTO_SUSPEND_PER_DAY, 600), // これを超えたら自動停止
  // 全ユーザー合算の24時間上限（Issue #17）。個人運営なので、ユーザー数が
  // 想定外に増えた日に請求が青天井にならないための防波堤。到達したら当日は
  // 全体でAIを止める（週報の保存などAI以外の機能は生きる）。
  //
  // 既定40回の根拠（予算1日100円）:
  //   実測の週報解析1回 = 入力1964tok / 出力371tok（claude-sonnet-5）
  //   Sonnet 5 通常価格 $3/$15 per 1Mtok → 1回 $0.0115 ≒ 1.8円（1ドル155円換算）
  //   メンターチャットは履歴を積むため1回あたりはこれより高い。安全側に
  //   1回2.5円と見て 100円 ÷ 2.5円 ≒ 40回。
  // ⚠これは「回数」の上限であり、実コストは1回の重さでぶれる。厳密に
  //   金額で抑えるならトークン量での集計に切り替える必要がある（未実装）。
  globalPerDay: num(process.env.AI_GLOBAL_PER_DAY, 40),
};

export type AiBlockCode =
  | "SUSPENDED"
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
    select: { suspendedAt: true, createdAt: true },
  });
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

  const [lastMinute, lastDay, globalDay] = await Promise.all([
    prisma.aiUsage.count({ where: { userId, createdAt: { gte: minuteAgo } } }),
    prisma.aiUsage.count({ where: { userId, createdAt: { gte: dayAgo } } }),
    prisma.aiUsage.count({ where: { createdAt: { gte: dayAgo } } }),
  ]);

  // 24時間の呼び出しが自動停止しきい値を超えたら、アカウントを停止する
  if (lastDay >= autoSuspendPerDay) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        suspendedAt: now,
        suspendReason: `自動停止: 24時間で${lastDay}回のAI利用（上限${autoSuspendPerDay}${isNewcomer ? "・新規アカウント慣らし中" : ""}）`,
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
  if (lastMinute >= AI_LIMITS.perMinute) {
    throw new AiBlockedError(
      "RATE_MINUTE",
      "短時間のリクエストが多すぎます。少し時間をおいてからお試しください。"
    );
  }
  if (lastDay >= perDay) {
    throw new AiBlockedError(
      "RATE_DAY",
      isNewcomer
        ? "本日のAI利用上限に達しました（新規アカウントは1週間、上限を控えめにしています）。"
        : "本日のAI利用上限に達しました。時間をおいて（翌日以降に）ご利用ください。"
    );
  }

  await prisma.aiUsage.create({ data: { userId, kind } });
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

/** 直近24時間のAI利用回数（管理画面の表示用） */
export async function aiUsageToday(userId: string): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
  return prisma.aiUsage.count({
    where: { userId, createdAt: { gte: dayAgo } },
  });
}
