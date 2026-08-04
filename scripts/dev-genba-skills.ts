import { prisma } from "@/lib/db";

// げんばE2E用: devユーザー（エンジニア デモ）に検証用スキルを付与する開発スクリプト。
//   npx tsx --env-file=.env scripts/dev-genba-skills.ts
// 本番では使わない（dev DBのテストデータ整備のみ）。

const TARGET = process.env.DEV_GENBA_USER ?? "engineer@sysnavi.co.jp";
const SKILLS: [string, number][] = [
  ["PHP", 5],
  ["Laravel", 5],
  ["MySQL", 4],
  ["Java", 6],
  ["SQL", 5],
  ["詳細設計", 5],
  ["Docker", 3],
  ["障害対応", 4],
  ["顧客折衝", 4],
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: TARGET } });
  if (!user) throw new Error(`user not found: ${TARGET}`);
  for (const [name, level] of SKILLS) {
    const skill = await prisma.skill.findUnique({ where: { name } });
    if (!skill) {
      console.warn(`skill not found (skip): ${name}`);
      continue;
    }
    await prisma.engineerSkill.upsert({
      where: { userId_skillId: { userId: user.id, skillId: skill.id } },
      update: { level },
      create: { userId: user.id, skillId: skill.id, level },
    });
    console.log(`ok: ${name} Lv${level}`);
  }
}

main().finally(() => prisma.$disconnect());
