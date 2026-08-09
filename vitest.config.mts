import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // db.ts が import 時にクライアントを組み立てるためのダミー（接続はしない）。
      // ユニットテストは純ロジックのみ対象で、DBに触るテストはE2E側の責務。
      DATABASE_URL: "postgresql://unit:unit@localhost:1/unit_test_dummy",
    },
  },
});
