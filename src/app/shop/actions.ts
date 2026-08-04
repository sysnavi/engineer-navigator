"use server";

// おかいもの（SHOP.cat）の購入アクション。
// お金の増減は Wallet + WalletLog をセットで（げんばの精算と同じ約束）。
// 残高ガードは updateMany の条件付きdecrementで行い、二重購入は Purchase の @@unique が弾く。

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shopItemById, weeklyStock } from "@/lib/shop/content";
import { defaultLivingPosition } from "@/lib/home/living";

export type BuyResult = { ok: true; balance: number } | { ok: false; reason: string };

export async function buyItem(itemId: string): Promise<BuyResult> {
  const user = await getCurrentUser();
  if (user.role === "GUEST") throw new Error("ゲストは おかいもの できません");

  const item = shopItemById(itemId);
  if (!item) throw new Error("そのしょうひんは ありません");

  // 週替わり入荷のチェック（rotatingシリーズは今週の入荷分だけ買える）
  const todayISO = new Date().toISOString().slice(0, 10);
  if (!weeklyStock(todayISO).has(itemId)) {
    return { ok: false, reason: "いまは入荷していません。来週をおたのしみに" };
  }

  const already = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: user.id, itemId } },
  });
  if (already) return { ok: false, reason: "もう持っています" };

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.updateMany({
        where: { userId: user.id, balance: { gte: item.price } },
        data: { balance: { decrement: item.price } },
      });
      if (updated.count === 0) throw new Error("EN_SHORT");
      // 買った家具はその場でLIVINGへ（かう→部屋が変わる、を即体験させる）
      const placedCount = await tx.purchase.count({
        where: { userId: user.id, livingX: { not: null } },
      });
      const topZ = await tx.purchase.aggregate({
        where: { userId: user.id },
        _max: { livingZ: true },
      });
      const pos = defaultLivingPosition(item, placedCount);
      await tx.purchase.create({
        data: {
          userId: user.id,
          itemId,
          price: item.price,
          livingX: pos.x,
          livingY: pos.y,
          livingZ: (topZ._max.livingZ ?? 0) + 1,
        },
      });
      await tx.walletLog.create({
        data: {
          userId: user.id,
          delta: -item.price,
          reason: "shop:purchase",
          refId: itemId,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "EN_SHORT") {
      return { ok: false, reason: "ENが足りません。げんばで稼ごう" };
    }
    // Purchase @@unique 衝突（連打）もここに落ちる
    return { ok: false, reason: "こうにゅうに失敗しました" };
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  revalidatePath("/shop");
  revalidatePath("/home");
  return { ok: true, balance: wallet?.balance ?? 0 };
}
