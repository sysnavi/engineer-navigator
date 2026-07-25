import type { MetadataRoute } from "next";
import { listPublicProfiles } from "@/lib/public-profile";
import { siteUrl } from "@/lib/site-url";

// sitemap.xml（Issue #14）。ランディング＋全公開プロフィール（/u/<handle>）を列挙。
// UGC×SEOの複利構造の入口: 公開プロフィールが増えるほどURLが増える。
// ※将来 /q/<id>（公開問題）を作ったらここに足す。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const profiles = await listPublicProfiles();

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
  ];
}
