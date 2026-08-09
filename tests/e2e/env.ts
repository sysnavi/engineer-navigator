// E2E専用のDB接続先。開発DB(engineer_navigator)とは別のDBを使い、
// テスト実行のたびに migrate reset で作り直す（global-setup.ts）。
// 開発DBのデータをE2Eが壊さないための分離なので、ここを開発DBに向けないこと。
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://navi:navi@localhost:5433/engineer_navigator_e2e";

export const E2E_PORT = 3111;
