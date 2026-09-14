// 良問バンクの問題だけを本番DBへ投入する（npm run seed:quiz-bank）。
//
// なぜ prisma/seed.ts を本番で流さないか:
//   - ratingSum/ratingCount をサンプル評価で上書きしてしまう（実ユーザーの評価が消える）
//   - Invite の管理者ブートストラップ行を書き換える（ADMIN_INVITE_TOKEN 未指定だと
//     公開値 dev-admin-bootstrap に戻り、revokedAt も null に復活する）
//   - 今日基準のデモ週報・デモユーザーが増える
// 開発DBを作り直すとき用の seed.ts と、本番に中身を足すときのこれは別物。
//
// 使い方:
//   DATABASE_URL="<neon-direct-url>" npm run seed:quiz-bank
//   DATABASE_URL="<neon-direct-url>" npm run seed:quiz-bank -- --dry-run

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SEED_QUIZZES } from "../prisma/seed-quizzes";
import { SEED_CERT_QUIZZES } from "../prisma/seed-cert-quizzes";
import { CERT_QUIZZES_EXTRA } from "../prisma/quizzes";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const all = [...SEED_QUIZZES, ...SEED_CERT_QUIZZES, ...CERT_QUIZZES_EXTRA];

  const ids = all.map((q) => q.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("idが重複している。npm run check:quizzes で確認すること");
  }

  const existing = await prisma.quizQuestion.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((q) => q.id));
  const toCreate = all.filter((q) => !existingIds.has(q.id));

  console.log(`対象 ${all.length}問: 新規 ${toCreate.length} / 既存更新 ${existingIds.size}`);

  if (dryRun) {
    console.log("--dry-run のため書き込みはしない");
    return;
  }

  // 出題の作者。prisma/seed-launch.ts と同じ運営アカウントを使う
  // （実在の同僚名義にしない。isPublic:false で発見ページにも出さない）。
  const staff = await prisma.user.upsert({
    where: { id: "en-staff" },
    update: {},
    create: {
      id: "en-staff",
      name: "EN運営",
      role: "ADMIN",
      consentedAt: new Date(),
      tutorialCompletedAt: new Date(),
      bio: "Engineer Navigator の運営アカウントです。",
      isPublic: false,
    },
  });

  for (const q of all) {
    const content = {
      topic: q.topic,
      domains: q.domains,
      prompt: q.prompt,
      choices: q.choices,
      answerIndex: q.answerIndex,
      explanation: q.explanation,
    };
    await prisma.quizQuestion.upsert({
      where: { id: q.id },
      // 本文の修正は反映したいが、評価は実ユーザーのものなので絶対に触らない。
      // 作者も既存問題のものを維持する（別名義に書き換えると解けなくなる人が出る）。
      update: content,
      create: { id: q.id, authorId: staff.id, ...content },
    });
  }

  const total = await prisma.quizQuestion.count();
  console.log(`完了。良問バンクの総数: ${total}問`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
