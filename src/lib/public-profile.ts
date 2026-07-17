import { prisma } from "@/lib/db";

// 公開プロフィール（成長の道筋を他ユーザーが見て学ぶ）のデータ組み立て。
//
// 【鉄則】コンディション（メンタル系）は絶対に公開しない。
// 公開するのは「成長の記録」だけ: スキル・レベル履歴・実績・演習・週報の
// 「やったこと/新技術/来週」のみ。conditionSelf/workloadSelf/struggleText(設問5)/
// shareText(設問7)/AIトーンスコア は公開ビューに一切含めない。

export async function loadPublicProfile(handle: string) {
  const user = await prisma.user.findUnique({
    where: { handle },
    select: { id: true, name: true, handle: true, bio: true, isPublic: true },
  });
  if (!user || !user.isPublic) return null;

  const [skills, histories, experiences, roleplays, reports] = await Promise.all([
    prisma.engineerSkill.findMany({
      where: { userId: user.id },
      include: { skill: true },
      orderBy: [{ level: "desc" }],
    }),
    // 成長の道筋: レベルが変わった履歴を時系列で
    prisma.skillHistory.findMany({
      where: { engineerSkill: { userId: user.id } },
      include: { engineerSkill: { include: { skill: true } } },
      orderBy: { changedAt: "asc" },
    }),
    prisma.skillSuggestion.findMany({
      where: { userId: user.id, status: "APPROVED", kind: "EXPERIENCE" },
      orderBy: { decidedAt: "desc" },
      select: { id: true, skillName: true, reason: true },
    }),
    prisma.roleplaySession.findMany({
      where: { userId: user.id, status: "COMPLETED" },
      include: { scenario: { select: { title: true } } },
    }),
    // 公開指定された週報のみ。かつ「成長の記録」フィールドだけ選択（コンディション系は取得しない）
    prisma.weeklyReport.findMany({
      where: { userId: user.id, status: "SUBMITTED", isPublic: true },
      orderBy: { weekStart: "desc" },
      take: 12,
      select: {
        id: true,
        weekStart: true,
        didText: true,
        newText: true,
        nextText: true,
      },
    }),
  ]);

  const byCategory = new Map<string, typeof skills>();
  for (const s of skills) {
    const list = byCategory.get(s.skill.category) ?? [];
    list.push(s);
    byCategory.set(s.skill.category, list);
  }

  const roleplayCount = roleplays.length;

  return {
    user,
    skills,
    byCategory,
    histories,
    experiences,
    roleplayCount,
    reports,
    topSkills: skills.slice(0, 5),
  };
}

export type PublicProfile = NonNullable<
  Awaited<ReturnType<typeof loadPublicProfile>>
>;

/** 発見ページ用: 公開プロフィールの一覧（サマリー） */
export async function listPublicProfiles() {
  const users = await prisma.user.findMany({
    where: { isPublic: true, handle: { not: null } },
    select: { name: true, handle: true, bio: true },
    orderBy: { updatedAt: "desc" },
  });

  // 各人のトップスキルと最高レベルを添える
  const summaries = await Promise.all(
    users.map(async (u) => {
      const skills = await prisma.engineerSkill.findMany({
        where: { user: { handle: u.handle } },
        include: { skill: true },
        orderBy: { level: "desc" },
        take: 4,
      });
      const expCount = await prisma.skillSuggestion.count({
        where: {
          user: { handle: u.handle },
          status: "APPROVED",
          kind: "EXPERIENCE",
        },
      });
      return {
        ...u,
        topSkills: skills.map((s) => ({ name: s.skill.name, level: s.level })),
        maxLevel: skills[0]?.level ?? 0,
        expCount,
      };
    })
  );
  return summaries;
}
