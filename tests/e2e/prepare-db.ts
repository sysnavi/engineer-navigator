import { execSync } from "node:child_process";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "./env";

// E2E DBの準備: DROP → CREATE → migrate deploy → seed。
// prisma migrate reset は使わない（対話ガードがあり自動実行に向かない）。
// 毎回まっさらなDBを作り直すので、テストはseed直後の状態を常に前提にできる。
//
// Playwrightは webServer を globalSetup より先に起動するため、globalSetupではなく
// webServer.command の先頭でこのスクリプトを実行して順序を保証している。

async function main() {
  const dbName = new URL(E2E_DATABASE_URL).pathname.slice(1);

  // 誤って開発DB・本番DBを消さないための構造的ガード。
  // E2E_DATABASE_URL を差し替えるときも必ず _e2e サフィックスを付けること。
  if (!dbName.endsWith("_e2e")) {
    throw new Error(
      `E2E DB名は "_e2e" で終わる必要があります（削除対象の誤りを防ぐため）: ${dbName}`
    );
  }

  const adminUrl = new URL(E2E_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch (e) {
    throw new Error(
      `E2E用Postgresに接続できません（docker compose up -d でDBを起動してください）: ${e}`
    );
  }
  await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  const env = {
    ...process.env,
    DATABASE_URL: E2E_DATABASE_URL,
    DATABASE_URL_DIRECT: E2E_DATABASE_URL,
  };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  // prisma.config.ts の seed コマンドと同じもの（db seed 経由にしないのは
  // CLIの対話・ガードを挟まず決定的に流すため）
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
