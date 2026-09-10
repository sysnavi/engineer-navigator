import "dotenv/config";
import { prisma } from "@/lib/db";

// ユーザーのロールを直接書き換える運用スクリプト。
// 管理画面（/admin のユーザー表）から変えられるのが正規ルートだが、
// 「本番に管理者が一人もいない/入れない」状態からの復旧用にCLIも用意する。
//
//   DATABASE_URL="<neon-direct-url>" npx tsx scripts/set-role.ts <handle|id|email> <ENGINEER|ADMIN>
//   例: DATABASE_URL="..." npx tsx scripts/set-role.ts shimadness-m4mac ADMIN
//
// 指定は handle → id → email の順で解決する。GUEST は対象外（OAuth連携で昇格する設計）。

const ROLES = ["ENGINEER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [key, roleArg] = process.argv.slice(2);
  if (!key || !roleArg || !ROLES.includes(roleArg as Role)) {
    console.error(
      "使い方: npx tsx scripts/set-role.ts <handle|id|email> <ENGINEER|ADMIN>"
    );
    process.exit(2);
  }
  const role = roleArg as Role;

  const user = await prisma.user.findFirst({
    where: { OR: [{ handle: key }, { id: key }, { email: key }] },
    select: { id: true, name: true, handle: true, role: true },
  });
  if (!user) {
    console.error(`ユーザーが見つかりません: ${key}`);
    process.exit(1);
  }
  if (user.role === "GUEST") {
    console.error("ゲストは昇格できません（本人のOAuth連携で昇格します）");
    process.exit(1);
  }
  if (user.role === role) {
    console.log(`${user.handle ?? user.name} は既に ${role} です。変更なし`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${user.handle ?? user.name} (${user.id}): ${user.role} → ${role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
