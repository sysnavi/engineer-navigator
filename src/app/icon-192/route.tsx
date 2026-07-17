import { ImageResponse } from "next/og";
import { iconElement } from "@/lib/icon-art";

// PWAマニフェスト用 192x192 アイコン
export function GET() {
  return new ImageResponse(iconElement(192), { width: 192, height: 192 });
}
