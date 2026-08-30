"use server";

// げんば（GENBA.sim）のサーバーアクション。
// 成否のロールは必ずここで行う（クライアントは選択肢のindexしか送らない＝ダンジョンと同じ改ざん耐性）。
// お金の増減は Wallet + WalletLog を同一transactionで必ずセットに。

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completedTrustByTemplate } from "@/lib/genba/completed";
import {
  GENBA,
  interviewPlan,
  offerTemplateById,
  type GenbaTheme,
} from "@/lib/genba/content";
import {
  choiceRate,
  eventForDay,
  fulfillment,
  interviewBaseRate,
  resolveOffer,
  settleCompleted,
  settleFailed,
  todayStr,
  type GenbaLogEntry,
} from "@/lib/genba/logic";

// ---- 共通ヘルパー ----

async function requireEngineer() {
  const user = await getCurrentUser();
  if (user.role === "GUEST") throw new Error("ゲストは げんば に入れません");
  return user;
}

/** 本人の承認済みスキル（Skill.name → level） */
async function ownedSkills(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.engineerSkill.findMany({
    where: { userId },
    include: { skill: { select: { name: true } } },
  });
  return new Map(rows.map((r) => [r.skill.name, r.level]));
}

type SalesBlocked = { date?: string; ids?: string[] };

async function getSales(userId: string) {
  return prisma.genbaSales.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// ---- 面接 ----

export type InterviewResult =
  | { passed: true; contractId: string; rate: number }
  | { passed: false; reason: string };

/** 案件に応募して面接を受ける。answers は各設問で選んだ選択肢index。 */
export async function applyToOffer(
  offerId: string,
  answers: number[]
): Promise<InterviewResult> {
  const user = await requireEngineer();

  const active = await prisma.genbaContract.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
  });
  if (active) throw new Error("進行中の現場があります（掛け持ちはできません）");

  const sales = await getSales(user.id);
  const date = todayStr();
  const blocked = (sales.blocked ?? {}) as SalesBlocked;
  if (blocked.date === date && blocked.ids?.includes(offerId)) {
    throw new Error("この案件の面接は今日はもう受けられません");
  }

  const completedTrust = await completedTrustByTemplate(user.id);
  const offer = resolveOffer(user.id, date, sales.trust, completedTrust, offerId);
  if (!offer) throw new Error("案件が見つかりません（日付が変わった可能性があります）");

  const owned = await ownedSkills(user.id);
  const m = fulfillment(offer.skills, owned);

  const questions = interviewPlan(offer).questions;
  if (answers.length !== questions.length) throw new Error("回答が不正です");
  let mod = 0;
  for (let i = 0; i < questions.length; i++) {
    const choice = questions[i].choices[answers[i]];
    if (!choice) throw new Error("回答が不正です");
    if (choice.needSkill && !owned.has(choice.needSkill)) {
      throw new Error("そのスキルはまだ承認されていません");
    }
    mod += choice.mod;
  }

  // 再訪は顔なじみの現場——面接に固定ボーナス（設問が2問と少ない分の補填でもある）
  const bonus = offer.revisitOf ? GENBA.REVISIT_INTERVIEW_BONUS : 0;
  const p = clamp(interviewBaseRate(m) + mod + bonus, 0.05, 0.97);
  const passed = Math.random() < p;

  if (!passed) {
    const ids = blocked.date === date ? (blocked.ids ?? []) : [];
    await prisma.genbaSales.update({
      where: { userId: user.id },
      data: {
        trust: clamp(sales.trust + GENBA.SALES_TRUST_REJECTED, 0, 100),
        blocked: { date, ids: [...ids, offerId] },
      },
    });
    revalidatePath("/genba");
    return {
      passed: false,
      reason: "お見送りの連絡が来た。ハトリさんが少し悲しそうだ。",
    };
  }

  const contract = await prisma.genbaContract.create({
    data: {
      userId: user.id,
      offerId,
      seed: Math.floor(Math.random() * 0x7fffffff),
      title: offer.title,
      theme: offer.theme,
      rate: offer.rateToday,
      totalDays: offer.days,
      trust: GENBA.START_TRUST,
      stamina: GENBA.START_STAMINA,
    },
  });
  revalidatePath("/genba");
  return { passed: true, contractId: contract.id, rate: offer.rateToday };
}

// ---- 現場の1日 ----

export type DayResult = {
  ok: boolean;
  forced: boolean; // たいりょく0の強制しくじり
  text: string;
  day: number;
  trust: number;
  stamina: number;
  strikes: number;
  status: string; // ACTIVE | COMPLETED | FAILED
  payout: number | null;
  bonus: number; // 満了ボーナス（表示用）
};

/** 現場の1日をすすめる。day=クライアントが見ている現場日（1始まり）、choiceIdx=選択肢。 */
export async function workChoice(
  day: number,
  choiceIdx: number
): Promise<DayResult> {
  const user = await requireEngineer();

  const contract = await prisma.genbaContract.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
  });
  if (!contract) throw new Error("進行中の現場がありません");

  const expectedDay = contract.day + 1;
  if (day !== expectedDay) {
    throw new Error("画面がふるいようです。再読み込みしてください");
  }

  const log = (contract.log as GenbaLogEntry[] | null) ?? [];
  const date = todayStr();

  const event = eventForDay(contract.seed, contract.theme as GenbaTheme, expectedDay);
  const choice = event.choices[choiceIdx];
  if (!choice) throw new Error("選択が不正です");

  const owned = await ownedSkills(user.id);
  if (choice.needSkill && !owned.has(choice.needSkill)) {
    throw new Error("そのスキルはまだ承認されていません");
  }

  // 充足度は現在のスキルマップから毎回計算（現場中にスキルが承認されたら効いてくる）
  const offerSkills =
    offerTemplateById(contract.offerId.split(":")[0])?.skills ?? [];
  const m = fulfillment(offerSkills, owned);

  // 朝の回復 → 選択肢のたいりょく増減 → 0なら強制しくじり
  const staminaStart = Math.min(
    100,
    contract.stamina + GENBA.STAMINA_RECOVER_PER_DAY
  );
  const stamina = clamp(staminaStart + (choice.stamina ?? 0), 0, 100);
  const forced = !event.peaceful && stamina === 0;

  let ok: boolean;
  if (event.peaceful) ok = true;
  else if (forced) ok = false;
  else {
    const p = choiceRate(
      choice.baseRate,
      m,
      !!choice.skillTag && owned.has(choice.skillTag)
    );
    ok = Math.random() < p;
  }

  const outcome = ok ? choice.success : choice.fail;
  const trust = clamp(contract.trust + outcome.trust, 0, 100);
  const strikes = ok ? 0 : contract.strikes + 1;
  const newLog: GenbaLogEntry[] = [
    ...log,
    { d: expectedDay, t: date, ev: event.id, c: choiceIdx, ok, trust, stamina },
  ];

  const failedOut = !ok && strikes >= GENBA.MAX_STRIKES;
  const completed = !failedOut && expectedDay >= contract.totalDays;
  const status = failedOut ? "FAILED" : completed ? "COMPLETED" : "ACTIVE";

  const bonus = completed
    ? Math.min(GENBA.COMPLETE_BONUS_MAX, trust * GENBA.COMPLETE_BONUS_PER_TRUST)
    : 0;
  const payout = failedOut
    ? settleFailed(contract.rate, expectedDay)
    : completed
      ? settleCompleted(contract.rate, contract.totalDays, trust)
      : null;

  const contractUpdate = prisma.genbaContract.update({
    where: { id: contract.id },
    data: {
      day: expectedDay,
      trust,
      stamina,
      strikes,
      log: newLog,
      status,
      payout,
      endedAt: status === "ACTIVE" ? null : new Date(),
    },
  });

  if (status === "ACTIVE") {
    await contractUpdate;
  } else {
    // 精算: Wallet + WalletLog + 営業信頼 を同一transactionで
    const sales = await getSales(user.id);
    const salesDelta =
      status === "COMPLETED"
        ? GENBA.SALES_TRUST_COMPLETE
        : GENBA.SALES_TRUST_FAILED;
    await prisma.$transaction([
      contractUpdate,
      prisma.wallet.upsert({
        where: { userId: user.id },
        update: { balance: { increment: payout ?? 0 } },
        create: { userId: user.id, balance: payout ?? 0 },
      }),
      prisma.walletLog.create({
        data: {
          userId: user.id,
          delta: payout ?? 0,
          reason: status === "COMPLETED" ? "genba:complete" : "genba:failed",
          refId: contract.id,
        },
      }),
      prisma.genbaSales.update({
        where: { userId: user.id },
        data: {
          trust: clamp(sales.trust + salesDelta, 0, 100),
          ...(status === "COMPLETED"
            ? { completedCount: { increment: 1 } }
            : { failedCount: { increment: 1 } }),
        },
      }),
    ]);
  }

  // ここで revalidatePath はしない: 精算画面（SEISAN）を表示中にページが
  // 差し替わって消えてしまうため。オフィスへ戻るボタンの router.refresh() が正となる。
  return {
    ok,
    forced,
    text: outcome.text,
    day: expectedDay,
    trust,
    stamina,
    strikes,
    status,
    payout,
    bonus,
  };
}
