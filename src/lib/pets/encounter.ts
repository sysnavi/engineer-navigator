// レアキャラ来訪エンジン（Issue #2）。
//
// - 1日1回だけサーバーで抽選し Encounter に保存（リロードで結果が変わらない）
// - 出現率はペット数の漸減カーブ（0匹40% → 1匹15% → 2匹10% → 3匹〜8%）。
//   最初の1匹ができるまでが最も離脱しやすいので、序盤ほど賑やかにする
// - ピティ＝救済: 直近N日「誰も来ない日」が続いたら確定出現（0匹なら2日・以降7日）
// - 再訪: きのう逃した/逃げられた子は、一度だけ翌日確定でもう一度来てくれる。
//   「逃した＝損」ではなく「続きがある」に変える仕掛け。連鎖はしない（2日で打ち止め）
// - 前日以前の PENDING は EXPIRED に倒す（「逃した」体験もログに残る）
// - 好感度判定は 基礎55% + 会話の選択ボーナス + 再訪ボーナス + 日頃の活動ボーナス（上限90%）
//   … 訪問ストリーク・今週の週報・よもやま投稿が効く =「毎日来てるね」と言われる体験
// - はじめての来訪者だけは、話しかければ必ずなかまになる（チュートリアル救済）

import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/week";
import { getPlayerStats } from "@/lib/exp";
import {
  pickFromPool,
  speciesById,
  visitablePool,
  type PetSpecies,
} from "@/lib/pets/species";

// ペット数ごとの出現率。コレクションが進むほどレア感が戻る
const APPEAR_RATES = [0.4, 0.15, 0.1];
const APPEAR_RATE_BASE = 0.08; // 3匹以降
const PITY_DAYS = 7;
const PITY_DAYS_PETLESS = 2; // 0匹の間は「来ない日」を2日までしか続けない
const BASE_BEFRIEND = 0.55;
const MAX_BEFRIEND = 0.9;
const REVISIT_BOND = 0.05; // 「また来てくれた」子はすこし心を開いている

const DAY_MS = 86400_000;

function dayOf(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** 逃した扱いのステータス（翌日の再訪トリガー） */
function isMissed(status: string): boolean {
  return status === "FLED" || status === "EXPIRED";
}

export function appearRateFor(petCount: number): number {
  return APPEAR_RATES[petCount] ?? APPEAR_RATE_BASE;
}

/** date の来訪が「前日に逃した同じ子の再訪」かどうか。
 *  再訪の連鎖防止（前日ぶんがすでに再訪なら次はもう来ない）にも使う */
export async function wasRevisit(
  userId: string,
  date: Date,
  speciesId: string
): Promise<boolean> {
  const prev = await prisma.encounter.findUnique({
    where: { userId_date: { userId, date: new Date(date.getTime() - DAY_MS) } },
  });
  return !!prev && prev.speciesId === speciesId && isMissed(prev.status);
}

/** 所持済み種族を除いた重み付き抽選。全種コンプなら null（=その日は誰も来ない） */
function pickSpecies(ownedSpeciesIds: ReadonlySet<string>): PetSpecies | null {
  return pickFromPool(visitablePool(ownedSpeciesIds), Math.random());
}

/** きょうの来訪を確定させる（未抽選なら抽選）。layoutから毎リクエスト呼ばれる想定 */
export async function ensureTodayEncounter(userId: string) {
  const today = dayOf(new Date());
  const existing = await prisma.encounter.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (existing) return existing;

  // 昨日以前の放置PENDINGを失効させる（1回で済むようここでまとめて）。
  // 再訪判定より先にやらないと、きのうのPENDINGが「逃した」扱いにならない
  await prisma.encounter.updateMany({
    where: { userId, status: "PENDING", date: { lt: today } },
    data: { status: "EXPIRED" },
  });

  const pets = await prisma.pet.findMany({
    where: { userId },
    select: { speciesId: true },
  });
  const petCount = pets.length;
  const ownedSpecies = new Set(pets.map((p) => p.speciesId));

  // 再訪: きのう逃した子は、一度だけ確定でもう一度来てくれる。
  // すでになかまにいる種は来ない（重複ペット防止。修正前の重複データが居ても連鎖させない）
  const yesterday = new Date(today.getTime() - DAY_MS);
  const missed = await prisma.encounter.findUnique({
    where: { userId_date: { userId, date: yesterday } },
  });
  let revisitSpecies: PetSpecies | null = null;
  if (
    missed &&
    isMissed(missed.status) &&
    missed.speciesId &&
    !ownedSpecies.has(missed.speciesId)
  ) {
    const alreadyRevisited = await wasRevisit(userId, yesterday, missed.speciesId);
    if (!alreadyRevisited) revisitSpecies = speciesById(missed.speciesId) ?? null;
  }

  // ピティ: 直近N日、誰も来ない日（NONE以外の記録なし）が続いたら確定出現。
  // ペット0匹の間はN=2に縮めて「待たされて離脱」を潰す
  const pityDays = petCount === 0 ? PITY_DAYS_PETLESS : PITY_DAYS;
  const since = new Date(today.getTime() - pityDays * DAY_MS);
  const recentMeet = await prisma.encounter.findFirst({
    where: { userId, date: { gte: since }, status: { not: "NONE" } },
    select: { id: true },
  });
  const appear =
    !!revisitSpecies || !recentMeet || Math.random() < appearRateFor(petCount);

  // 全種コンプ済みなら pickSpecies が null を返し、その日は NONE になる
  const species = appear ? revisitSpecies ?? pickSpecies(ownedSpecies) : null;
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

/** きょうの来訪者（PENDINGのみ）。UI表示用。revisit=きのう逃した子の再訪 */
export async function getPendingVisitor(userId: string) {
  const today = dayOf(new Date());
  const enc = await prisma.encounter.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (!enc || enc.status !== "PENDING") return null;
  const species = speciesById(enc.speciesId);
  if (!species) return null;
  const revisit = await wasRevisit(userId, today, species.id);
  return { encounterId: enc.id, species, revisit };
}

/** 気配ヒント（来訪者がいない日の「つぎ」への引き）。
 *  - return: きょう逃した子が、あした確定で戻ってくる（本当の予告）
 *  - rumor:  ペット0匹の高頻度期間。「近いうちに来る」空気だけ出す
 *  嘘の期待は作らない: 確定情報があるときだけ return を出す */
export async function getPresenceHint(
  userId: string
): Promise<"return" | "rumor" | null> {
  const today = dayOf(new Date());
  const enc = await prisma.encounter.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (!enc || enc.status === "PENDING") return null;
  if (isMissed(enc.status) && enc.speciesId) {
    // なかまにいる種は再訪しない（ensureTodayEncounterと同じ条件）ので予告も出さない
    const owned = await prisma.pet.count({
      where: { userId, speciesId: enc.speciesId },
    });
    const alreadyRevisited =
      owned > 0 || (await wasRevisit(userId, today, enc.speciesId));
    if (!alreadyRevisited) return "return";
  }
  if (enc.status === "NONE") {
    const petCount = await prisma.pet.count({ where: { userId } });
    if (petCount === 0) return "rumor";
  }
  return null;
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

  // はじめての来訪者（ペット0匹＆一度も会話を終えていない）は必ずなかまになる。
  // 最初の1匹はチュートリアル: 「話しかけたのに逃げられた」を初体験にしない
  const [petCount, everTalked] = await Promise.all([
    prisma.pet.count({ where: { userId } }),
    prisma.encounter.findFirst({
      where: { userId, status: { in: ["BEFRIENDED", "FLED"] } },
      select: { id: true },
    }),
  ]);
  const firstEver = petCount === 0 && !everTalked;
  const revisit = await wasRevisit(userId, enc.date, species.id);

  const p = firstEver
    ? 1
    : Math.min(
        MAX_BEFRIEND,
        BASE_BEFRIEND +
          bond +
          (revisit ? REVISIT_BOND : 0) +
          (await activityBonus(userId))
      );
  const befriended = Math.random() < p;

  if (befriended) {
    // 同種は1匹まで（抽選側で除外済みだが、修正前に作られたPENDINGや
    // 並行操作から重複ペットが生まれないよう、ここでも既存の子に合流させる）
    const existing = await prisma.pet.findFirst({
      where: { userId, speciesId: species.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.encounter.update({
        where: { id: encounterId },
        data: { status: "BEFRIENDED" },
      });
      return { befriended: true, petId: existing.id, speciesName: species.name };
    }
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
