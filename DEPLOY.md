# デプロイ手順（Vercel + Neon）

テスト版を他エンジニアに見せるための最小構成。**個人情報は保持しない**方針（招待リンク認証）。

## 全体像

- **アプリ**: Vercel（Next.js 純正・無料枠）
- **DB**: Neon（pgvector 対応の Postgres・無料枠）
- **認証**: 招待リンク（メール/パスワード不要）。管理者だけがリンクを発行して配る。
- **トークン保護**: AIレート制限＋自動/手動アカウント停止（実装済み）。

---

## 1. Neon で DB を用意

1. https://neon.tech でプロジェクト作成（Postgres 16）。
2. 接続文字列を2種類控える:
   - **プールなし（direct）**: マイグレーション用。
   - **プールあり（pooled, `-pooler` 付き）**: アプリ実行用（サーバーレス向き）。
   - どちらも末尾に `?sslmode=require` を付ける。
3. pgvector 拡張は **マイグレーションが自動で有効化**する（`CREATE EXTENSION IF NOT EXISTS vector`）。手動作業は不要。

## 2. スキーマ適用 + 初期データ投入（ローカルから1回）

direct 接続文字列を使って実行する:

```bash
# マイグレーション（テーブル作成 + pgvector 有効化）
DATABASE_URL="<neon-direct-url>" npx prisma migrate deploy

# スキルマスタ・デモデータ・シナリオ・管理者招待リンクを投入
DATABASE_URL="<neon-direct-url>" ADMIN_INVITE_TOKEN="<長いランダム文字列>" npx prisma db seed
# → 出力される "Admin join link: /join/<token>" を控える
```

`ADMIN_INVITE_TOKEN` は推測されない長い文字列にすること（例: `openssl rand -base64 24`）。

## 3. Vercel にデプロイ

1. https://vercel.com でこの GitHub リポジトリを Import。
2. **Environment Variables** を設定:

   | 変数 | 値 | 必須 |
   |---|---|---|
   | `DATABASE_URL` | Neon の **pooled** 接続文字列 | ✅ |
   | `ANTHROPIC_API_KEY` | Claude APIキー | ✅ |
   | `ADMIN_INVITE_TOKEN` | 手順2で使った値と同じ | ✅ |
   | `VOYAGE_API_KEY` | RAG検索用（未設定でも動く／RAGはスキップ） | 任意 |
   | `AI_RATE_PER_MINUTE` / `AI_RATE_PER_DAY` / `AI_AUTO_SUSPEND_PER_DAY` | レート上限の上書き | 任意 |

   > ⚠️ `DEV_LOGIN_ENABLED` は**設定しない**こと。設定すると認証ゲートが無効になり誰でも入れてしまう。
3. Deploy。ビルドは `prisma generate && next build`（Prisma クライアントはビルド時に生成される）。

## 4. 管理者として入る → テスターを招待

1. `https://<あなたのドメイン>/join/<ADMIN_INVITE_TOKEN>` を開く → 管理者としてログイン。
2. **マイページ → ADMIN パネル** で招待リンクを発行（目印は任意）。
3. 表示された `…/join/…` のURLを各エンジニアに配る。受け取った人はそれを開くだけで利用開始（登録不要）。
4. 不要になった招待は **失効** ボタンで無効化。荒らし・過剰利用のアカウントは同パネルで **停止**。

## 5.（任意）会社ノウハウRAGを投入

```bash
DATABASE_URL="<neon-direct-url>" VOYAGE_API_KEY="<key>" npm run ingest:knowledge
```

---

## 運用メモ

- **個人情報**: DBが持つのはハンドル（ペンネーム）・自己記入の作業メモ・招待トークンのみ。メール/氏名は保持しない。テスターには「本名・客先実名を書かない」旨をトップ(/welcome)でも案内済み。
- **コンディション（気分・稼働・メンタル）**は公開ビューに一切出さない設計（`src/lib/public-profile.ts`）。
- 新しいマイグレーションを足したら、再度 `DATABASE_URL=<direct> npx prisma migrate deploy` を実行してから Vercel を再デプロイ。
- 認証は招待リンク方式。将来 Google SSO 等に替える場合も `getCurrentUser`（`src/lib/auth.ts`）差し替えで対応可能。
