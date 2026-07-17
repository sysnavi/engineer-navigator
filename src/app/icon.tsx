import { ImageResponse } from "next/og";
import { iconElement } from "@/lib/icon-art";

// ブラウザタブのファビコン（Next の app/icon 規約）
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(iconElement(64), { ...size });
}
