// おさんぽ（WALK.sav）: うちの子とのんびり外を歩くだけのページ（見る専・低負荷）。
// つぶやきは時刻×天気×きみのコンディションに寄り添う。コンディションは本人だけが見える値
// （#16セルフケアの原則）を、ここでは粗いbucketに畳んでクライアントへ渡すだけ。

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { speciesById } from "@/lib/pets/species";
import { getConditionSeries, type WeekPoint } from "@/lib/condition";
import { moodBucket, loadBucket } from "@/lib/walk/mutter";
import { PixelTitle, PixelLabel, Window } from "@/components/retro";
import { WalkScene, type WalkPet } from "./walk-scene";

export const metadata = {
  title: "おさんぽ — Engineer Navigator",
  description: "うちの子とのんびり外を歩く。天気とあなたの調子に寄り添って、ときどきひとこと。",
};

export default async function WalkPage() {
  const user = await getCurrentUser();

  const [petRows, series] = await Promise.all([
    prisma.pet.findMany({
      where: { userId: user.id },
      orderBy: { affection: "desc" }, // いちばん仲良しの子が先頭
    }),
    getConditionSeries(user.id, 4).catch((): WeekPoint[] => []),
  ]);

  const pets: WalkPet[] = petRows
    .map((p) => {
      const sp = speciesById(p.speciesId);
      if (!sp) return null;
      return {
        id: p.id,
        name: p.name,
        personality: sp.personality,
        affection: p.affection,
        spriteNormal: sp.sprites.normal,
        spriteWalk: sp.sprites.walk ?? sp.sprites.normal,
      };
    })
    .filter((p): p is WalkPet => p !== null);

  const latest = series.at(-1);
  const mood = moodBucket(latest?.score);
  const load = loadBucket(latest?.workloadSelf);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <PixelLabel>WALK — おさんぽ</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          おさんぽ
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          うちの子と、ただ歩くだけ。
        </p>
      </div>

      {pets.length === 0 ? (
        <Window title="WALK" titleEm=".sav">
          <p className="text-[13.5px]">
            まだいっしょに歩ける子がいません。
            <br />
            マイホームに遊びに来る子に話しかけて、仲間になってもらいましょう。
          </p>
          <Link href="/home" className="btn8 btn8-ok mt-4 inline-block text-[12px]">
            🏠 マイホームへ
          </Link>
        </Window>
      ) : (
        <>
          <WalkScene pets={pets} mood={mood} load={load} />
          <p className="text-center text-[11.5px] text-inksoft">
            ながめているだけでOK。むりに操作しなくていいよ。
          </p>
        </>
      )}
    </div>
  );
}
