<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Engineer Navigator 開発ガイド

SESエンジニアの成長をデータ化するアプリ。構想・設計は docs/ を必ず読むこと:
- docs/roadmap.md — フェーズ計画（何をどの順で作るか）
- docs/weekly-report.md — 週報テンプレの設計思想（フォームを変える前に読む）
- docs/data-model.md — スキーマの設計判断（AI提案→本人承認フローは構造で強制）
- docs/dev-infra.md — 開発・テスト・リリース基盤の図解（E2EのDB分離・CIの構成）
- docs/bug-triage.md — 日次バグトリアージ（機能ツアー→Slack報告→軽微なら自動修正PR）
- docs/analytics.md — 来訪者分析（サーバー側イベント・ゲスト→登録ファネル・/admin/analytics・Vercel Analytics・Looker Studio・OAuth登録の見張り）
- docs/sns-bot.md — SNS投稿Bot（日次でゲーム画面を遊んで撮り、画像でXに投稿。控えはSlack）
- docs/ops/staging.md — テスト環境（staging）の作り方。ビルドの migrate deploy が本番DBに流れないための Vercel/Neon の分け方
- docs/ops/account-migration.md — 会社アカウント→個人アカウントの差し替え手順（環境変数の一覧・OAuth の作り直し・順番と戻し方）。値は書かない
- docs/design/sprite-stack-plan.md — キャラ・おさんぽ・ダンジョンの3D化（スプライトスタッキング・8方向・素材は MagicaVoxel の .vox）。段階と決定事項
- docs/design/myhome-3d-plan.md — マイホームの 3D 箱庭（リビング）。広さ・見せ方・2D との共通データ（家具の % ⇔ 部屋の座標）

## スタック
Next.js 16 (App Router / Server Actions) + Prisma 7 + PostgreSQL 16 (pgvector, port 5433) + Claude API

## 開発コマンド
```bash
docker compose up -d      # DB起動（port 5433）
npx prisma migrate dev    # マイグレーション
npx prisma db seed        # スキルマスタ・デモユーザー投入
npm run dev               # http://localhost:3000
npm run check             # 型 + lint + ユニットテスト。コード変更後は必ず通すこと
npm run test:e2e          # E2Eスモーク（Playwright）。DB起動が前提
npm run check:release     # check + E2E。リリース（mainへのpush）前に必ず通すこと
npm run test:tour         # 機能ツアー（全画面一周・日次トリアージの検出部）。TOUR_ONLY=<id> で1本だけ
npm run sns:capture       # SNS投稿用の「今日の1枚」を撮る（docs/sns-bot.md）。SNS_SCENE=<id> でシーン固定
npm run sns:post          # 撮った1枚をXに投稿（キー未設定ならdry-run）
```

## Skills（.claude/skills/・コミット対象）
- /feature — 依頼→実装→検証→コミットの標準手順。コード変更タスクはこれ経由
- /release — mainへのpush（=本番リリース）とCI見届け。push作業はこれ経由
- /mobile-release — iOS/Androidアプリ（シェル）の再配布。要否判定→リリースノート→配布→タグ。アプリ配布はこれ経由
- /bug-triage — 日次バグトリアージ（docs/bug-triage.md）。機能ツアーの不備を「軽微なら修正PR / 他は診断」に振り分けSlackへ。CIが毎朝自動実行

## テストの決まりごと
- ユニットテストは `src/**/*.test.ts` に併置。DBに触らない純ロジックのみ（vitest.config.ts）
- E2Eは tests/e2e/。専用DB `engineer_navigator_e2e` を毎回リセットして使う（開発DBには触らない）
- E2Eは ANTHROPIC_API_KEY を空にして実行する（AI解析はFAILEDになるが提出は成功する仕様を利用。実APIは呼ばない）

## 決まりごと
- LLM呼び出しは必ず src/lib/ai/client.ts 経由（モデル名・トークン記録を一元管理）
- 音声入力・読み上げは必ず src/lib/speech/ 経由（native/web/サーバーSTTのエンジン切替を一元管理。
  WKWebViewはWeb Speech APIが「存在するのに動かない」ため直接触らない）
- AIがEngineerSkillを直接書き換えるのは禁止。必ずSkillSuggestion → 本人承認を経由
- 顧客実名をDBに入れない（Project.clientAlias のみ）
- 認証は開発用cookie方式（src/lib/auth.ts）。本番はGoogle Workspace SSOに置換予定
- ANTHROPIC_API_KEY が未設定でも週報提出は成功し、解析だけ FAILED になる（この挙動は仕様）
- キャラの3D表示は src/lib/stack/（純ロジック）と src/components/stack-sprite.tsx 経由。原本は public/**/vox/*.vox（MagicaVoxel で直す）。
  線の色・傾き・層の厚みは src/lib/stack/style.ts の STACK_STYLE だけで変える。撮影で止めるときは ?nospin か window.__STACK_STATIC__
