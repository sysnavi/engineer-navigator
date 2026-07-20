// レアキャラ来訪エンジン（Issue #2）。
//
// - 1日1回だけサーバーで抽選し Encounter に保存（リロードで結果が変わらない）
// - 基本出現率 8%。直近7日間 出会いゼロなら確定出現（ピティ＝救済）
// - 前日以前の PENDING は EXPIRED に倒す（「逃した」体験もログに残る）
// - 好感度判定は 基礎55% + 会話の選択ボーナス + 日頃の活動ボーナス（上限90%）
//   … 訪問ストリーク・今週の週報・よもやま投稿が効く =「毎日来てるね」と言われる体験

import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";
import { getPlayerStats } from "@/lib/exp";
import { PET_SPECIES, speciesById, type PetSpecies } from "@/lib/pets/species";

const APPEAR_RATE = 0.08;
const PITY_DAYS = 7;
const BASE_BEFRIEND = 0.55;
const MAX_BEFRIEND = 0.9;

function dayOf(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function pickSpecies(): PetSpecies {
  const pool = PET_SPECIES.filter((s) => !s.retired);
  const total = pool.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const s of pool) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return pool[pool.length - 1];
}

/** きょうの来訪を確定させる（未抽選なら抽選）。layoutから毎リクエスト呼ばれる想定 */
export async function ensureTodayEncounter(userId: string) {
  const today = dayOf(new Date());
  const existing = await prisma.encounter.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (existing) return existing;

  // 昨日以前の放置PENDINGを失効させる（1回で済むようここでまとめて）
  await prisma.encounter.updateMany({
    where: { userId, status: "PENDING", date: { lt: today } },
    data: { status: "EXPIRED" },
  });

  // ピティ: 直近7日に「出会い」（NONE以外）が無ければ確定出現
  const since = new Date(today.getTime() - PITY_DAYS * 86400_000);
  const recentMeet = await prisma.encounter.findFirst({
    where: { userId, date: { gte: since }, status: { not: "NONE" } },
    select: { id: true },
  });
  const appear = !recentMeet || Math.random() < APPEAR_RATE;

  const species = appear ? pickSpecies() : null;
  try {
    return await prisma.encounter.create({
      data: {
        userId,
        date: today,
        speciesId: species?.id ?? null,
        status: species ? "PENDING" : "NONE",
      },
    });
  } catch {
    // 並行リクエストで同時に抽選した場合は unique に負けた側が拾い直す
    return prisma.encounter.findUniqueOrThrow({
      where: { userId_date: { userId, date: today } },
    });
  }
}

/** きょうの来訪者（PENDINGのみ）。UI表示用 */
export async function getPendingVisitor(userId: string) {
  const today = dayOf(new Date());
  const enc = await prisma.encounter.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (!enc || enc.status !== "PENDING") return null;
  const species = speciesById(enc.speciesId);
  if (!species) return null;
  return { encounterId: enc.id, species };
}

/** 日頃の活動ボーナス（会話の選択とは別枠）。「毎日来てるね」が効く設計 */
export async function activityBonus(userId: string): Promise<number> {
  const weekStart = mondayOf(new Date());
  const [stats, report, posts] = await Promise.all([
    getPlayerStats(userId),
    prisma.weeklyReport.findFirst({
      where: { userId, weekStart, status: "SUBMITTED" },
      select: { id: true },
    }),
    prisma.yomoyamaPost.count({ where: { authorId: userId } }),
  ]);
  let bonus = 0;
  if (stats.currentStreak >= 3) bonus += 0.15;
  else if (stats.currentStreak >= 2) bonus += 0.08;
  if (report) bonus += 0.1;
  if (posts > 0) bonus += 0.05;
  return bonus;
}

/** 好感度判定を実行し、結果を確定保存する。bond=会話で積んだボーナス */
export async function judgeEncounter(
  userId: string,
  encounterId: string,
  bond: number
): Promise<{ befriended: boolean; petId?: string; speciesName: string }> {
  const enc = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });
  if (enc.userId !== userId) throw new Error("この出会いはあなたのものではありません");
  if (enc.status !== "PENDING") throw new Error("この子とはもう話し終えています");
  const species = speciesById(enc.speciesId);
  if (!species) throw new Error("種族データが見つかりません");

  const p = Math.min(MAX_BEFRIEND, BASE_BEFRIEND + bond + (await activityBonus(userId)));
  const befriended = Math.random() < p;

  if (befriended) {
    const [, pet] = await prisma.$transaction([
      prisma.encounter.update({
        where: { id: encounterId },
        data: { status: "BEFRIENDED" },
      }),
      prisma.pet.create({
        data: { userId, speciesId: species.id, name: species.name },
      }),
    ]);
    return { befriended: true, petId: pet.id, speciesName: species.name };
  }
  await prisma.encounter.update({
    where: { id: encounterId },
    data: { status: "FLED" },
  });
  return { befriended: false, speciesName: species.name };
}
