import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicProfile } from "@/lib/public-profile";
import { speciesById } from "@/lib/pets/species";
import { Window, PixelTitle, PixelLabel, LevelBlocks } from "@/components/retro";
import { SKILL_LEVEL_MAX, skillLevelDef } from "@/lib/skill-levels";

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

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await loadPublicProfile(handle);
  if (!profile) notFound();

  const { user, byCategory, histories, experiences, roleplayCount, reports, generation, pets } =
    profile;

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <PixelLabel>PUBLIC PROFILE — @{user.handle}</PixelLabel>
          <PixelTitle as="h1" className="text-3xl text-royal">
            {user.name}
            {generation >= 2 && (
              <span className="ml-2.5 align-middle font-pixel text-[13px] tracking-wide text-pinkhot">
                ★第{generation}世代
              </span>
            )}
          </PixelTitle>
          {user.bio && (
            <p className="mt-1.5 max-w-[60ch] text-[13px] text-inksoft">
              {user.bio}
            </p>
          )}
        </div>
        <Link href="/discover" className="btn8 text-[12px]">
          ← 発見
        </Link>
      </div>

      {/* 成長の道筋（レベル履歴タイムライン）— この画面の主役 */}
      <Window title="成長の道筋" titleEm=".log">
        {histories.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-inksoft">
            まだ道筋の記録がありません。
          </p>
        ) : (
          <ol className="space-y-2.5">
            {histories.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 border-b-2 border-dashed border-grid8 pb-2.5 last:border-0 last:pb-0"
              >
                <span className="w-[92px] shrink-0 font-pixel text-[11px] tracking-wide text-inksoft">
                  {h.changedAt.toISOString().slice(0, 10)}
                </span>
                <span className="flex-1 text-[13.5px] font-bold">
                  {h.engineerSkill.skill.name}
                </span>
                <span className="flex items-center gap-2">
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

      {/* スキルマップ */}
      <Window title="SKILLS" titleEm={` (${profile.skills.length})`}>
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
                    className="flex items-center justify-between rounded-lg border-2 border-line8 bg-surface px-3 py-2.5 shadow-hard-sm"
                  >
                    <span className="text-[13.5px] font-bold">{es.skill.name}</span>
                    <span className="flex items-center gap-2" title={skillLevelDef(es.level).behavior}>
                      <LevelBlocks level={es.level} max={SKILL_LEVEL_MAX} />
                      <span className="font-pixel text-[12px] text-royal2">
                        Lv{es.level}
                        <span className="text-inksoft">「{skillLevelDef(es.level).label}」</span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Window>

      {/* 実績・演習 */}
      {(experiences.length > 0 || roleplayCount > 0) && (
        <Window title="ACHIEVEMENTS" titleEm=".log">
          {roleplayCount > 0 && (
            <p className="mb-3 text-[12.5px]">
              <span className="badge8">演習</span> リーダーシップ演習 {roleplayCount}{" "}
              回
            </p>
          )}
          <ul className="space-y-2.5">
            {experiences.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border-2 border-line8 bg-surface p-3 shadow-hard-sm"
              >
                <p className="text-[13.5px] font-extrabold">{e.skillName}</p>
                <p className="mt-1 text-[12.5px] text-inksoft">{e.reason}</p>
              </li>
            ))}
          </ul>
        </Window>
      )}

      {/* 公開された週報（成長の記録のみ・コンディションは含まない） */}
      {reports.length > 0 && (
        <Window title="週報" titleEm=".pub">
          <p className="mb-3 text-[11.5px] text-inksoft">
            本人が公開した週報の「やったこと・新しく触れた技術・来週やること」のみ。
            コンディションなどの非公開項目は含まれません。
          </p>
          <ol className="space-y-4">
            {reports.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border-2 border-line8 bg-surface p-4 shadow-hard-sm"
              >
                <p className="font-pixel text-[11px] tracking-wide text-royal2">
                  {r.weekStart.toISOString().slice(0, 10)} の週
                </p>
                {r.didText && (
                  <p className="mt-2 whitespace-pre-wrap text-[13px]">
                    <b className="text-inksoft">やったこと: </b>
                    {r.didText}
                  </p>
                )}
                {r.newText && (
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px]">
                    <b className="text-inksoft">新しく触れた技術: </b>
                    {r.newText}
                  </p>
                )}
                {r.nextText && (
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px]">
                    <b className="text-inksoft">来週やること: </b>
                    {r.nextText}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Window>
      )}

      {pets.length > 0 && (
        <Window title="なかま" titleEm=".sav">
          <div className="flex flex-wrap gap-4">
            {pets.map((p) => {
              const sp = speciesById(p.speciesId);
              if (!sp) return null;
              return (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sp.sprites.normal}
                    alt={p.name}
                    width={44}
                    height={44}
                    style={{ imageRendering: "pixelated" }}
                  />
                  <span className="font-pixel text-[10px] tracking-wide">{p.name}</span>
                </div>
              );
            })}
          </div>
        </Window>
      )}

      <p className="text-center font-pixel text-[11px] tracking-[0.1em] text-royal2">
        ▶ ENGINEER NAVIGATOR — 成長を公開して学び合う
      </p>
    </div>
  );
}
