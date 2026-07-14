import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { highlightKeywords, RATE_KEYWORDS } from "@/lib/highlight";
import {
  Window,
  PixelTitle,
  PixelLabel,
  LevelBlocks,
} from "@/components/retro";
import { PrintButton } from "./print-button";

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

const LEVEL_DEFS: Record<number, string> = {
  1: "学習中",
  2: "指導のもとで実務可能",
  3: "一人で実務可能",
  4: "本番リリース経験・指導可能",
  5: "設計判断・技術選定をリード",
};

function fmtMonth(d: Date | null): string {
  if (!d) return "現在";
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type RoleplayStat = {
  title: string;
  count: number;
  bestScore: number | null;
  lastAt: Date;
};

export default async function ResumePage() {
  const user = await getCurrentUser();

  const [skills, experiences, assignments, roleplays] = await Promise.all([
    prisma.engineerSkill.findMany({
      where: { userId: user.id },
      include: { skill: true },
      orderBy: [{ level: "desc" }],
    }),
    prisma.skillSuggestion.findMany({
      where: { userId: user.id, status: "APPROVED", kind: "EXPERIENCE" },
      include: { sourceReport: true },
      orderBy: { decidedAt: "desc" },
    }),
    prisma.assignment.findMany({
      where: { userId: user.id },
      include: { project: true },
      orderBy: { startedAt: "desc" },
    }),
    // 完了したロールプレイ演習は、リーダーシップのエビデンスとして経歴書に載せる
    prisma.roleplaySession.findMany({
      where: { userId: user.id, status: "COMPLETED" },
      include: { scenario: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // シナリオ別に集計（回数と最高スコア）
  const roleplayStats = new Map<string, RoleplayStat>();
  for (const r of roleplays) {
    let score: number | null = null;
    try {
      score = r.feedback ? (JSON.parse(r.feedback).score as number) : null;
    } catch {
      score = null;
    }
    const cur = roleplayStats.get(r.scenario.title);
    if (cur) {
      cur.count += 1;
      if (score != null && (cur.bestScore == null || score > cur.bestScore)) {
        cur.bestScore = score;
      }
    } else {
      roleplayStats.set(r.scenario.title, {
        title: r.scenario.title,
        count: 1,
        bestScore: score,
        lastAt: r.createdAt,
      });
    }
  }
  const roleplayList = [...roleplayStats.values()];

  const byCategory = new Map<string, typeof skills>();
  for (const s of skills) {
    const list = byCategory.get(s.skill.category) ?? [];
    list.push(s);
    byCategory.set(s.skill.category, list);
  }

  const today = new Date();
  const updated = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="print-root space-y-7">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <PixelLabel>CAREER_SHEET.doc — 週報から自動組版</PixelLabel>
          <PixelTitle as="h1" className="text-3xl text-royal">
            経歴書
          </PixelTitle>
        </div>
        <PrintButton />
      </div>

      {/* ヘッダー（印刷時はここが先頭） */}
      <Window title="PROFILE" titleEm=".txt">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-extrabold">{user.name}</h2>
          <p className="text-[12px] text-inksoft">更新日: {updated}</p>
        </div>
        <p className="mt-2 text-[13px] text-inksoft">
          スキル {skills.length} 件 ・ 実績 {experiences.length} 件 ・ 経歴{" "}
          {assignments.length} 件
          {roleplays.length > 0 && ` ・ リーダーシップ演習 ${roleplays.length} 回`}{" "}
          — すべて週報のAI解析と本人承認、演習の実施記録から自動生成。
          各実績は元の週報まで遡って根拠を辿れます。
        </p>
        <p className="mt-2 text-[11.5px] text-inksoft">
          強調表示（
          <mark className="kw8">{RATE_KEYWORDS[1]}</mark>
          など）は単価交渉で効くキーワードの自動ハイライトです。
        </p>
      </Window>

      {/* スキル */}
      <Window title="SKILLS" titleEm={` (${skills.length})`}>
        {skills.length === 0 ? (
          <p className="text-[13px] text-inksoft">
            スキルが未登録です。週報を提出して承認するとここに載ります。
          </p>
        ) : (
          <div className="space-y-5">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category}>
                <PixelLabel className="mb-2">
                  {CATEGORY_LABELS[category] ?? category}
                </PixelLabel>
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {list.map((es) => (
                      <tr
                        key={es.id}
                        className="border-b-2 border-dashed border-grid8 last:border-0"
                      >
                        <td className="py-2 pr-3 font-bold">{es.skill.name}</td>
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            <LevelBlocks level={es.level} />
                            <span className="font-pixel text-[12px] text-royal2">
                              Lv{es.level}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 text-[12px] text-inksoft">
                          {LEVEL_DEFS[es.level]}
                          {es.monthsExperience != null &&
                            ` ・ ${es.monthsExperience}ヶ月`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Window>

      {/* 実績（承認済みEXPERIENCE） */}
      <Window title="ACHIEVEMENTS" titleEm={` (${experiences.length})`}>
        {experiences.length === 0 ? (
          <p className="text-[13px] text-inksoft">
            承認済みの実績がまだありません。週報で「本番リリース」「AI活用」などの実績を書くとAIが提案します。
          </p>
        ) : (
          <ol className="space-y-4">
            {experiences.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border-2 border-line8 bg-surface p-4 shadow-hard-sm"
              >
                <p className="text-[14px] font-extrabold">
                  {highlightKeywords(e.skillName)}
                  <span className="ml-2 font-pixel text-[11px] tracking-wide text-inksoft">
                    {e.sourceReport.weekStart.toISOString().slice(0, 10)} の週報より
                  </span>
                </p>
                <p className="mt-1.5 text-[13px]">{highlightKeywords(e.reason)}</p>
                {e.evidenceQuote && (
                  <p className="quote8 mt-2">
                    根拠:「{highlightKeywords(e.evidenceQuote)}」
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Window>

      {/* リーダーシップ演習（役割シミュレーターの実績） */}
      {roleplayList.length > 0 && (
        <Window title="LEADERSHIP" titleEm={` (${roleplays.length})`}>
          <p className="mb-3 text-[12.5px] text-inksoft">
            <mark className="kw8">リーダーシップ演習</mark>{" "}
            {roleplays.length} 回 — 役割シミュレーターで、顧客折衝・障害対応・メンバー育成の実践演習を実施。
            職務定義書に基づく評価を受けています。
          </p>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {roleplayList.map((r) => (
                <tr
                  key={r.title}
                  className="border-b-2 border-dashed border-grid8 last:border-0"
                >
                  <td className="py-2 pr-3 font-bold">{r.title}</td>
                  <td className="py-2 pr-3 font-pixel text-[12px] text-royal2">
                    {r.count}回
                  </td>
                  <td className="py-2 text-[12px] text-inksoft">
                    {r.bestScore != null ? `最高評価 ${r.bestScore}点` : "—"}
                    {" ・ "}
                    {r.lastAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Window>
      )}

      {/* 案件履歴 */}
      <Window title="PROJECTS" titleEm={` (${assignments.length})`}>
        {assignments.length === 0 ? (
          <p className="text-[13px] text-inksoft">案件履歴がまだ登録されていません。</p>
        ) : (
          <ol className="space-y-3">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-dashed border-grid8 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-[13.5px] font-extrabold">
                    {a.project.name}
                    {a.project.clientAlias && (
                      <span className="ml-2 text-[12px] font-normal text-inksoft">
                        ({a.project.clientAlias})
                      </span>
                    )}
                  </p>
                  {a.roleNote && (
                    <p className="text-[12.5px] text-inksoft">
                      {highlightKeywords(a.roleNote)}
                    </p>
                  )}
                </div>
                <p className="font-pixel text-[11.5px] tracking-wide text-inksoft">
                  {fmtMonth(a.startedAt)} — {fmtMonth(a.endedAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Window>

      <p className="no-print text-center font-pixel text-[12px] tracking-[0.1em] text-royal2">
        「いんさつ / PDF」で営業向けの通常組版に変換されます（8bit装飾は自動で外れます）
      </p>
    </div>
  );
}
