import type { MetadataRoute } from "next";
import { listPublicProfiles } from "@/lib/public-profile";
import { listPublicQuestions } from "@/lib/public-question";
import { siteUrl } from "@/lib/site-url";

// sitemap.xml（Issue #14）。ランディング＋公開プロフィール（/u/<handle>）＋
// 良問（/q/<id>）を列挙。UGC×SEOの複利構造の入口: 公開コンテンツが増えるほど
// URLが増える。問題は「良問」だけ載せる（listPublicQuestionsが質で絞る）。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [profiles, questions] = await Promise.all([
    listPublicProfiles(),
    listPublicQuestions(),
  ]);

  return [
    {
      url: `${base}/welcome`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...profiles
      .filter((p) => p.handle)
      .map((p) => ({
        url: `${base}/u/${p.handle}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...questions.map((q) => ({
      url: `${base}/q/${q.id}`,
      lastModified: q.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
