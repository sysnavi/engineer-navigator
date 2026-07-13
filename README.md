# Engineer Navigator

SESエンジニアの「個々の着実な成長」をデータ化し、資格取得とリーダーシップ育成を生成AIで高速化するアプリケーション。

週報を書くだけで、スキルマップ・経歴書が育ち、コンディションの変化が会社に伝わり、AIメンターが次の一歩を提案する — エンジニアの成長サイクルを回す「成長のOS」を目指す。

## 4つのコア機能

| 機能 | 内容 | フェーズ |
|---|---|---|
| 週報 → スキルマップ自動更新 | 週報からAIが習得技術を抽出し、承認ベースでスキルマップ・経歴書を更新。単価交渉のエビデンスを自動蓄積 | Phase 1 |
| コンディション検知アラート | 週報の自己申告 + AIのトーン解析で離職兆候・不調を早期検知し、営業・管理者へアラート | Phase 2 |
| 資格・技術習得のAIメンター | AWS/JSTQB等の資格学習を「現場でどう適用するか」まで踏み込んで24時間指導するAIチャット | Phase 3 |
| 「一歩先の役割」シミュレーター | 顧客調整・障害対応などリーダーの難題をAIとロールプレイし、フィードバックを受けられる学習環境 | Phase 4 |

詳細は [docs/roadmap.md](docs/roadmap.md) を参照。

## 技術スタック

- **Next.js 16** (App Router / Server Actions) — フロント・APIを単一アプリで
- **Prisma 7** + **PostgreSQL 16 (pgvector)** — RAG用ベクトル検索もDBに同居
- **Claude API** (@anthropic-ai/sdk) — スキル抽出・感情解析・メンター・ロールプレイ
- **Tailwind CSS 4**
- デプロイ想定: GCP Cloud Run + Cloud SQL

## 開発環境の起動

```bash
# 1. DB起動（PostgreSQL + pgvector）
docker compose up -d

# 2. 環境変数
cp .env.example .env   # ANTHROPIC_API_KEY を設定

# 3. マイグレーション & シード
npx prisma migrate dev
npx prisma db seed

# 4. 開発サーバー
npm run dev
```

http://localhost:3000 で起動。

## ドキュメント

- [docs/roadmap.md](docs/roadmap.md) — 開発ロードマップ全体
- [docs/weekly-report.md](docs/weekly-report.md) — 週報テンプレートの設計思想
- [docs/data-model.md](docs/data-model.md) — データモデル設計
