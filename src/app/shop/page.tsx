// おかいもの（SHOP.cat）: げんばで稼いだENの使い道（かせぐ→おかいものの循環を閉じる竹版最小SHOP）。
// 商品はマイホームのかざり棚に並ぶ家具・置物12種。マスタは src/lib/shop/content.ts。

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SHOP_ITEMS } from "@/lib/shop/content";
import { PixelLabel, Window } from "@/components/retro";
import { ShopSprite } from "@/components/shop-sprite";
import { ActionForm } from "@/components/toast";
import { buyItem } from "./actions";

export const metadata = {
  title: "おかいもの — Engineer Navigator",
  description: "げんばで稼いだENで、マイホームの家具をそろえよう。",
};

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1>
        <PixelLabel>SHOP — おかいもの</PixelLabel>
      </h1>

      <Window title="SHOP" titleEm=".cat">
        <div className="flex items-center justify-between">
          <p className="text-[13px]">
            げんばで稼いだENで、マイホームの家具をそろえよう。
            <br />
            <span className="text-[11px] opacity-70">
              買った家具はマイホームのかざり棚に並びます。
            </span>
          </p>
          <span className="font-pixel shrink-0 border-2 border-[var(--ink)] bg-[var(--lemon)] px-2 py-[2px] text-[13px] tabular-nums">
            {balance.toLocaleString()} <em className="not-italic text-[10px]">EN</em>
          </span>
        </div>
      </Window>

      <div className="grid gap-3 sm:grid-cols-2">
        {SHOP_ITEMS.map((item) => {
          const owned = ownedIds.has(item.id);
          const affordable = balance >= item.price;
          return (
            <Window key={item.id} title={item.name} titleEm=".itm" bodyClass="p-4">
              <div className="flex items-start gap-3">
                <span className="shrink-0 border-2 border-[var(--line8,#ccc)] bg-white/50 p-1.5 dark:bg-white/10">
                  <ShopSprite id={item.id} px={4} label={item.name} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] leading-snug opacity-80">{item.desc}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-pixel text-[12.5px] tabular-nums">
                      {item.price.toLocaleString()} EN
                    </span>
                    {owned ? (
                      <span className="text-[11px] font-bold text-[var(--good,#2e9e5b)]">
                        ✔ かざってあります
                      </span>
                    ) : (
                      <ActionForm
                        ok={`${item.name} をかいました！`}
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
            </Window>
          );
        })}
      </div>

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
          🏠 マイホームで かざり棚を見る
        </Link>
        ／
        <Link href="/genba" className="underline">
          💼 げんばで稼ぐ
        </Link>
      </p>
    </div>
  );
}
