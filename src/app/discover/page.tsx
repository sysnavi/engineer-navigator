import Link from "next/link";
import { listPublicProfiles } from "@/lib/public-profile";
import { Window, PixelTitle, PixelLabel, LevelBlocks } from "@/components/retro";

export default async function DiscoverPage() {
  const profiles = await listPublicProfiles();

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>DISCOVER</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          みんなの成長
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          公開されているエンジニアの成長の道筋を見て学べます。マイページで自分のプロフィールも公開できます。
        </p>
      </div>

      {profiles.length === 0 ? (
        <Window title="DISCOVER" titleEm=".sav">
          <p className="py-4 text-center text-[13px] text-inksoft">
            まだ公開プロフィールがありません。マイページから公開できます。
          </p>
        </Window>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {profiles.map((p) => (
            <Link key={p.handle} href={`/u/${p.handle}`} className="group">
              <Window
                title="PROFILE"
                titleEm=".card"
                className="h-full transition-transform group-hover:-translate-y-0.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-extrabold">
                    {p.name}
                    {p.generation >= 2 && (
                      <span className="ml-1.5 font-pixel text-[10.5px] font-normal tracking-wide text-pinkhot">
                        ★第{p.generation}世代
                      </span>
                    )}
                  </span>
                  <span className="font-pixel text-[11px] text-inksoft">
                    @{p.handle}
                  </span>
                </div>
                {p.bio && (
                  <p className="mt-1 line-clamp-2 text-[12.5px] text-inksoft">
                    {p.bio}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {p.topSkills.map((s) => (
                    <span
                      key={s.name}
                      className="flex items-center gap-1.5 text-[12px]"
                    >
                      <span className="font-bold">{s.name}</span>
                      <LevelBlocks level={s.level} />
                    </span>
                  ))}
                </div>
                {p.expCount > 0 && (
                  <p className="mt-2 font-pixel text-[10.5px] tracking-wide text-royal2">
                    実績 {p.expCount} 件 ・ 最高Lv{p.maxLevel}
                  </p>
                )}
              </Window>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
