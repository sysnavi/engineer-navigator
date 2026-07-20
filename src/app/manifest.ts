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
    // アイコンは scripts/gen-icons.py で生成した静的PNG（ドット絵なので
    // 動的生成のアンチエイリアスを避け、1ドット=整数ピクセルで書き出している）
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
