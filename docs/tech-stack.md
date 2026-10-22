# 技術スタック / セキュリティチェック用サマリ

日次セキュリティチェック（別エージェント）が参照するための、技術スタックと
セキュリティ上の要所をまとめたファイル。構成を変えたら必ずここも更新する。

- 対象: Engineer Navigator（SESエンジニアの成長をデータ化するアプリ）
- 最終更新: 2026-10-23

---

## スタック

| 層 | 採用技術 | バージョン |
|----|----------|-----------|
| フレームワーク | Next.js (App Router / Server Actions) | 16.2.10 |
| UI | React / React DOM | 19.2.4 |
| 言語 | TypeScript | ^5 |
| ORM | Prisma（`@prisma/adapter-pg` 経由でpg接続） | ^7.8.0 |
| DB | PostgreSQL + pgvector | pg16（ローカルは port 5433） |
| バリデーション | zod | ^4.4.3 |
| スタイル | Tailwind CSS (+ @tailwindcss/postcss) | ^4 |
| LLM | Anthropic SDK（Claude API） | @anthropic-ai/sdk ^0.111.0 |
| 埋め込み | Voyage AI（RAG用、`VOYAGE_API_KEY`） | HTTP直叩き |
| PDF | pdfmake | ^0.3.11 |
| スクリプト実行 | tsx | ^4.23.0 |
| Lint | ESLint + eslint-config-next | ^9 / 16.2.10 |

> Next.js 16 は学習データと差異がある破壊的変更を含む。コードを読む前に
> `node_modules/next/dist/docs/` の該当ガイドを参照すること（AGENTS.md）。

## デプロイ / 実行環境

- 本番: Vercel（region: `sin1`）+ Neon（Postgres）。設定は `DEPLOY.md`。
- ビルド: `prisma generate && prisma migrate deploy && next build`
- ローカルDB: `docker compose up -d`（pgvector/pgvector:pg16, port 5433）

## 外部通信 / シークレット

`.env.example` 参照。コードから外部に出る通信先:

| 環境変数 | 用途 | 備考 |
|----------|------|------|
| `DATABASE_URL` | Postgres接続 | 本番はNeon |
| `ANTHROPIC_API_KEY` | Claude API | 未設定でも週報提出は成功し解析だけFAILED（**仕様**） |
| `VOYAGE_API_KEY` | Voyage埋め込み（RAG） | |
| `SLACK_WEBHOOK_URL` | 問い合わせ等の通知（`src/lib/notify.ts`） | |
| `DEV_LOGIN_ENABLED` | 開発用cookieログインの有効化 | **本番では絶対に立てない** |
| `ADMIN_INVITE_TOKEN` | 管理者招待トークン | |
| `JOB_SECRET` | バッチ/cronジョブの認可 | |
| `APP_URL` / site-url | 招待リンク等の絶対URL生成 | |

## 認証 / 認可モデル

- 現行は**招待リンク方式**（個人情報＝メールを基本的に保持しない方針）。
  `src/lib/invite.ts` / `src/lib/auth.ts` / `src/lib/auth-session.ts` / `src/lib/session.ts`。
- OAuth連携（`src/lib/oauth.ts`）で GUEST → ENGINEER 昇格。本番はGoogle Workspace SSOへ置換予定。
- 開発用cookieログインは `DEV_LOGIN_ENABLED` でガード。
- ロール: `ENGINEER / SALES / ADMIN / GUEST`（GUESTは未昇格30日で掃除ジョブが削除）。
- 管理画面は `src/app/admin`。

## AI入口（重点監査対象）

- **LLM呼び出しは必ず `src/lib/ai/client.ts` 経由**（モデル名・トークン記録を一元管理）。
- **全AI入口は `src/lib/ai/usage.ts` の `assertAiAllowed` を通す**
  （レート制限＋停止でトークン浪費・乱用を防ぐ）。新しいAI入口を足すときは必須。
- AIが `EngineerSkill` を直接書き換えるのは禁止。必ず `SkillSuggestion → 本人承認` を経由。
- ユーザー入力をLLMに渡す画面: `report`（週報）/ `mentor` / `roleplay` /
  `dungeon` / `yomoyama`（AI門番あり）/ `resume` / `q`・`quiz`（四択はトークンゼロ）。

## データ / プライバシー方針

- **顧客実名をDBに入れない**（`Project.clientAlias` のみ）。
- 招待認証ユーザーはメール未保持（`User.email` は dev/seed と SSO移行時のみ）。
- スキーマは `prisma/schema.prisma`、設計判断は `docs/data-model.md`。

## 誤検知しやすい「仕様」挙動（チェック時に除外）

- `ANTHROPIC_API_KEY` 未設定時に週報提出が成功し、解析のみ FAILED になるのは仕様。
- 旧UIは削除ではなく「クラシックモード」として共存（`src/lib/shell.ts`）。
- 開発用cookie認証は現段階の正規方式（本番SSO置換は予定）。

## 主なディレクトリ

- `src/app/` — ルート（画面・`api/`・Server Actions）
- `src/lib/` — ドメインロジック（`ai/`, `auth*`, `usage.ts`, `oauth.ts` など）
- `prisma/` — スキーマ・マイグレーション・seed
- `scripts/` — 取り込み/メンテ用スクリプト（tsx。dotenvは `@/lib/db` より先に読む）
- `docs/` — roadmap / data-model / weekly-report / handoff / design
