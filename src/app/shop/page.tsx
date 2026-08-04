// おかいもの（SHOP.cat）: げんばで稼いだENの使い道。
// 松版: シリーズ制コレクション。定番2シリーズは常時在庫、新シリーズ3つは週替わり入荷。
// 未所持で入荷待ちの商品はシルエット（？？？）で「次の入荷」を楽しみにさせる。
// シリーズコンプで きせかえ（壁紙/床）が解放される。マスタは src/lib/shop/content.ts。

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  SHOP_SERIES,
  seriesItems,
  seriesComplete,
  weeklyStock,
  type ShopItem,
} from "@/lib/shop/content";
import { FLOORS, WALLPAPERS } from "@/lib/home/scene";
import { PixelLabel, Window } from "@/components/retro";
import { ShopSprite } from "@/components/shop-sprite";
import { ActionForm } from "@/components/toast";
import { buyItem } from "./actions";

export const metadata = {
  title: "おかいもの — Engineer Navigator",
  description: "げんばで稼いだENで、マイホームの家具をそろえよう。",
};

function ItemCard(props: {
  item: ShopItem;
  owned: boolean;
  inStock: boolean;
  rotating: boolean;
  affordable: boolean;
}) {
  const { item, owned, inStock, rotating, affordable } = props;

  // 未所持 × 入荷待ち: シルエットで「いつか買えるもの」の存在だけ見せる
  if (!owned && !inStock) {
    return (
      <div className="flex items-start gap-3 rounded-lg border-2 border-dashed border-line8/50 bg-surface/60 p-3">
        <span className="shrink-0 p-1.5">
          <ShopSprite id={item.id} px={4} variant="silhouette" label="？？？" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-[12px] tracking-wide text-inksoft">？？？</p>
          <p className="mt-1 text-[11px] leading-snug text-inksoft">
            いまは入荷していません。週替わりの入荷をおたのしみに
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border-2 border-line8 bg-win p-3">
      <span className="shrink-0 border-2 border-[var(--line8,#ccc)] bg-white/50 p-1.5 dark:bg-white/10">
        <ShopSprite id={item.id} px={4} label={item.name} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-extrabold leading-tight">
          {item.name}
          {rotating && inStock && !owned && (
            <span className="ml-1.5 font-pixel text-[9px] text-pinkhot">✨今週入荷</span>
          )}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug opacity-80">{item.desc}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-pixel text-[12.5px] tabular-nums">
            {item.price.toLocaleString()} EN
          </span>
          {owned ? (
            <span className="text-[11px] font-bold text-[var(--good,#2e9e5b)]">
              ✔ おうちにあります
            </span>
          ) : (
            <ActionForm
              ok={`${item.name} をかいました！ リビングにとどきました`}
              action={async () => {
                "use server";
                const res = await buyItem(item.id);
                if (!res.ok) throw new Error(res.reason);
              }}
            >
              <button
                className="btn8 btn8-ok text-[11.5px] disabled:opacity-50"
                disabled={!affordable}
                title={affordable ? undefined : "ENが足りません"}
              >
                かう
              </button>
            </ActionForm>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function ShopPage() {
  const user = await getCurrentUser();

  if (user.role === "GUEST") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1>
          <PixelLabel>SHOP — おかいもの</PixelLabel>
        </h1>
        <Window title="SHOP" titleEm=".cat">
          <p className="text-[13.5px]">
            おかいものには、アカウント登録が必要です。
          </p>
        </Window>
      </div>
    );
  }

  const [wallet, purchases, logs] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: user.id } }),
    prisma.purchase.findMany({ where: { userId: user.id } }),
    prisma.walletLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const balance = wallet?.balance ?? 0;
  const ownedIds = new Set(purchases.map((p) => p.itemId));
  const stock = weeklyStock(new Date().toISOString().slice(0, 10));
  const totalItems = SHOP_SERIES.reduce((n, s) => n + seriesItems(s.id).length, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1>
        <PixelLabel>SHOP — おかいもの</PixelLabel>
      </h1>

      <Window title="SHOP" titleEm=".cat">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px]">
            げんばで稼いだENで、マイホームの家具をそろえよう。
            <br />
            <span className="text-[11px] opacity-70">
              買った家具はリビングにとどく（ドラッグで模様替え）。
              週替わりシリーズは毎週月曜に入荷が入れかわる。
            </span>
          </p>
          <div className="shrink-0 text-right">
            <span className="font-pixel border-2 border-[var(--ink)] bg-[var(--lemon)] px-2 py-[2px] text-[13px] tabular-nums">
              {balance.toLocaleString()} <em className="not-italic text-[10px]">EN</em>
            </span>
            <p className="mt-1.5 font-pixel text-[10px] tabular-nums text-inksoft">
              コレクション {ownedIds.size}/{totalItems}
            </p>
          </div>
        </div>
      </Window>

      {SHOP_SERIES.map((series) => {
        const items = seriesItems(series.id);
        const ownedCount = items.filter((i) => ownedIds.has(i.id)).length;
        const complete = seriesComplete(ownedIds, series.id);
        const reward =
          WALLPAPERS.find((t) => t.unlockSeries === series.id) ??
          FLOORS.find((t) => t.unlockSeries === series.id);
        const rewardKind = reward
          ? WALLPAPERS.some((t) => t.id === reward.id)
            ? "壁紙"
            : "床"
          : null;
        return (
          <Window key={series.id} title={series.name} titleEm=".set" bodyClass="p-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <PixelLabel>
                {series.name} {ownedCount}/{items.length}
              </PixelLabel>
              {series.rotating && (
                <span className="font-pixel text-[9.5px] tracking-wide text-royal2">
                  📦 週替わり入荷
                </span>
              )}
              {complete && (
                <span className="font-pixel text-[10px] tracking-wide text-[var(--good,#2e9e5b)]">
                  ★ コンプリート！
                </span>
              )}
            </div>
            <p className="mb-3 text-[11.5px] text-inksoft">{series.desc}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  owned={ownedIds.has(item.id)}
                  inStock={stock.has(item.id)}
                  rotating={series.rotating}
                  affordable={balance >= item.price}
                />
              ))}
            </div>
            {reward && (
              <p
                className={`mt-3 flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-[11.5px] font-bold ${
                  complete
                    ? "border-line8 bg-surface"
                    : "border-dashed border-line8/60 bg-surface/60 opacity-80"
                }`}
              >
                <i
                  className="h-5 w-5 shrink-0 rounded border-2 border-line8"
                  style={{ background: reward.css, filter: complete ? undefined : "grayscale(0.7)" }}
                />
                {complete
                  ? `コンプ特典 解放ずみ: ${rewardKind}「${reward.name}」（マイホームのもようがえで選べます）`
                  : `コンプ特典: ${rewardKind}「${reward.name}」`}
              </p>
            )}
          </Window>
        );
      })}

      {logs.length > 0 && (
        <Window title="TSUCHO" titleEm=".log" bodyClass="p-4">
          <PixelLabel className="mb-2">おかね の うごき</PixelLabel>
          <ul className="space-y-1 text-[12px] tabular-nums">
            {logs.map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span className="opacity-70">
                  {l.reason === "genba:complete"
                    ? "げんば 契約満了"
                    : l.reason === "genba:failed"
                      ? "げんば 途中退場"
                      : "おかいもの"}
                </span>
                <span className={l.delta >= 0 ? "text-[var(--good,#2e9e5b)]" : ""}>
                  {l.delta >= 0 ? "+" : ""}
                  {l.delta.toLocaleString()} EN
                </span>
              </li>
            ))}
          </ul>
        </Window>
      )}

      <p className="text-[12px]">
        <Link href="/home" className="underline">
          🏠 マイホームで 模様替えする
        </Link>
        ／
        <Link href="/genba" className="underline">
          💼 げんばで稼ぐ
        </Link>
      </p>
    </div>
  );
}
