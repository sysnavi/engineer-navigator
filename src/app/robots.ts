import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// robots.txt（Issue #14）。公開して良いのはランディングと公開プロフィールだけ。
// 認証必須の画面は未ログインだと /welcome にリダイレクトされるが、クロール予算を
// 無駄にしないよう明示的に Disallow する。
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/welcome", "/u/", "/q/"],
      disallow: [
        "/api/",
        "/join/", // 招待トークンURL（秘匿）
        "/mypage",
        "/report",
        "/skills",
        "/resume",
        "/mentor",
        "/plan",
        "/roleplay",
        "/yomoyama",
        "/discover",
        "/home",
        "/dungeon",
        "/quiz",
        "/admin",
        "/contact",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
