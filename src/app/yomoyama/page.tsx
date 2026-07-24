import { requireFullAccount } from "@/lib/guest";
import { prisma } from "@/lib/db";
import { PixelTitle, PixelLabel } from "@/components/retro";
import { Composer } from "./composer";
import { LikeButton } from "./like-button";
import { CommentForm } from "./comment-form";
import { setAllowComments, deleteComment } from "./actions";

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
  const me = await requireFullAccount();
  const isAdmin = me.role === "ADMIN";

  const posts = await prisma.yomoyamaPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      author: { select: { id: true, handle: true, name: true } },
      _count: { select: { likes: true } },
      likes: { where: { userId: me.id }, select: { id: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { handle: true, name: true } } },
      },
    },
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

      <Composer />

      <div className="space-y-3">
        {posts.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-inksoft">
            まだ投稿はありません。最初のひとことをどうぞ。
          </p>
        ) : (
          posts.map((p) => {
            const mine = p.author.id === me.id;
            const liked = p.likes.length > 0;
            return (
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

                {/* いいね + コメント数 + 投稿者のコメント可否トグル */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <LikeButton
                    postId={p.id}
                    initialLiked={liked}
                    initialCount={p._count.likes}
                  />
                  <span className="font-pixel text-[10px] tracking-wide text-inksoft">
                    💬 {p.comments.filter((c) => !c.deletedAt).length}
                  </span>
                  {mine && (
                    <form
                      action={setAllowComments.bind(
                        null,
                        p.id,
                        !p.allowComments
                      )}
                      className="ml-auto"
                    >
                      <button className="font-pixel text-[10px] tracking-wide text-inksoft underline-offset-2 hover:text-royal2 hover:underline">
                        コメント: {p.allowComments ? "受付中 → 停止" : "停止中 → 再開"}
                      </button>
                    </form>
                  )}
                </div>

                {/* コメント一覧 */}
                {p.comments.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 border-t-2 border-dashed border-grid8 pt-2.5">
                    {p.comments.map((c) =>
                      c.deletedAt ? (
                        <p
                          key={c.id}
                          className="text-[11.5px] italic text-inksoft"
                        >
                          — このコメントは削除されました —
                        </p>
                      ) : (
                        <div key={c.id} className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-pixel text-[10px] tracking-wide text-royal2">
                              {c.author.handle ?? c.author.name}
                            </span>
                            <span className="ml-1.5 font-pixel text-[9px] tracking-wide text-inksoft">
                              {timeAgo(c.createdAt)}
                            </span>
                            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">
                              {c.body}
                            </p>
                          </div>
                          {isAdmin && (
                            <form action={deleteComment.bind(null, c.id)}>
                              <button
                                className="shrink-0 font-pixel text-[9px] tracking-wide text-pinkhot hover:underline"
                                title="管理者として削除"
                              >
                                削除
                              </button>
                            </form>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* コメント投稿欄（受付中のみ） */}
                {p.allowComments ? (
                  <CommentForm postId={p.id} />
                ) : (
                  <p className="mt-2 font-pixel text-[10px] tracking-wide text-inksoft">
                    この投稿はコメントを受け付けていません。
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
