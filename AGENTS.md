<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Engineer Navigator 開発ガイド

SESエンジニアの成長をデータ化するアプリ。構想・設計は docs/ を必ず読むこと:
- docs/roadmap.md — フェーズ計画（何をどの順で作るか）
- docs/weekly-report.md — 週報テンプレの設計思想（フォームを変える前に読む）
- docs/data-model.md — スキーマの設計判断（AI提案→本人承認フローは構造で強制）

## スタック
Next.js 16 (App Router / Server Actions) + Prisma 7 + PostgreSQL 16 (pgvector, port 5433) + Claude API

## 開発コマンド
```bash
docker compose up -d      # DB起動（port 5433）
npx prisma migrate dev    # マイグレーション
npx prisma db seed        # スキルマスタ・デモユーザー投入
npm run dev               # http://localhost:3000
```

## 決まりごと
- LLM呼び出しは必ず src/lib/ai/client.ts 経由（モデル名・トークン記録を一元管理）
- AIがEngineerSkillを直接書き換えるのは禁止。必ずSkillSuggestion → 本人承認を経由
- 顧客実名をDBに入れない（Project.clientAlias のみ）
- 認証は開発用cookie方式（src/lib/auth.ts）。本番はGoogle Workspace SSOに置換予定
- ANTHROPIC_API_KEY が未設定でも週報提出は成功し、解析だけ FAILED になる（この挙動は仕様）
