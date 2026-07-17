import { ImageResponse } from "next/og";
import { iconElement } from "@/lib/icon-art";

// PWAマニフェスト用 512x512 アイコン（any / maskable 兼用）
export function GET() {
  return new ImageResponse(iconElement(512), { width: 512, height: 512 });
}
