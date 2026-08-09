import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 左下の開発用ルートインジケータ（"Rendering"等）を非表示に。
  // AIの応答待ちは自前の中央オーバーレイ（SendingOverlay）で示すため紛らわしさを避ける。
  devIndicators: false,
  // Next 16 は同一 distDir での多重 dev 起動をロックで拒否するため、
  // E2E（ポート3111・playwright.config.ts が NEXT_DIST_DIR=.next-e2e を設定）が
  // 開発サーバー（3000・.next）と同時に動けるようビルドディレクトリを分離する
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
