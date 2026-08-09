import { defineConfig } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_PORT } from "./tests/e2e/env";

// E2Eスモーク。専用DB + 専用ポートで動かすので、開発中の
// `npm run dev`（3000番・開発DB）と同時に実行してよい。
//
// - DEV_LOGIN_ENABLED=true: cookieなしでデモユーザー(engineer@sysnavi.co.jp)として入る
// - ANTHROPIC_API_KEY="": AI解析は即FAILEDになる（提出は成功する仕様。AGENTS.md参照）。
//   実APIを呼ばないので決定的・無料で回せる
// - UI_SHELL_DEFAULT=classic: ホームの表示分岐を固定（env差でテストが割れないように）

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // 全テストが同じデモユーザーのDB状態を共有するため直列実行
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    locale: "ja-JP",
  },
  webServer: {
    // DB準備（作成+リセット+seed）→ サーバー起動。webServerはglobalSetupより
    // 先に走るので、この順序でDBの存在を保証する
    command: `npx tsx tests/e2e/prepare-db.ts && npx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/welcome`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
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
