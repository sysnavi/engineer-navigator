// SNS 投稿用スクリーンショットのための「見栄えする状態」を使い捨てDBに作る（docs/sns-bot.md）。
// seed 直後のデモユーザーはペット0・EN0・ガジェット0 で空状態の画面が多く、
// そのまま撮っても楽しさが伝わらない。ここで仲間・所持金・戦利品・家具・連続記録を足す。
//
// 中身は日替わり。src/lib/sns/plan.ts の planDay(seed) が決めた条件をそのまま置くだけで、
// 撮影側（tests/sns/scenes.spec.ts）も同じ planDay を読むので食い違わない。
//   SNS_SEED  … 既定は JST の日付。手動実行で別の絵にしたいときに任意の文字列
//   SNS_SCENE … シーン固定（visitor の日だけ来訪キャラを置くので、ここにも効く）
//   SNS_PALETTE … パレット固定（src/lib/palettes.ts の id）
//
// 対象は E2E/ツアーと同じ使い捨てDB（engineer_navigator_e2e）のデモユーザーだけ。
// prepare-db.ts の後に webServer.command から呼ばれる（playwright.sns.config.ts）。
// 開発DB・本番DBに向けて実行しないこと（DB名ガードあり）。

import { prisma } from "@/lib/db";
import { PALETTES } from "@/lib/palettes";
import { GADGETS } from "@/lib/dungeon/content";
import { SHOP_ITEMS } from "@/lib/shop/content";
import { defaultPosition } from "@/lib/home/scene";
import { localDayStart } from "@/lib/quiz/daily";
import { describePlan, jstDateKey, planDay } from "@/lib/sns/plan";

const USER = "engineer@sysnavi.co.jp";
const DAY = 86400_000;

/** src/lib/exp.ts / encounter.ts の dayOf と同じ（サーバーのローカル日付をUTC深夜で表す） */
function dayOf(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

async function main() {
  const dbName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  if (!dbName.endsWith("_e2e")) {
    throw new Error(`使い捨てDB（*_e2e）以外では実行しない: ${dbName}`);
  }
  const seed = process.env.SNS_SEED || jstDateKey();
  const plan = planDay(seed, process.env.SNS_SCENE);
  const forcedPalette = process.env.SNS_PALETTE;
  const palette =
    forcedPalette && PALETTES.some((p) => p.id === forcedPalette) ? forcedPalette : plan.palette;

  const user = await prisma.user.findUniqueOrThrow({ where: { email: USER } });
  const uid = user.id;
  const today = dayOf(new Date());

  // 見た目: デスクトップOS風シェル（下にタスクバー）＋ きせかえ
  await prisma.user.update({
    where: { id: uid },
    data: {
      uiShell: "desktop",
      palette,
      homeWallpaper: plan.wallpaper,
      homeFloor: plan.floor,
      // タスクバーは遊びの入口を並べる（おさんぽ・マイホーム。src/lib/apps.ts の id）
      dockApps: ["walk", "home"],
      // チュートリアル・TIPSは写さない
      tutorialCompletedAt: user.tutorialCompletedAt ?? new Date(),
      tipsEnabled: false,
    },
  });

  // 仲間（おさんぽ・マイホームに出る）。先頭ほど仲良し
  await prisma.pet.deleteMany({ where: { userId: uid } });
  await prisma.pet.createMany({ data: plan.pets.map((p) => ({ userId: uid, ...p })) });

  // きょうの来訪（レアキャラ）: visitor シーンの日だけ来てもらう。
  // それ以外の日は「来ない」に固定（左下に被って本文を隠す・撮れ高がぶれるため）
  await prisma.encounter.upsert({
    where: { userId_date: { userId: uid, date: today } },
    update: plan.visitorSpeciesId
      ? { status: "PENDING", speciesId: plan.visitorSpeciesId }
      : { status: "NONE", speciesId: null },
    create: plan.visitorSpeciesId
      ? { userId: uid, date: today, status: "PENDING", speciesId: plan.visitorSpeciesId }
      : { userId: uid, date: today, status: "NONE" },
  });

  // 所持金・ごはん
  await prisma.wallet.upsert({
    where: { userId: uid },
    update: { balance: plan.wallet },
    create: { userId: uid, balance: plan.wallet },
  });
  await prisma.foodItem.deleteMany({ where: { userId: uid } });
  await prisma.foodItem.createMany({ data: plan.foods.map((f) => ({ userId: uid, ...f })) });

  // ダンジョンの戦利品（DESKTOP.sav の机）。置き方はアプリの初期配置と同じ関数で
  await prisma.ownedGadget.deleteMany({ where: { userId: uid } });
  const perCategory = new Map<string, number>();
  await prisma.ownedGadget.createMany({
    data: plan.gadgets.map((id, z) => {
      const g = GADGETS.find((x) => x.id === id)!;
      const idx = perCategory.get(g.category) ?? 0;
      perCategory.set(g.category, idx + 1);
      const pos = defaultPosition(g.category, idx);
      return { userId: uid, gadgetId: id, deskX: pos.x, deskY: pos.y, deskZ: z + 1 };
    }),
  });

  // おかいもので買った家具（LIVING.sav）。位置は planDay が窓・「しまう」箱を避けて散らしたもの
  await prisma.purchase.deleteMany({ where: { userId: uid } });
  await prisma.purchase.createMany({
    data: plan.furniture.map((f, i) => ({
      userId: uid,
      itemId: f.itemId,
      price: SHOP_ITEMS.find((x) => x.id === f.itemId)!.price,
      livingX: f.x,
      livingY: f.y,
      livingZ: i + 1,
    })),
  });

  // おさんぽのカギアイテム（特別な行き先の解放）
  await prisma.walkItem.deleteMany({ where: { userId: uid } });
  await prisma.walkItem.createMany({ data: plan.walk.items.map((itemId) => ({ userId: uid, itemId })) });

  // きのうまでの連続来訪（レベル・進化段階・タスクバーの連続記録が日によって変わる）。
  // 今日の分はレイアウトが記録する
  await prisma.userVisit.createMany({
    data: Array.from({ length: plan.visitDays }, (_, i) => ({
      userId: uid,
      date: new Date(today.getTime() - (i + 1) * DAY),
    })),
    skipDuplicates: true,
  });

  // きのうまでの「今日の一問」連続記録（今日の分は撮影で答える）
  if (plan.dailyStreak > 0) {
    const questions = await prisma.quizQuestion.findMany({
      where: { authorId: { not: uid } },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const dayStart = localDayStart();
    if (questions.length > 0) {
      await prisma.quizDaily.createMany({
        data: Array.from({ length: plan.dailyStreak }, (_, i) => {
          const day = new Date(dayStart.getTime() - (i + 1) * DAY);
          return {
            userId: uid,
            questionId: questions[(i * 7) % questions.length].id,
            day,
            answeredAt: new Date(day.getTime() + 12 * 3600_000),
            correct: i % 3 !== 0,
          };
        }),
        skipDuplicates: true,
      });
    }
  }

  console.log(`[sns] showcase ready (seed=${seed}, scene=${plan.scene}): ${describePlan({ ...plan, palette })}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
