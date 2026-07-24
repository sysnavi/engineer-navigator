import { prisma } from "@/lib/db";

// 未昇格ゲストの掃除（Issue #18）。cronで1日1回まわす想定:
//   DATABASE_URL="<direct-url>" npx tsx scripts/cleanup-guests.ts
//
// 消すのは「role=GUEST のまま GUEST_TTL_DAYS 日を過ぎた」User。
// OAuth連携で昇格した人は role が ENGINEER になっているので対象外。
// 関連レコードは schema の onDelete: Cascade で一緒に消える。
// --dry-run を付けると件数だけ出して消さない。

const GUEST_TTL_DAYS = Number(process.env.GUEST_TTL_DAYS ?? 30);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cutoff = new Date(Date.now() - GUEST_TTL_DAYS * 86400_000);

  const targets = await prisma.user.findMany({
    where: { role: "GUEST", createdAt: { lt: cutoff } },
    select: { id: true, handle: true, createdAt: true },
  });

  console.log(
    `未昇格ゲスト(${GUEST_TTL_DAYS}日以上前): ${targets.length}件` +
      (dryRun ? "（dry-run: 削除しません）" : "")
  );
  for (const t of targets.slice(0, 20)) {
    console.log(`  ${t.handle} / 作成 ${t.createdAt.toISOString().slice(0, 10)}`);
  }
  if (targets.length > 20) console.log(`  …ほか ${targets.length - 20}件`);

  if (dryRun || targets.length === 0) return;

  const res = await prisma.user.deleteMany({
    where: { id: { in: targets.map((t) => t.id) } },
  });
  console.log(`削除しました: ${res.count}件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
