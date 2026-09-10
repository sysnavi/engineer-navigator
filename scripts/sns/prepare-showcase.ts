// SNS 投稿用スクリーンショットのための「見栄えする状態」を使い捨てDBに作る。
// seed 直後のデモユーザーはペット0・EN0・ガジェット0 で空状態の画面が多く、
// そのまま撮っても楽しさが伝わらない。ここで仲間・所持金・戦利品を足してから撮る。
//
// 対象は E2E/ツアーと同じ使い捨てDB（engineer_navigator_e2e）のデモユーザーだけ。
// prepare-db.ts の後に webServer.command から呼ばれる（playwright.sns.config.ts）。
// 開発DB・本番DBに向けて実行しないこと（DB名ガードあり）。

import { prisma } from "@/lib/db";
import { PALETTES } from "@/lib/palettes";

const USER = "engineer@sysnavi.co.jp";

/** きょう（JST）の通し日数。tests/sns/scenes.spec.ts の pickScene と同じ計算 */
function jstDayIndex(now = new Date()): number {
  return Math.floor((now.getTime() + 9 * 3600_000) / 86400_000);
}

/** src/lib/pets/encounter.ts の dayOf と同じ（サーバーのローカル日付をUTC深夜で表す） */
function dayOf(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

async function main() {
  const dbName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  if (!dbName.endsWith("_e2e")) {
    throw new Error(`使い捨てDB（*_e2e）以外では実行しない: ${dbName}`);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { email: USER } });
  const uid = user.id;

  // 見た目: デスクトップOS風シェル（下にタスクバー）＋ きせかえパレットを日替わりで。
  // SNS_PALETTE=<id> で固定できる（src/lib/palettes.ts の id）
  const forced = process.env.SNS_PALETTE;
  const palette = forced && PALETTES.some((p) => p.id === forced)
    ? forced
    : PALETTES[jstDayIndex() % PALETTES.length].id;
  await prisma.user.update({
    where: { id: uid },
    data: {
      uiShell: "desktop",
      palette,
      // タスクバーは遊びの入口を並べる（おさんぽ・マイホーム。src/lib/apps.ts の id）
      dockApps: ["walk", "home"],
      // チュートリアル・TIPSは写さない
      tutorialCompletedAt: user.tutorialCompletedAt ?? new Date(),
      tipsEnabled: false,
    },
  });

  // きょうの来訪（レアキャラ）は抽選せず「来ない」に固定する。
  // 画面の左下に被って本文を隠すことがあり、撮れ高が日によってぶれる元になるため
  await prisma.encounter.upsert({
    where: { userId_date: { userId: uid, date: dayOf(new Date()) } },
    update: { status: "NONE", speciesId: null },
    create: { userId: uid, date: dayOf(new Date()), status: "NONE" },
  });

  // 仲間（おさんぽ・マイホームに出る）。種族は src/lib/pets/species.ts のTSマスタ
  const pets: { speciesId: string; name: string; affection: number }[] = [
    { speciesId: "choco-slime", name: "チョコスライム", affection: 24 },
    { speciesId: "omusubi-ghost", name: "おむすびゴースト", affection: 12 },
  ];
  const owned = await prisma.pet.findMany({ where: { userId: uid }, select: { speciesId: true } });
  const have = new Set(owned.map((p) => p.speciesId));
  for (const p of pets) {
    if (!have.has(p.speciesId)) await prisma.pet.create({ data: { userId: uid, ...p } });
  }

  // 所持金（おかいものが「買える」状態になる）
  await prisma.wallet.upsert({
    where: { userId: uid },
    update: { balance: 480 },
    create: { userId: uid, balance: 480 },
  });

  // ごはん（おさんぽ・おせわの導線が生きる）
  for (const [foodId, count] of [["onigiri", 3], ["melonpan", 2]] as const) {
    await prisma.foodItem.upsert({
      where: { userId_foodId: { userId: uid, foodId } },
      update: { count },
      create: { userId: uid, foodId, count },
    });
  }

  // ダンジョンの戦利品（マイホームの机に並ぶ）。src/lib/dungeon/content.ts の GADGETS
  const gadgets: { gadgetId: string; deskX: number; deskY: number }[] = [
    { gadgetId: "cha-kb", deskX: 50, deskY: 70 },
    { gadgetId: "nc-headphone", deskX: 22, deskY: 62 },
    { gadgetId: "succulent", deskX: 80, deskY: 58 },
  ];
  for (const g of gadgets) {
    await prisma.ownedGadget.upsert({
      where: { userId_gadgetId: { userId: uid, gadgetId: g.gadgetId } },
      update: {},
      create: { userId: uid, ...g },
    });
  }
  console.log(`[sns] showcase ready for ${USER} (palette=${palette}, pets=${pets.length}, gadgets=${gadgets.length})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
