import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { PostForm } from "./post-form";

function timeAgo(d: Date): string {
  const diff = new Date().getTime() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}日前`;
  return d.toISOString().slice(0, 10);
}

export default async function YomoyamaPage() {
  await getCurrentUser();
  const posts = await prisma.yomoyamaPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { handle: true, name: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <PixelLabel>YOMOYAMA — 現場のよもやま話</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          よもやま
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          現場の悲喜こもごもを気軽に。愚痴も自慢も学びも。ハンドル名で残ります。
        </p>
      </div>

      <Window title="つぶやく" titleEm=".new">
        <PostForm />
        <p className="mt-2 rounded-lg border-2 border-dashed border-royal2 bg-quotebg px-3 py-2 text-[11.5px] text-inksoft">
          🛡 投稿前にAIが確認し、<b>個人名・会社名・案件名・著名人への言及・攻撃的な表現</b>
          を含む投稿はブロックされます。安心して書ける場を保つためのしくみです。
        </p>
      </Window>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-inksoft">
            まだ投稿はありません。最初のひとことをどうぞ。
          </p>
        ) : (
          posts.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border-2 border-line8 bg-surface px-4 py-3 shadow-hard-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-pixel text-[11px] tracking-wide text-royal2">
                  {p.author.handle ?? p.author.name}
                </span>
                <span className="font-pixel text-[10px] tracking-wide text-inksoft">
                  {timeAgo(p.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                {p.body}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
