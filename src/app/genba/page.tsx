// げんば（GENBA.sim）: SES現場シミュレーションRPG（かせぐ・竹版）。
// 営業ハトリさんの案件紹介 → 面接 → 現場の日次イベント → 精算EN、の1画面フェーズ切替。
// 判定は全て actions.ts（サーバー）。このページは表示に必要な状態を組み立てるだけ。

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlayerStats } from "@/lib/exp";
import { type GenbaTheme } from "@/lib/genba/content";
import {
  fulfillment,
  matchStars,
  offersForDay,
  todayStr,
} from "@/lib/genba/logic";
import { PixelLabel, Window } from "@/components/retro";
import { GenbaGame, type ActiveView, type OfferView } from "./genba-game";

export const metadata = {
  title: "げんば — Engineer Navigator",
  description: "案件を選び、面接を突破し、現場の毎日を乗り切ってENを稼ぐSES現場シミュレーション。",
};

export default async function GenbaPage() {
  const user = await getCurrentUser();

  if (user.role === "GUEST") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1>
          <PixelLabel>GENBA — げんば</PixelLabel>
        </h1>
        <Window title="GENBA" titleEm=".sim">
          <p className="text-[13.5px]">
            げんばで働くには、アカウント登録が必要です。
            <br />
            マイページからGoogleアカウントを連携してください。
          </p>
        </Window>
      </div>
    );
  }

  const [stats, wallet, sales, active, skillRows, history] = await Promise.all([
    getPlayerStats(user.id),
    prisma.wallet.findUnique({ where: { userId: user.id } }),
    prisma.genbaSales.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    }),
    prisma.genbaContract.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
    }),
    prisma.engineerSkill.findMany({
      where: { userId: user.id },
      include: { skill: { select: { name: true } } },
    }),
    prisma.genbaContract.findMany({
      where: { userId: user.id, status: { not: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, payout: true, day: true, totalDays: true },
    }),
  ]);

  const owned = new Map(skillRows.map((r) => [r.skill.name, r.level]));
  const date = todayStr();

  let activeView: ActiveView | null = null;
  let offers: OfferView[] | null = null;

  if (active) {
    activeView = {
      day: active.day,
      totalDays: active.totalDays,
      title: active.title,
      theme: active.theme as GenbaTheme,
      templateId: active.offerId.split(":")[0],
      rate: active.rate,
      trust: active.trust,
      stamina: active.stamina,
      strikes: active.strikes,
      seed: active.seed,
    };
  } else {
    const blocked = (sales.blocked ?? {}) as { date?: string; ids?: string[] };
    const blockedIds = blocked.date === date ? (blocked.ids ?? []) : [];
    offers = offersForDay(user.id, date, sales.trust).map((o) => {
      const m = fulfillment(o.skills, owned);
      return {
        offerId: o.offerId,
        templateId: o.id,
        theme: o.theme,
        title: o.title,
        client: o.client,
        work: o.work,
        skills: o.skills.map((s) => ({
          ...s,
          ownedLevel: owned.get(s.name) ?? 0,
        })),
        rate: o.rateToday,
        days: o.days,
        stars: matchStars(m),
        blocked: blockedIds.includes(o.offerId),
        era: o.era ? { period: o.era.period } : null,
      };
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1>
        <PixelLabel>GENBA — げんば</PixelLabel>
      </h1>
      <GenbaGame
        avatarSprite={stats.stage.sprite}
        avatarName={stats.stage.name}
        balance={wallet?.balance ?? 0}
        salesTrust={sales.trust}
        salesCompleted={sales.completedCount}
        ownedSkills={[...owned.entries()]}
        active={activeView}
        offers={offers}
        history={history.map((h) => ({
          title: h.title,
          status: h.status,
          payout: h.payout ?? 0,
          days: h.day,
          totalDays: h.totalDays,
        }))}
      />
      <p className="text-[12px]">
        <Link href="/genba/album" className="underline">
          📔 きおくのアルバム — 消えた現場の記録
        </Link>
      </p>
    </div>
  );
}
