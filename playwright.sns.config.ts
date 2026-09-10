import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_PORT } from "./tests/e2e/env";

// SNS 投稿用スクリーンショット（docs/sns-bot.md）。
// ツアー（playwright.tour.config.ts）と同じ使い捨てDB・同じポートを使うが、
//  - スマホ1台分の「画面そのまま」を撮る（iPhone 14・3倍解像度・フルページではない）
//  - 1日1シーンだけ動かす（tests/sns/scenes.spec.ts が日付で選ぶ。SNS_SCENE=<id> で固定）
//  - DB準備の後に見栄えする状態を作る（scripts/sns/prepare-showcase.ts）
//  - 出力は sns-results/（画像 + post.json）。scripts/sns/post.ts がこれを投稿する
// E2E・ツアーと同時には起動しないこと（ポート・distDir を共有している）。

export default defineConfig({
  testDir: "tests/sns",
  testMatch: /\.spec\.ts$/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  outputDir: "sns-results/artifacts",
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 14"], browserName: "chromium" } },
  ],
  webServer: {
    command: `npx tsx tests/e2e/prepare-db.ts && npx tsx scripts/sns/prepare-showcase.ts && npx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/welcome`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: E2E_DATABASE_URL,
      DATABASE_URL_DIRECT: E2E_DATABASE_URL,
      DEV_LOGIN_ENABLED: "true",
      UI_SHELL_DEFAULT: "desktop",
      ANTHROPIC_API_KEY: "",
      VOYAGE_API_KEY: "",
      SLACK_WEBHOOK_URL: "",
    },
  },
});
