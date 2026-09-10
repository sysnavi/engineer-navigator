import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_PORT } from "./tests/e2e/env";

// 日次バグトリアージ用「機能ツアー」の設定（docs/bug-triage.md）。
// E2Eスモーク（playwright.config.ts）と同じ使い捨てDB・同じポートを使うが、
//  - 全画面をロールごとに一周する（スモークは主要導線5本だけ）
//  - 成功時もキャプチャを残す（修正後の「改善キャプチャ」に使う）
//  - JSON レポートを tour-results/ に出し、scripts/triage/report.ts が Slack に流す
//  - 一過性の失敗で騒がないよう 1 回リトライする
// E2E と同時には起動しないこと（ポート・distDir を共有している）。

export default defineConfig({
  testDir: "tests/tour",
  // coverage.test.ts（vitest の網羅ガード）を Playwright が拾わないよう spec だけに限定
  testMatch: /\.spec\.ts$/,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  outputDir: "tour-results/artifacts",
  reporter: [["list"], ["json", { outputFile: "tour-results/report.json" }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "ja-JP",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      grep: /@mobile/,
      use: { ...devices["iPhone 14"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: `npx tsx tests/e2e/prepare-db.ts && npx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/welcome`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: E2E_DATABASE_URL,
      DATABASE_URL_DIRECT: E2E_DATABASE_URL,
      DEV_LOGIN_ENABLED: "true",
      UI_SHELL_DEFAULT: "classic",
      ANTHROPIC_API_KEY: "",
      VOYAGE_API_KEY: "",
      SLACK_WEBHOOK_URL: "",
    },
  },
});
