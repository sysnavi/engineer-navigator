import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Window,
  PixelTitle,
  PixelLabel,
  LevelBlocks,
} from "@/components/retro";
import {
  SKILL_LEVEL_MAX,
  skillLevelDef,
  VERIFIED_LABELS,
} from "@/lib/skill-levels";
import { SuggestionCard, type SuggestionData } from "./suggestion-card";

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
  EXPERIENCE: "実績 / EXP",
};

// ---- レーダーチャート（カテゴリ別平均レベル・SVG 8bit風） ----
function RadarChart(props: { axes: { label: string; value: number }[] }) {
  const { axes } = props;
  const cx = 150;
  const cy = 130;
  const R = 88;
  const MAX = SKILL_LEVEL_MAX;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = (R * v) / MAX;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = (v: number) =>
    axes.map((_, i) => pt(i, v).map((n) => Math.round(n)).join(",")).join(" ");
  const data = axes
    .map((ax, i) => pt(i, ax.value).map((n) => Math.round(n)).join(","))
    .join(" ");

  return (
    <svg
      viewBox="0 0 300 265"
      className="mx-auto w-full max-w-[340px]"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`カテゴリ別スキルレーダー: ${axes
        .map((a) => `${a.label} ${a.value.toFixed(1)}`)
        .join("、")}`}
    >
      {[2, 4, 6, 8, 10].map((v) => (
        <polygon
          key={v}
          points={poly(v)}
          fill="none"
          stroke="var(--grid)"
          strokeWidth={v === SKILL_LEVEL_MAX ? 2.5 : 1.5}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, MAX);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--grid)"
            strokeWidth="1.5"
          />
        );
      })}
      <polygon
        points={data}
        fill="var(--royal-2)"
        fillOpacity="0.35"
        stroke="var(--royal)"
        strokeWidth="3"
      />
      {axes.map((ax, i) => {
        const [x, y] = pt(i, ax.value);
        return (
          <rect
            key={i}
            x={x - 4}
            y={y - 4}
            width="8"
            height="8"
            fill="var(--pink-hot)"
            stroke="var(--line)"
            strokeWidth="1.5"
          />
        );
      })}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, MAX + 1.1);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="700"
            fill="var(--ink)"
          >
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}

export default async function SkillsPage() {
  const user = await getCurrentUser();

  const [suggestions, skills, histories] = await Promise.all([
    prisma.skillSuggestion.findMany({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.engineerSkill.findMany({
      where: { userId: user.id },
      include: { skill: true },
      orderBy: [{ level: "desc" }],
    }),
    prisma.skillHistory.findMany({
      where: { engineerSkill: { userId: user.id } },
      include: { engineerSkill: { include: { skill: true } } },
      orderBy: { changedAt: "desc" },
      take: 8,
    }),
  ]);

  const byCategory = new Map<string, typeof skills>();
  for (const s of skills) {
    const list = byCategory.get(s.skill.category) ?? [];
    list.push(s);
    byCategory.set(s.skill.category, list);
  }

  const radarAxes = [...byCategory.entries()]
    .map(([cat, list]) => ({
      label: CATEGORY_LABELS[cat] ?? cat,
      value: list.reduce((a, s) => a + s.level, 0) / list.length,
    }))
    .slice(0, 8);

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>SKILL_MAP.sav — {user.name}</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          スキルマップ
        </PixelTitle>
      </div>

      {suggestions.length > 0 && (
        <Window
          title="AIからの提案"
          barClass="!bg-pinkhot"
          bodyClass="p-5 space-y-4"
        >
          <PixelLabel className="!text-pinkhot">
            LEVEL UP READY! — {suggestions.length}件
          </PixelLabel>
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              aiEnabled={!!process.env.ANTHROPIC_API_KEY}
              suggestion={{
                id: s.id,
                kindLabel: KIND_LABELS[s.kind] ?? s.kind,
                skillName: s.skillName,
                suggestedLevel: s.suggestedLevel,
                reason: s.reason,
                evidenceQuote: s.evidenceQuote,
                // 判定済みで未承認のまま再訪した場合も、判定結果と根拠を復元する
                // （渡さないと確定Lvの下に旧Lvの根拠だけが残り矛盾して見える）
                probe: s.probe as SuggestionData["probe"],
              }}
            />
          ))}
        </Window>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Window title="RADAR" titleEm=".viz">
          {radarAxes.length >= 3 ? (
            <RadarChart axes={radarAxes} />
          ) : (
            <p className="py-8 text-center text-[13px] text-inksoft">
              カテゴリが3つ以上になるとレーダーチャートが表示されます
            </p>
          )}
        </Window>

        <Window title="成長ログ" titleEm=".log">
          {histories.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-inksoft">
              提案を承認するとここに成長の履歴が刻まれます
            </p>
          ) : (
            <ol className="space-y-3">
              {histories.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 border-b-2 border-dashed border-grid8 pb-2.5 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-extrabold">
                      {h.engineerSkill.skill.name}
                    </p>
                    <p className="font-pixel text-[11px] tracking-wide text-inksoft">
                      {h.changedAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <LevelBlocks level={h.level} max={SKILL_LEVEL_MAX} />
                    <span className="font-pixel text-[12px] text-royal2">
                      Lv{h.level}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Window>
      </div>

      <Window title="現在のスキル" titleEm={` (${skills.length})`}>
        {skills.length === 0 && (
          <p className="text-[13px] text-inksoft">
            まだスキルが登録されていません。週報を提出するとAIが提案します。
          </p>
        )}
        {skills.length > 0 && (
          <p className="mb-3 text-[11.5px] text-inksoft">
            ⚠仮判定のスキルは、承認時の深掘りインタビューか、腕試しで同じお題の問題に2問正解すると ✓検証済み になります。
          </p>
        )}
        <div className="space-y-5">
          {[...byCategory.entries()].map(([category, list]) => (
            <div key={category}>
              <PixelLabel className="mb-2">
                {CATEGORY_LABELS[category] ?? category}
              </PixelLabel>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {list.map((es) => (
                  <div
                    key={es.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border-2 border-line8 bg-surface px-3 py-2.5 shadow-hard-sm"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-bold">
                      <span className="truncate">{es.skill.name}</span>
                      {es.verifiedBy ? (
                        <span
                          className="shrink-0 font-pixel text-[9.5px] tracking-wide text-[var(--good)]"
                          title={VERIFIED_LABELS[es.verifiedBy] ?? "検証済み"}
                        >
                          ✓検証済み
                        </span>
                      ) : (
                        <span
                          className="shrink-0 font-pixel text-[9.5px] tracking-wide text-inksoft"
                          title="深掘りインタビューか腕試しの正解で検証済みになります"
                        >
                          ⚠仮判定
                        </span>
                      )}
                    </span>
                    <span
                      className="flex items-center gap-2"
                      title={skillLevelDef(es.level).behavior}
                    >
                      <LevelBlocks level={es.level} max={SKILL_LEVEL_MAX} />
                      <span className="font-pixel text-[12px] text-royal2">
                        Lv{es.level}
                        <span className="text-inksoft">
                          「{skillLevelDef(es.level).label}」
                        </span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Window>
    </div>
  );
}
