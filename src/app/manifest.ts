import type { MetadataRoute } from "next";

// PWA マニフェスト（ホーム画面に追加してアプリのように使える）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Engineer Navigator",
    short_name: "EngNavi",
    description: "週報からスキルと成長をデータ化する、エンジニアの成長OS",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#d7e7f4",
    theme_color: "#004aad",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
