import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 左下の開発用ルートインジケータ（"Rendering"等）を非表示に。
  // AIの応答待ちは自前の中央オーバーレイ（SendingOverlay）で示すため紛らわしさを避ける。
  devIndicators: false,
};

export default nextConfig;
