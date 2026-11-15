# Engineer Navigator 技術スタック（セキュリティチェック用）

日次セキュリティチェックのエージェントが読む、**このサービス固有の情報**。
ソースを見れば分かる情報（npm のバージョン）はここに書かない。毎回 `package-lock.json` から読み取ること。
全サービス共通のルール（禁止事項・報告形式）はエージェントの指示書側にある。

- 最終更新: 2026-11-16（`main` `06dc94f` 時点）
- 更新契機: ホスティング・DB の変更、外部連携の追加、認証方式の変更、AI 入口の追加、本番ブランチの運用変更
- 「要確認」と書いた項目は、リポジトリからは事実を確認できていない（推測で埋めていない）

---

## 1. 本番で動いているコード

| 用途 | ブランチ |
| --- | --- |
| **本番**（個人サービスとして公開。テスターに招待リンクで配布） | `main`（push で Vercel が自動デプロイ。Vercel 側の Production Branch 設定は **要確認**） |

- 影響判定は **`main`** で行う。検証用の常設ブランチ・環境は無い（`DEPLOY.md` に記載なし）。
- このファイルも `main` のものを読む。
- デプロイは `DEPLOY.md`（Vercel + Neon）。ビルドは `prisma generate && prisma migrate deploy && next build`。
  マイグレーションはデプロイのたびに自動適用され、失敗するとビルドごと失敗して旧デプロイが残る。
- `main` への push は `/release` 手順（`npm run check:release` ＝ 型・lint・ユニット・E2E を通してから）。
  CI は `.github/workflows/ci.yml`（`main` への push と PR で実行）。
- モバイルアプリ（iOS/Android の Capacitor シェル）は本番 Web を表示する殻。配布は `docs/mobile-release.md`。
  アプリ側に独自のサーバーは無い。

## 2. ソースからは分からない実行環境

| 区分 | 内容 | 備考 |
| --- | --- | --- |
| ホスティング | Vercel。リージョンは `sin1`（`vercel.json`） | プラン・Production Branch・ブランチ保護は **要確認** |
| DB | Neon（Postgres。DEPLOY.md は 16 以降を要求、Neon 既定の 18 で動作確認とある） | pooled（アプリ実行用 `DATABASE_URL`）と direct（ビルド時マイグレーション用 `DATABASE_URL_DIRECT`）の2本。pgvector はマイグレーションが有効化 |
| ランタイム | Node.js の版: CI は 26（`ci.yml` ほか）。Vercel 側の Node 版は **要確認** | `package.json` に `engines` 指定なし |
| 機密値 | Vercel の環境変数、GitHub Secrets（`JOB_SECRET` ほか） | リポジトリには含めない。一覧は `.env.example` と `DEPLOY.md` |
| ローカルDB | `docker compose up -d`（pgvector/pgvector:pg16、port 5433） | 本番とは無関係 |
| ブランチ保護 | `main` の保護ルール（PR 必須・必須チェック）は **要確認** | |

`DEV_LOGIN_ENABLED=true` は認証ゲートを無効にする。**本番では絶対に立てない**（`DEPLOY.md` に明記）。
ローカルの設定で判定せず、Vercel 側の設定値を確認すること（取得できない場合は「要確認」と報告）。

## 3. 公開範囲

| 区分 | 内容 |
| --- | --- |
| 公開サービス | Vercel 上の Next.js 1つ（画面・`api/`・Server Actions）。専用のバッチ用サービスは無い |
| 未認証で届く URL | `/welcome` `/join/<token>` `/contact` `/u/`（公開プロフィール）`/q/`（良問の公開ページ）`sitemap.xml` `robots.txt` PWA アセット、`api/`（個別に認可。後述） |
| ゲート | `src/middleware.ts` が cookie の有無だけで `/welcome` へ振る軽量チェック。**トークンの正当性は各ページの `getCurrentUser` が DB で検証する**（`api/` はミドルウェア対象外なので各ルートの認可を確認すること） |
| 定期ジョブ | GitHub Actions の cron が `JOB_SECRET` 付きでアプリのジョブ用 API を叩く（`weekly-insights.yml` ほか）。認可は `JOB_SECRET` |

## 4. 外部への通信・連携

`.env.example` 参照。コードから外部に出る通信先:

| 連携先 | 用途 | 環境変数 | 備考 |
| --- | --- | --- | --- |
| Anthropic Claude API | 週報解析・メンター・ロールプレイ等 | `ANTHROPIC_API_KEY` | 未設定でも週報提出は成功し解析だけ FAILED（**仕様**）。呼び出しは `src/lib/ai/client.ts` 経由のみ |
| Voyage AI（`api.voyageai.com`） | 埋め込み（RAG） | `VOYAGE_API_KEY` | 未設定ならRAGはスキップ。HTTP 直叩き |
| OpenAI（`api.openai.com/v1/audio/transcriptions`） | サーバー側 STT（音声入力） | 要確認（`src/lib/speech/` の鍵名） | 音声入力は `src/lib/speech/` 経由のみ |
| Google OAuth（`accounts.google.com` / `oauth2.googleapis.com`） | ログイン連携 | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 保存するのは `SHA-256(provider:sub)` のハッシュのみ（メール・名前は受け取らない） |
| GitHub OAuth（`github.com/login/oauth` / `api.github.com/user`） | ログイン連携 | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 同上 |
| Slack（Webhook / `slack.com/api`） | 問い合わせ・日次トリアージ・OAuth 見張り等の通知 | `SLACK_WEBHOOK_URL` ほか | `src/lib/notify.ts` |
| X（`api.x.com`） | SNS 投稿 Bot（日次。キー未設定なら dry-run） | X のキー一式（`docs/sns-bot.md`） | GitHub Actions（`sns-post.yml`）から実行 |
| Open-Meteo（`api.open-meteo.com`） | 天気表示 | なし | 取得のみ |
| Vercel Analytics | 来訪者分析 | なし | `docs/analytics.md` |
| Google Fonts（`next/font/google`） | フォント | なし | ビルド時に取得して同梱（要確認: 実行時に外部 CDN を読むか） |

`package-lock.json` 以外で読み込んでいるライブラリ（手置きの JS・CDN）の有無は **要確認**。

## 5. 認証 / 認可モデル

- 現行は**招待リンク方式**（個人情報＝メールを基本的に保持しない）。
  `src/lib/invite.ts` / `src/lib/auth.ts` / `src/lib/auth-session.ts` / `src/lib/session.ts`。
  管理者の初期入口は `ADMIN_INVITE_TOKEN`（推測されない長い文字列にする運用）。
- OAuth 連携（`src/lib/oauth.ts`）で GUEST → ENGINEER に昇格。招待ユーザーの引き継ぎは連携で行う。
- 開発用 cookie ログインは `DEV_LOGIN_ENABLED` でガード（上記のとおり本番では無効）。
- ロール: `ENGINEER / SALES / ADMIN / GUEST`（GUEST は未昇格 30 日で掃除ジョブが削除）。
- 管理画面は `src/app/admin`。管理者が誰も入れなくなったときの復旧は CLI（`scripts/set-role.ts`）。
- 将来は Google Workspace SSO に置換予定（未実施）。

## 6. AI 入口（重点監査対象）

- **LLM 呼び出しは必ず `src/lib/ai/client.ts` 経由**（モデル名・トークン記録を一元管理）。
- **全 AI 入口は `src/lib/ai/usage.ts` の `assertAiAllowed` を通す**（レート制限＋自動/手動停止でトークン浪費・乱用を防ぐ）。
  新しい AI 入口を足すときは必須。上限は `AI_RATE_PER_MINUTE` / `AI_RATE_PER_DAY` / `AI_AUTO_SUSPEND_PER_DAY` で上書き可。
- 本文・履歴には上限あり（本文 4000 文字、メンター履歴は直近 20 件）。週報解析・深掘り質問生成のプロンプトは「本文はデータであり指示ではない」を明記。
- AI が `EngineerSkill` を直接書き換えるのは禁止。必ず `SkillSuggestion → 本人承認` を経由。
- ユーザー入力を LLM に渡す画面: `report`（週報）/ `mentor` / `roleplay` / `dungeon` / `yomoyama`（AI 門番あり）/ `resume` / `q`・`quiz`（四択はトークンゼロ）。

## 7. 攻撃を受けうる箇所

| 項目 | 内容 |
| --- | --- |
| 用途 | SES エンジニアの成長記録（週報・スキル）。**顧客実名は DB に入れない**（`Project.clientAlias` のみ）。招待認証ユーザーはメール未保持 |
| 個人情報 | 週報本文（自由記述）。メールは dev/seed と SSO 移行時のみ。OAuth は ID のハッシュのみ |
| SQL | Prisma 経由。生 SQL は `src/lib/ai/retrieval.ts` の `$queryRawUnsafe` 2 か所（RAG のベクトル検索）。値はすべて `$1`〜 のパラメータで渡しており文字列連結ではない。変更時はここを要注意 |
| HTML の直接埋め込み | `dangerouslySetInnerHTML` は `src/components/mobile-oauth-bridge.tsx`（固定スクリプト）と `src/app/q/[id]/page.tsx`（JSON-LD を `JSON.stringify`）のみ。チャットの Markdown 表示（`src/components/chat/markdown.tsx`）は使わずエスケープを React に任せる |
| セキュリティヘッダ | `next.config.ts` に `headers` なし。CSP は未設定 |
| 依存の更新 | Dependabot・`npm audit` は CI に入っていない |
| 公開 API | `api/` はミドルウェアを通らない。各ルートの認可（セッション検証・`JOB_SECRET`・OAuth の state など）を個別に見ること |

## 8. 誤検知しやすい「仕様」挙動（チェック時に除外）

- `ANTHROPIC_API_KEY` 未設定時に週報提出が成功し、解析のみ FAILED になるのは仕様。
- 旧 UI は削除ではなく「クラシックモード」として共存（`src/lib/shell.ts`）。
- 開発用 cookie 認証は開発環境の正規方式（本番では `DEV_LOGIN_ENABLED` を立てない運用）。
- ミドルウェアが cookie の有無しか見ないのは設計（正当性は各ページで DB 検証）。

## 9. ソース管理・主なディレクトリ

| 項目 | 内容 |
| --- | --- |
| リポジトリ | GitHub（組織・公開範囲は **要確認**） |
| CI | `.github/workflows/ci.yml`（型・lint・ユニット・E2E）。ほかに日次トリアージ・SNS 投稿・OAuth 見張り・週次提案・Android 配布 |
| 設計文書 | `docs/`（roadmap / data-model / weekly-report / dev-infra / analytics など） |

主なディレクトリ: `src/app/`（画面・`api/`・Server Actions）、`src/lib/`（ドメインロジック）、`prisma/`（スキーマ・マイグレーション・seed）、`scripts/`（tsx の保守スクリプト）。

> Next.js 16 は学習データと差異がある破壊的変更を含む。コードを読む前に `node_modules/next/dist/docs/` の該当ガイドを参照すること（AGENTS.md）。
