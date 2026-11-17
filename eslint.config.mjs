import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 方針: 指摘や事故から学んだことは、CLAUDE.md に文章で足すより先にここへルールとして落とす。
// エージェントは既存コードのパターンを真似るので、機械で止められるものは機械で止める。

// ─── ラチェット（既存の負債だけを一時的に警告へ下げる） ───────────────────
// 導入時点（2026-11-17）で違反が残っていたファイル。パスは glob なので [ ] は \\ でエスケープする。
// 新しいファイルでは error のまま。
// この一覧は「減らす方向にだけ動かす」。直したら外す。ファイルを足すのは禁止。

// react-hooks/exhaustive-deps を eslint-disable で黙らせているファイル
const LEGACY_HOOKS_DISABLE_FILES = [
  "src/app/dungeon/dive-player.tsx",
  "src/app/mentor/\\[id\\]/chat.tsx",
  "src/app/report/voice-interview.tsx",
  "src/components/inquiry-thread.tsx",
];

// コンポーネント内で生の setTimeout を使っているファイル（共通フック useTimeout へ移す）
const LEGACY_SET_TIMEOUT_FILES = [
  "src/app/dungeon/dive-player.tsx",
  "src/app/home/desktop-scene.tsx",
  "src/app/home/living-scene.tsx",
  "src/app/mentor/\\[id\\]/chat.tsx",
  "src/app/mypage/inherit-panel.tsx",
  "src/app/report/report-form.tsx",
  "src/app/walk/bgm-player.tsx",
  "src/app/walk/walk-scene.tsx",
  "src/components/inquiry-thread.tsx",
  "src/components/mic-button.tsx",
  "src/components/pets/visitor.tsx",
  "src/components/tips-toast.tsx",
  "src/components/toast.tsx",
];

// ─── 自前ルール ─────────────────────────────────────────────────────────
// eslint-disable コメントで止めてはいけないルール。依存配列の抜けは古い値を掴むバグになる。
// 本当に外したいなら、useRef や useEffectEvent で依存を外す形に書き直す。
const PROTECTED_RULES = ["react-hooks/exhaustive-deps"];

const localPlugin = {
  rules: {
    "no-disable-protected-rules": {
      meta: {
        type: "problem",
        messages: {
          forbidden:
            "{{rule}} を eslint-disable で無効化しないでください。依存配列の抜けは古い値を掴むバグになります。useRef / useEffectEvent で依存から外す形に書き直してください。",
        },
        schema: [],
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              const m = /^\s*eslint-disable(?:-next-line|-line)?(?:\s+([^]*?))?(?:\s+--[^]*)?$/.exec(comment.value);
              if (!m) continue;
              const listed = (m[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
              // ルール名なしの eslint-disable は全ルールを止めるので、保護ルールも止めている扱い
              const hits = listed.length === 0 ? PROTECTED_RULES : listed.filter((r) => PROTECTED_RULES.includes(r));
              for (const rule of hits) {
                context.report({ loc: comment.loc, messageId: "forbidden", data: { rule } });
              }
            }
          },
        };
      },
    },
  },
};

const RAW_SET_TIMEOUT = [
  {
    selector: "CallExpression[callee.name='setTimeout']",
    message:
      "コンポーネントで生の setTimeout を使わず、src/lib/hooks/use-timeout.ts の useTimeout().schedule を使ってください。アンマウント時に自動で解除されます。",
  },
  {
    selector: "CallExpression[callee.object.name='window'][callee.property.name='setTimeout']",
    message:
      "コンポーネントで生の window.setTimeout を使わず、src/lib/hooks/use-timeout.ts の useTimeout().schedule を使ってください。アンマウント時に自動で解除されます。",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { local: localPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // 型エラーをコメントで黙らせない。どうしても必要なら理由付きの @ts-expect-error のみ
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-nocheck": true, "ts-expect-error": "allow-with-description" },
      ],
      "local/no-disable-protected-rules": "error",
    },
  },
  {
    // 画面層（app / components）だけが対象。lib の非React処理（音声認識など）は対象外
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...RAW_SET_TIMEOUT],
    },
  },
  {
    files: LEGACY_HOOKS_DISABLE_FILES,
    rules: { "local/no-disable-protected-rules": "warn" },
  },
  {
    files: LEGACY_SET_TIMEOUT_FILES,
    rules: { "no-restricted-syntax": ["warn", ...RAW_SET_TIMEOUT] },
  },
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
