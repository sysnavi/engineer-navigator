import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// スキルマスタ（最初は代表的なものだけ。運用しながらAI提案経由で増える）
const skills: { name: string; category: string; aliases: string[] }[] = [
  // 言語
  { name: "Java", category: "LANGUAGE", aliases: [] },
  { name: "PHP", category: "LANGUAGE", aliases: [] },
  { name: "Python", category: "LANGUAGE", aliases: [] },
  { name: "TypeScript", category: "LANGUAGE", aliases: ["TS"] },
  { name: "JavaScript", category: "LANGUAGE", aliases: ["JS"] },
  { name: "Go", category: "LANGUAGE", aliases: ["Golang"] },
  { name: "C#", category: "LANGUAGE", aliases: [] },
  { name: "SQL", category: "LANGUAGE", aliases: [] },
  // フレームワーク
  { name: "Spring Boot", category: "FRAMEWORK", aliases: ["Spring"] },
  { name: "Laravel", category: "FRAMEWORK", aliases: [] },
  { name: "React", category: "FRAMEWORK", aliases: [] },
  { name: "Next.js", category: "FRAMEWORK", aliases: ["Next"] },
  { name: "Vue.js", category: "FRAMEWORK", aliases: ["Vue"] },
  // クラウド・インフラ
  { name: "AWS", category: "CLOUD", aliases: [] },
  { name: "GCP", category: "CLOUD", aliases: ["Google Cloud"] },
  { name: "Azure", category: "CLOUD", aliases: [] },
  { name: "Docker", category: "TOOL", aliases: [] },
  { name: "Kubernetes", category: "TOOL", aliases: ["k8s"] },
  // DB
  { name: "PostgreSQL", category: "DATABASE", aliases: ["Postgres"] },
  { name: "MySQL", category: "DATABASE", aliases: [] },
  { name: "Oracle", category: "DATABASE", aliases: ["Oracle DB"] },
  // AI
  { name: "Claude API", category: "AI", aliases: ["Anthropic API"] },
  { name: "OpenAI API", category: "AI", aliases: ["ChatGPT API"] },
  { name: "RAG構築", category: "AI", aliases: ["RAG"] },
  { name: "GitHub Copilot", category: "AI", aliases: ["Copilot"] },
  { name: "プロンプトエンジニアリング", category: "AI", aliases: [] },
  // 工程
  { name: "要件定義", category: "PROCESS", aliases: [] },
  { name: "基本設計", category: "PROCESS", aliases: ["外部設計"] },
  { name: "詳細設計", category: "PROCESS", aliases: ["内部設計"] },
  { name: "結合テスト", category: "PROCESS", aliases: ["IT"] },
  { name: "本番リリース", category: "PROCESS", aliases: ["本番デプロイ"] },
  { name: "保守運用", category: "PROCESS", aliases: ["運用保守"] },
  // ソフトスキル
  { name: "顧客折衝", category: "SOFT", aliases: ["顧客調整"] },
  { name: "チームリード", category: "SOFT", aliases: ["リーダー経験"] },
  { name: "障害対応", category: "SOFT", aliases: [] },
  { name: "メンバー育成", category: "SOFT", aliases: ["後輩指導"] },
];

async function main() {
  for (const s of skills) {
    await prisma.skill.upsert({
      where: { name: s.name },
      update: { aliases: s.aliases },
      create: {
        name: s.name,
        category: s.category as never,
        aliases: s.aliases,
      },
    });
  }
  console.log(`Seeded ${skills.length} skills`);

  // デモユーザー
  const admin = await prisma.user.upsert({
    where: { email: "admin@sysnavi.co.jp" },
    update: {},
    create: { email: "admin@sysnavi.co.jp", name: "管理者 デモ", role: "ADMIN" },
  });
  const sales = await prisma.user.upsert({
    where: { email: "sales@sysnavi.co.jp" },
    update: {},
    create: { email: "sales@sysnavi.co.jp", name: "営業 デモ", role: "SALES" },
  });
  const engineer = await prisma.user.upsert({
    where: { email: "engineer@sysnavi.co.jp" },
    update: {},
    create: { email: "engineer@sysnavi.co.jp", name: "エンジニア デモ", role: "ENGINEER" },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project" },
    update: {},
    create: {
      id: "demo-project",
      name: "基幹システム刷新案件",
      clientAlias: "大手物流A社",
      salesRepId: sales.id,
    },
  });

  const existing = await prisma.assignment.findFirst({
    where: { userId: engineer.id, projectId: project.id },
  });
  if (!existing) {
    await prisma.assignment.create({
      data: {
        userId: engineer.id,
        projectId: project.id,
        roleNote: "バックエンド実装",
        startedAt: new Date("2026-04-01"),
      },
    });
  }

  console.log(`Seeded users: ${admin.email}, ${sales.email}, ${engineer.email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
