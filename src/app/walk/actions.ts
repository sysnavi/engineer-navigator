"use server";

// おさんぽ（散歩）のAI特別つぶやき（ハイブリッド層）。
//
// ふだんのつぶやきはクライアントのセリフ辞書（トークン0）。それに加えて1回の散歩に1回だけ、
// AIが「うちの子の人格 × きみのいまのコンディション × 天気/時刻」を汲んだ特別な一言を返す。
//
// 【fail-open】散歩は“眺めるだけ”の演出。上限到達・ゲスト・APIキー無し・失敗のいずれでも
// 例外を投げず null を返す（クライアントは黙って辞書のつぶやきを続ける）。エラーは出さない。
//
// 【プライバシー】クライアントからは天気/時刻の bucket しか受け取らない（座標は渡ってこない）。
// コンディションはサーバー側で本人のDBから引く（本人以外には出さない原則を維持）。

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { speciesById } from "@/lib/pets/species";
import { getConditionSeries } from "@/lib/condition";
import { assertAiAllowed } from "@/lib/usage";
import { completeJson } from "@/lib/ai/client";
import {
  moodBucket,
  loadBucket,
  type TimeBucket,
  type WeatherBucket,
  type MoodBucket,
  type LoadBucket,
} from "@/lib/walk/mutter";
import { BIOME_JA, type BiomeId } from "@/lib/walk/world";
import { walkItemById } from "@/lib/walk/items";

const TIME_JA: Record<TimeBucket, string> = {
  morning: "朝",
  noon: "昼",
  evening: "夕方",
  night: "夜",
};
const WEATHER_JA: Record<WeatherBucket, string> = {
  clear: "晴れ",
  cloudy: "くもり",
  rain: "雨",
  snow: "雪",
  fog: "霧",
  storm: "雷雨",
};
// mood/load は「弱っているときだけ」やさしく踏み込む。unknown/good のときは触れない。
const MOOD_JA: Partial<Record<MoodBucket, string>> = {
  low: "最近ちょっと元気がなさそう",
  good: "最近わりと調子が良さそう",
};
const LOAD_JA: Partial<Record<LoadBucket, string>> = {
  busy: "最近忙しそう",
  limit: "最近かなり忙しくて限界が近そう",
};

/**
 * AIの特別つぶやきを1つ返す。呼べない/失敗したときは null（呼び出し側は辞書で継続）。
 * time/weather はクライアントの bucket をそのまま受ける。コンディションはサーバーで引く。
 */
export async function walkAiMutter(input: {
  petId: string;
  time: TimeBucket;
  weather: WeatherBucket;
  /** 歩いている場所（BiomeId）。不正値は無視する */
  biome?: string;
}): Promise<{ reply: string } | null> {
  try {
    const user = await getCurrentUser();

    // ゲスト・停止・上限は AiBlockedError。ここでは黙って辞書に任せる
    try {
      await assertAiAllowed(user.id, "walk-mutter");
    } catch {
      return null;
    }

    const pet = await prisma.pet.findUnique({ where: { id: input.petId } });
    if (!pet || pet.userId !== user.id) return null;
    const species = speciesById(pet.speciesId);
    if (!species) return null;

    const latest = (await getConditionSeries(user.id, 4)).at(-1);
    const mood = moodBucket(latest?.score);
    const load = loadBucket(latest?.workloadSelf);

    // 触れてよい範囲だけを言葉にする（good/unknown の気分には踏み込まない）
    const careHints = [MOOD_JA[mood], LOAD_JA[load]].filter(Boolean);
    const biomeJa =
      input.biome && input.biome in BIOME_JA ? BIOME_JA[input.biome as BiomeId] : null;
    const situation = [
      `いまは${TIME_JA[input.time]}、天気は${WEATHER_JA[input.weather]}。`,
      `いっしょに${biomeJa ? `${biomeJa}を` : ""}散歩している。なつき度は${pet.affection}。`,
      careHints.length > 0
        ? `飼い主の様子: ${careHints.join("・")}。`
        : "飼い主の様子については特に情報がない。",
    ].join("\n");

    const { data } = await completeJson<{ reply: string }>({
      system: [
        `あなたは8bitの世界のペット「${pet.name}」。人格: ${species.aiPersona}`,
        "飼い主とのんびり散歩しながら、ふと ひとことだけ つぶやく。",
        "1文だけ・25文字以内・ひらがな多め・やさしく。説教くさくしない。",
        "飼い主が疲れ気味・元気がないなら、さりげなく気づかう（重くしない）。",
        "元気そう/情報がないなら、天気や景色の何気ないひとことでよい。",
        "医療・診断めいた助言はしない。ただ寄り添う。",
        'JSONで {"reply": "つぶやき"} だけを返す。',
      ].join("\n"),
      user: situation,
      maxTokens: 120,
    });

    const reply = String(data?.reply ?? "").trim();
    if (!reply) return null;
    return { reply: reply.slice(0, 60) };
  } catch (e) {
    console.error("walkAiMutter failed:", e);
    return null;
  }
}

/**
 * おさんぽ中に拾ったカギアイテムを付与する。すでに持っていたら isNew: false。
 * 【fail-open】散歩を止めないため、失敗はぜんぶ null（クライアントは黙って続行）。
 */
export async function collectWalkItem(
  itemId: string
): Promise<{ isNew: boolean; name: string; getLine: string } | null> {
  try {
    const def = walkItemById(itemId);
    if (!def) return null;
    const user = await getCurrentUser();
    try {
      await prisma.walkItem.create({ data: { userId: user.id, itemId: def.id } });
      return { isNew: true, name: def.name, getLine: def.getLine };
    } catch {
      // ユニーク制約違反 = 取得済み
      return { isNew: false, name: def.name, getLine: def.getLine };
    }
  } catch (e) {
    console.error("collectWalkItem failed:", e);
    return null;
  }
}
