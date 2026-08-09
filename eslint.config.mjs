import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**", // E2E用の分離ビルドディレクトリ（next.config.ts参照）
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwrightの成果物
    "test-results/**",
    "playwright-report/**",
    // Capacitorシェル（独立プロジェクト・ネイティブ生成物を含む）
    "mobile/**",
  ]),
]);

export default eslintConfig;
