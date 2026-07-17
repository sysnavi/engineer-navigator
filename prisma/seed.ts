import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mondayOf } from "../src/lib/week";

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

  // デモユーザー（既存メンバーは同意取得済みの状態にする。
  // engineer2 はあえて未同意のままにして同意ゲートのデモに使う）
  const consented = new Date("2026-07-01T00:00:00Z");
  const admin = await prisma.user.upsert({
    where: { email: "admin@sysnavi.co.jp" },
    update: { consentedAt: consented },
    create: { email: "admin@sysnavi.co.jp", name: "管理者 デモ", role: "ADMIN", consentedAt: consented },
  });
  const sales = await prisma.user.upsert({
    where: { email: "sales@sysnavi.co.jp" },
    update: { consentedAt: consented },
    create: { email: "sales@sysnavi.co.jp", name: "営業 デモ", role: "SALES", consentedAt: consented },
  });
  const engineer = await prisma.user.upsert({
    where: { email: "engineer@sysnavi.co.jp" },
    update: { consentedAt: consented },
    create: { email: "engineer@sysnavi.co.jp", name: "エンジニア デモ", role: "ENGINEER", consentedAt: consented },
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

  // -------------------------------------------------------------------------
  // コンディション検知（Phase 2）デモ用の週報履歴
  // 実運用データではない。weekStart 単位の upsert なので再実行しても安全。
  // -------------------------------------------------------------------------

  const engineer2 = await prisma.user.upsert({
    where: { email: "engineer2@sysnavi.co.jp" },
    update: {},
    create: {
      email: "engineer2@sysnavi.co.jp",
      name: "エンジニア デモ2",
      role: "ENGINEER",
    },
  });
  const existing2 = await prisma.assignment.findFirst({
    where: { userId: engineer2.id, projectId: project.id },
  });
  if (!existing2) {
    await prisma.assignment.create({
      data: {
        userId: engineer2.id,
        projectId: project.id,
        roleNote: "テスター → バックエンド実装",
        startedAt: new Date("2026-05-01"),
      },
    });
  }

  type DemoWeek = {
    weeksAgo: number; // 今週の月曜からの週数
    self: number; // conditionSelf 1-4
    ai: number; // conditionAi 0-100
    wl: number; // workloadSelf 1-4
    wants?: boolean;
    struggle?: string;
  };

  async function seedWeeks(userId: string, weeks: DemoWeek[]) {
    const base = mondayOf(new Date());
    for (const w of weeks) {
      const weekStart = new Date(base);
      weekStart.setUTCDate(weekStart.getUTCDate() - 7 * w.weeksAgo);
      const selfNorm = ((w.self - 1) / 3) * 100;
      await prisma.weeklyReport.upsert({
        where: { userId_weekStart: { userId, weekStart } },
        update: {},
        create: {
          userId,
          weekStart,
          status: "SUBMITTED",
          submittedAt: new Date(weekStart.getTime() + 4 * 86400_000),
          conditionSelf: w.self,
          workloadSelf: w.wl,
          didText: "（デモデータ）受発注管理システムの改修・テスト対応",
          struggleText: w.struggle ?? null,
          wantsConsultation: w.wants ?? false,
          analysis: {
            create: {
              status: "DONE",
              conditionAi: w.ai,
              divergence: Math.abs(selfNorm - w.ai),
              model: "seed-demo",
              feedbackText: "（デモデータ）",
            },
          },
        },
      });
    }
  }

  // エンジニア デモ: ゆるやかな下降（今週の実データと合わせて連続下降が発火する並び）
  await seedWeeks(engineer.id, [
    { weeksAgo: 8, self: 4, ai: 88, wl: 3 },
    { weeksAgo: 7, self: 4, ai: 86, wl: 3 },
    { weeksAgo: 6, self: 4, ai: 84, wl: 3 },
    { weeksAgo: 5, self: 3, ai: 82, wl: 3 },
    { weeksAgo: 4, self: 3, ai: 80, wl: 3 },
    { weeksAgo: 3, self: 3, ai: 78, wl: 2 },
    { weeksAgo: 2, self: 3, ai: 74, wl: 2 },
    { weeksAgo: 1, self: 3, ai: 70, wl: 2 },
  ]);

  // エンジニア デモ2: 急落 + 乖離（☀️申告なのにAIトーンが極端に低い）+ 相談フラグ
  await seedWeeks(engineer2.id, [
    { weeksAgo: 8, self: 4, ai: 80, wl: 3 },
    { weeksAgo: 7, self: 4, ai: 82, wl: 3 },
    { weeksAgo: 6, self: 3, ai: 78, wl: 3 },
    { weeksAgo: 5, self: 3, ai: 76, wl: 3 },
    { weeksAgo: 4, self: 3, ai: 74, wl: 2 },
    { weeksAgo: 3, self: 3, ai: 72, wl: 2 },
    { weeksAgo: 2, self: 3, ai: 70, wl: 2 },
    { weeksAgo: 1, self: 3, ai: 68, wl: 3 },
    {
      weeksAgo: 0,
      self: 4,
      ai: 30,
      wl: 1,
      wants: true,
      struggle:
        "（デモデータ）障害対応が続いていて正直きつい。誰に相談すればいいか分からない。",
    },
  ]);

  console.log("Seeded demo condition history (engineer, engineer2)");

  // エンジニア デモ3: 週報を2週以上出していない = 連続未提出デモ用
  // （在籍2週以上の判定を通すため createdAt を過去日にする）
  const engineer3 = await prisma.user.upsert({
    where: { email: "engineer3@sysnavi.co.jp" },
    update: {},
    create: {
      email: "engineer3@sysnavi.co.jp",
      name: "エンジニア デモ3",
      role: "ENGINEER",
      consentedAt: consented,
      createdAt: new Date("2026-06-01T00:00:00Z"),
    },
  });
  const existing3 = await prisma.assignment.findFirst({
    where: { userId: engineer3.id, projectId: project.id },
  });
  if (!existing3) {
    await prisma.assignment.create({
      data: {
        userId: engineer3.id,
        projectId: project.id,
        roleNote: "インフラ運用",
        startedAt: new Date("2026-06-01"),
      },
    });
  }
  console.log("Seeded engineer3 (連続未提出デモ)");

  // -------------------------------------------------------------------------
  // 役割シミュレーター（Phase 4）のシナリオ
  // persona = AIが演じる役、objectives = リーダー職務定義書ベースの評価観点
  // -------------------------------------------------------------------------
  const scenarios = [
    {
      id: "scenario-spec-change",
      title: "顧客からの無理な仕様変更",
      description:
        "リリース1週間前に、顧客担当者から追加の仕様変更を強く求められる。スケジュールと品質を守りつつ、関係を壊さずに着地させる。",
      persona:
        "あなたは顧客側の業務担当者「田中課長」。自部門の都合で、リリース直前に「この機能も今回に入れてほしい」と強く要望する。最初は高圧的で期日にこだわるが、代替案や影響の説明には理性的に応じる。ときに感情的になるが、相手が誠実に向き合えば譲歩の余地はある。エンジニア側の発言に対して、顧客担当者として自然に反応し、会話を続けること。",
      objectives: [
        "変更のスコープと影響（工数・品質・リスク）を具体的に説明できたか",
        "頭ごなしに拒否せず、代替案（次リリース／段階対応など）を提示できたか",
        "感情的にならず、相手の事情を汲みつつ落としどころを探れたか",
        "最終的に合意事項（何を・いつ）を明確にできたか",
      ],
    },
    {
      id: "scenario-incident",
      title: "本番障害の報告と対応",
      description:
        "本番環境で障害が発生。上長への第一報から、原因調査・復旧・再発防止までの初動対応を、冷静な報告とともに進める。",
      persona:
        "あなたはエンジニアの上長「佐藤マネージャー」。本番障害の報告を受ける立場。第一報では状況・影響範囲・暫定対応を端的に求める。曖昧な報告には「影響は？」「顧客への連絡は？」と鋭く突っ込む。的確な報告には落ち着いて指示を返す。相手の報告に対してマネージャーとして自然に反応すること。",
      objectives: [
        "第一報で「何が・いつから・影響範囲・暫定対応」を簡潔に伝えられたか",
        "分かっている事実と推測を区別して報告できたか",
        "顧客・関係者への連絡要否を判断・提案できたか",
        "再発防止の観点（恒久対応）に触れられたか",
      ],
    },
    {
      id: "scenario-member-follow",
      title: "詰まっているメンバーのフォロー",
      description:
        "後輩エンジニアがタスクで行き詰まり、元気がない。答えを渡すのではなく、本人が前に進めるように1on1で支援する。",
      persona:
        "あなたは若手エンジニア「新人の山田さん」。担当タスクで詰まっており、自信を失って少し落ち込んでいる。最初は「大丈夫です」と本音を言わないが、相手が責めずに寄り添うと少しずつ状況や不安を話す。答えを一方的に渡されると受け身になる。相手の関わり方次第で前向きにも後ろ向きにもなる。後輩として自然に反応すること。",
      objectives: [
        "詰問せず、心理的安全性を保って話を引き出せたか",
        "答えを渡すのではなく、本人の考えを引き出す問いかけができたか",
        "具体的な次の一歩を本人と一緒に決められたか",
        "励ましだけで終わらせず、フォローの約束（再確認）ができたか",
      ],
    },
  ];
  for (const s of scenarios) {
    await prisma.roleplayScenario.upsert({
      where: { id: s.id },
      update: {
        title: s.title,
        description: s.description,
        persona: s.persona,
        objectives: s.objectives,
      },
      create: {
        id: s.id,
        title: s.title,
        description: s.description,
        persona: s.persona,
        objectives: s.objectives,
      },
    });
  }
  console.log(`Seeded ${scenarios.length} roleplay scenarios`);

  // -------------------------------------------------------------------------
  // 公開共有（発見ページ）のデモ: engineer と engineer2 を別々の成長の道筋で公開
  // -------------------------------------------------------------------------

  await prisma.user.update({
    where: { id: engineer.id },
    data: {
      handle: "engineer-demo",
      bio: "SESでバックエンド中心。受発注/在庫まわりの実装から本番リリースまで。最近は生成AI活用とSQLチューニングを強化中。",
      isPublic: true,
      targetDomains: ["web", "fullstack"],
    },
  });
  await prisma.user.update({
    where: { id: engineer2.id },
    data: {
      handle: "cloud-taro",
      bio: "インフラ・クラウド志向。オンプレ運用からAWS移行を担当し、IaCとコンテナ基盤を勉強中。次はSAA取得を目標に。",
      isPublic: true,
      targetDomains: ["infra"],
    },
  });

  // engineer2 に「クラウド/インフラ」系の成長の道筋（EngineerSkill + 履歴）を作る
  const cloudPath: { skill: string; steps: { level: number; weeksAgo: number; note: string }[] }[] =
    [
      {
        skill: "AWS",
        steps: [
          { level: 2, weeksAgo: 20, note: "研修とハンズオンで基礎を学習" },
          { level: 3, weeksAgo: 10, note: "検証環境をEC2/VPCで構築、一人で運用" },
          { level: 4, weeksAgo: 2, note: "本番のAWS移行に関与、リリースまで担当" },
        ],
      },
      {
        skill: "Docker",
        steps: [
          { level: 2, weeksAgo: 16, note: "既存アプリのコンテナ化を指導下で実施" },
          { level: 3, weeksAgo: 6, note: "マルチステージビルドを一人で設計" },
        ],
      },
      {
        skill: "Kubernetes",
        steps: [{ level: 1, weeksAgo: 3, note: "学習開始・ローカルで検証中" }],
      },
      {
        skill: "PostgreSQL",
        steps: [
          { level: 2, weeksAgo: 14, note: "運用中DBのバックアップ/リストアを担当" },
          { level: 3, weeksAgo: 4, note: "スロークエリの調査・改善を一人で実施" },
        ],
      },
    ];

  const base = mondayOf(new Date());
  for (const p of cloudPath) {
    const skill = await prisma.skill.findUnique({ where: { name: p.skill } });
    if (!skill) continue;
    const last = p.steps[p.steps.length - 1];
    const es = await prisma.engineerSkill.upsert({
      where: { userId_skillId: { userId: engineer2.id, skillId: skill.id } },
      update: { level: last.level },
      create: { userId: engineer2.id, skillId: skill.id, level: last.level },
    });
    // 履歴を作り直す（再実行で重複しないように一旦消す）
    await prisma.skillHistory.deleteMany({ where: { engineerSkillId: es.id } });
    for (const st of p.steps) {
      const changedAt = new Date(base);
      changedAt.setUTCDate(changedAt.getUTCDate() - 7 * st.weeksAgo);
      await prisma.skillHistory.create({
        data: {
          engineerSkillId: es.id,
          level: st.level,
          changedAt,
          sourceNote: st.note,
        },
      });
    }
  }

  // 両者の直近の週報を公開指定（コンディションは公開ビューに出ない）
  await prisma.weeklyReport.updateMany({
    where: { userId: { in: [engineer.id, engineer2.id] }, status: "SUBMITTED" },
    data: { isPublic: true },
  });

  console.log("Seeded public profiles (engineer-demo, cloud-taro)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
