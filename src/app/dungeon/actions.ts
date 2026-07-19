"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { performDive, type DungeonStep } from "@/lib/dungeon/run";

/** 潜行を実行して確定済み5ステップを返す（クライアントは紙芝居再生するだけ）。
 *  回数制限は slot の @@unique が構造で守る（連打・並行リクエストも安全）。 */
export async function dive(): Promise<{
  steps: DungeonStep[];
  depth: number;
  kind: "daily" | "bonus";
}> {
  const user = await getCurrentUser();
  const result = await performDive(user.id);
  revalidatePath("/dungeon");
  return result;
}
