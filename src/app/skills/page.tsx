import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decideSuggestion } from "@/app/actions";

const CATEGORY_LABELS: Record<string, string> = {
  LANGUAGE: "言語",
  FRAMEWORK: "フレームワーク",
  CLOUD: "クラウド",
  DATABASE: "データベース",
  AI: "AI",
  TOOL: "ツール",
  PROCESS: "工程",
  SOFT: "ソフトスキル",
  OTHER: "その他",
};

const KIND_LABELS: Record<string, string> = {
  NEW_SKILL: "新スキル",
  LEVEL_UP: "レベルアップ",
  EXPERIENCE: "実績",
};

export default async function SkillsPage() {
  const user = await getCurrentUser();

  const [suggestions, skills] = await Promise.all([
    prisma.skillSuggestion.findMany({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.engineerSkill.findMany({
      where: { userId: user.id },
      include: { skill: true },
      orderBy: [{ level: "desc" }],
    }),
  ]);

  const byCategory = new Map<string, typeof skills>();
  for (const s of skills) {
    const list = byCategory.get(s.skill.category) ?? [];
    list.push(s);
    byCategory.set(s.skill.category, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">スキルマップ</h1>
        <p className="text-sm text-zinc-500">{user.name}</p>
      </div>

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">
            AIからの更新提案
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              {suggestions.length}件
            </span>
          </h2>
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-md border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                      {KIND_LABELS[s.kind]}
                    </span>
                    {s.skillName}
                    {s.suggestedLevel != null && ` → Lv${s.suggestedLevel}`}
                  </p>
                  <p className="text-sm text-zinc-600">{s.reason}</p>
                  {s.evidenceQuote && (
                    <p className="border-l-2 border-zinc-300 pl-2 text-xs text-zinc-500">
                      週報より: 「{s.evidenceQuote}」
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await decideSuggestion(s.id, true);
                    }}
                  >
                    <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
                      承認
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await decideSuggestion(s.id, false);
                    }}
                  >
                    <button className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-100">
                      却下
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-semibold">現在のスキル（{skills.length}）</h2>
        {skills.length === 0 && (
          <p className="text-sm text-zinc-500">
            まだスキルが登録されていません。週報を提出するとAIが提案します。
          </p>
        )}
        {[...byCategory.entries()].map(([category, list]) => (
          <div key={category}>
            <h3 className="mb-2 text-sm font-medium text-zinc-500">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((es) => (
                <div
                  key={es.id}
                  className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2"
                >
                  <span className="text-sm">{es.skill.name}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-400">
                      {"●".repeat(es.level)}
                      {"○".repeat(5 - es.level)}
                    </span>
                    <span className="text-xs font-medium">Lv{es.level}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
