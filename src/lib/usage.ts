import { prisma } from "@/lib/db";

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
};

export type AiBlockCode =
  | "SUSPENDED"
  | "RATE_MINUTE"
  | "RATE_DAY"
  | "AUTO_SUSPENDED";

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
export async function assertAiAllowed(
  userId: string,
  kind: string
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { suspendedAt: true },
  });
  if (user.suspendedAt) {
    throw new AiBlockedError(
      "SUSPENDED",
      "このアカウントは現在停止中です。AI機能はご利用いただけません。"
    );
  }

  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60_000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);

  const [lastMinute, lastDay] = await Promise.all([
    prisma.aiUsage.count({ where: { userId, createdAt: { gte: minuteAgo } } }),
    prisma.aiUsage.count({ where: { userId, createdAt: { gte: dayAgo } } }),
  ]);

  // 24時間の呼び出しが自動停止しきい値を超えたら、アカウントを停止する
  if (lastDay >= AI_LIMITS.autoSuspendPerDay) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        suspendedAt: now,
        suspendReason: `自動停止: 24時間で${lastDay}回のAI利用（上限${AI_LIMITS.autoSuspendPerDay}）`,
      },
    });
    throw new AiBlockedError(
      "AUTO_SUSPENDED",
      "利用量が上限を大きく超えたため、アカウントを自動停止しました。心当たりがなければ管理者にご連絡ください。"
    );
  }
  if (lastMinute >= AI_LIMITS.perMinute) {
    throw new AiBlockedError(
      "RATE_MINUTE",
      "短時間のリクエストが多すぎます。少し時間をおいてからお試しください。"
    );
  }
  if (lastDay >= AI_LIMITS.perDay) {
    throw new AiBlockedError(
      "RATE_DAY",
      "本日のAI利用上限に達しました。時間をおいて（翌日以降に）ご利用ください。"
    );
  }

  await prisma.aiUsage.create({ data: { userId, kind } });
}

/** 直近24時間のAI利用回数（管理画面の表示用） */
export async function aiUsageToday(userId: string): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
  return prisma.aiUsage.count({
    where: { userId, createdAt: { gte: dayAgo } },
  });
}
