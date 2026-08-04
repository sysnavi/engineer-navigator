// きおくのアルバム: 「きおくの現場」を満了すると、その仕事の史実解説が1ページ解放される。
// 解放状態はGenbaContractの履歴から導出（ダンジョン方式・専用テーブルなし）。
// 消えた仕事は飲み屋やSNSの語りでしか残らない——それをここにアーカイブする。

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OFFER_TEMPLATES, THEMES, npcById } from "@/lib/genba/content";
import { PixelLabel, Window } from "@/components/retro";
import { NpcSprite } from "../npc-sprite";

export const metadata = {
  title: "きおくのアルバム — Engineer Navigator",
  description: "消えていった仕事の記憶。満了した「きおくの現場」がここに残る。",
};

export default async function GenbaAlbumPage() {
  const user = await getCurrentUser();

  if (user.role === "GUEST") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1>
          <PixelLabel>ALBUM — きおくのアルバム</PixelLabel>
        </h1>
        <Window title="ALBUM" titleEm=".log">
          <p className="text-[13.5px]">アルバムを開くには、アカウント登録が必要です。</p>
        </Window>
      </div>
    );
  }

  const completed = await prisma.genbaContract.findMany({
    where: { userId: user.id, status: "COMPLETED" },
    select: { offerId: true },
  });
  // offerId は "<templateId>:<date>:<枠>" 形式。先頭要素がテンプレID
  const doneIds = new Set(completed.map((c) => c.offerId.split(":")[0]));

  const eraThemes = THEMES.filter((t) => t.era);
  const eraOffers = OFFER_TEMPLATES.filter((t) => t.era);
  const unlockedCount = eraOffers.filter((t) => doneIds.has(t.id)).length;
  const tsuru = npcById("tsuru")!;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1>
        <PixelLabel>ALBUM — きおくのアルバム</PixelLabel>
      </h1>

      <Window title="ALBUM" titleEm=".log">
        <div className="flex items-start gap-3">
          <div className="shrink-0 text-center">
            <NpcSprite npc="tsuru" px={5} />
            <p className="mt-1 text-[10px]">
              {tsuru.name}
              <br />
              <span className="opacity-60">{tsuru.role}</span>
            </p>
          </div>
          <div className="min-w-0 flex-1 text-[13px]">
            <p>
              仕事はね、消えるときに音を立てないんだよ。
              ある日ふと気づくと、あの部屋も、あの道具も、もうない。
            </p>
            <p className="mt-1.5">
              ここには、あんたが実際に働いて見てきた現場だけが綴じられる。
              語れる者がいるかぎり、仕事は消えても記憶は残る。
            </p>
            <p className="mt-2 font-pixel text-[11.5px] tabular-nums opacity-80">
              しゅうろく {unlockedCount} / {eraOffers.length} ページ
            </p>
          </div>
        </div>
      </Window>

      {eraThemes.map((theme) => {
        const offers = eraOffers.filter((o) => o.theme === theme.id);
        return (
          <Window key={theme.id} title={theme.name} titleEm=".mem">
            <p className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] opacity-60">{theme.flavor}</span>
              <span className="font-pixel shrink-0 border-2 border-[var(--ink)] bg-[var(--lemon)] px-1.5 py-[1px] text-[10px]">
                {theme.era}
              </span>
            </p>
            <div className="space-y-2">
              {offers.map((o) => {
                const unlocked = doneIds.has(o.id);
                return unlocked ? (
                  <div
                    key={o.id}
                    className="border-2 border-[var(--ink)] bg-white/60 p-3 dark:bg-white/10"
                  >
                    <p className="text-[13px] font-bold">{o.title}</p>
                    <p className="mt-0.5 text-[11px] opacity-60">
                      {o.client} ── 満了済み
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed">
                      {o.era!.kioku}
                    </p>
                  </div>
                ) : (
                  <div
                    key={o.id}
                    className="border-2 border-dashed border-[var(--ink)] p-3 opacity-60"
                  >
                    <p className="text-[13px] font-bold">？？？</p>
                    <p className="mt-0.5 text-[11px]">
                      この現場を満了すると、記憶のページが解放される。
                      妙な案件は、えいぎょう信頼が高いと紛れ込んでくるらしい……
                    </p>
                  </div>
                );
              })}
            </div>
          </Window>
        );
      })}

      <p className="text-[12px]">
        <Link href="/genba" className="underline">
          💼 げんばへもどる
        </Link>
      </p>
    </div>
  );
}
