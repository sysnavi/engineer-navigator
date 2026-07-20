# デプロイ手順（Vercel + Neon）

テスト版を他エンジニアに見せるための最小構成。**個人情報は保持しない**方針（招待リンク認証）。

## 全体像

- **アプリ**: Vercel（Next.js 純正・無料枠）
- **DB**: Neon（pgvector 対応の Postgres・無料枠）
- **認証**: 招待リンク（メール/パスワード不要）。管理者だけがリンクを発行して配る。
- **トークン保護**: AIレート制限＋自動/手動アカウント停止（実装済み）。

---

## 1. Neon で DB を用意

1. https://neon.tech でプロジェクト作成（Postgres は **16以降ならOK**。Neon既定の 18 で問題なし。バージョン固有機能は未使用）。
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
   | `DATABASE_URL` | Neon の **pooled** 接続文字列（アプリ実行用） | ✅ |
   | `DATABASE_URL_DIRECT` | Neon の **direct** 接続文字列（ビルド時の自動マイグレーション用） | ✅ |
   | `ANTHROPIC_API_KEY` | Claude APIキー | ✅ |
   | `ADMIN_INVITE_TOKEN` | 手順2で使った値と同じ | ✅ |
   | `VOYAGE_API_KEY` | RAG検索用（未設定でも動く／RAGはスキップ） | 任意 |
   | `AI_RATE_PER_MINUTE` / `AI_RATE_PER_DAY` / `AI_AUTO_SUSPEND_PER_DAY` | レート上限の上書き | 任意 |

   > ⚠️ `DEV_LOGIN_ENABLED` は**設定しない**こと。設定すると認証ゲートが無効になり誰でも入れてしまう。
3. Deploy。ビルドは `prisma generate && prisma migrate deploy && next build`。
   **マイグレーションはデプロイのたびに自動適用される**（`DATABASE_URL_DIRECT` の direct 接続を使用。
   未適用分がなければ何もしない）。マイグレーション失敗時はビルドごと失敗し、旧デプロイが生き残る。

## 4. 管理者として入る → テスターを招待

1. `https://<あなたのドメイン>/join/<ADMIN_INVITE_TOKEN>` を開く → 管理者としてログイン。
2. **マイページ → ADMIN パネル** で招待リンクを発行（目印は任意）。
3. 表示された `…/join/…` のURLを各エンジニアに配る。受け取った人はそれを開くだけで利用開始（登録不要）。
4. 不要になった招待は **失効** ボタンで無効化。荒らし・過剰利用のアカウントは同パネルで **停止**。

## 5. OAuthログインを有効にする（Issue #8・Google / GitHub）

設定したプロバイダだけ `/welcome` にログインボタンが出ます。**メールや名前は受け取らず、
保存されるのは `SHA-256(provider:sub)` のハッシュだけ**（PIIゼロ設計）。招待リンクは併存します。

### Google（Google Cloud Console: https://console.cloud.google.com/apis/credentials）
1. プロジェクト作成 → 「OAuth同意画面」を External で作成（スコープ追加は不要・openidのみ使用）
2. 「認証情報」→「OAuthクライアントID」→ 種類: ウェブアプリケーション
3. 承認済みリダイレクトURI に `https://<あなたのドメイン>/api/auth/google/callback` を追加
   （ローカル検証もするなら `http://localhost:3000/api/auth/google/callback` も）
4. 発行された クライアントID / シークレット を Vercel の環境変数へ:
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

### GitHub（Settings → Developer settings → OAuth Apps: https://github.com/settings/developers）
1. New OAuth App → Authorization callback URL に
   `https://<あなたのドメイン>/api/auth/github/callback`
2. Client ID と（Generate a new client secret で）シークレットを Vercel へ:
   `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

> `APP_URL`（例: `https://engineer-navigator.vercel.app`）も設定しておくと、
> コールバックURLの組み立てがプロキシ環境でも安定します。

**既存の招待ユーザーの引き継ぎ**: ログイン中にマイページ「AUTH.cfg — ログイン連携」から
Google/GitHubを連携すれば、以後どちらでも同じアカウントに入れます（管理者もこの方法で引き継ぎ）。

## 6. 社内公開の初期データを入れる（公開前に1回）

まっさらな状態だと、よもやまは「まだ投稿はありません」、腕試しは数問で尽きてしまい、
初めて来た人が手持ち無沙汰になる。公開用の初期データを入れておく:

```bash
DATABASE_URL="<neon-direct-url>" npm run seed:launch
```

入るもの（`prisma/seed-launch.ts`）:

- **EN運営アカウント** … 正体を明かした運営名義。投稿者名に「EN運営」と出る
- **よもやま 8件** … 運営からの話題ふり。空っぽ感をなくし、最初の1人が書き込む
  ハードルを下げるのが目的
- **良問バンク 27問** … AWS/ネットワーク/SQL/Git/セキュリティ/設計/テスト/Linux など、
  実際に解く価値のある四択（解説つき）

> **架空の同僚アカウントは作らない方針**です。社内公開では「この人だれ？」がすぐ露見し、
> 分かった瞬間にツールへの信頼が落ちるため。賑わいを演出するのではなく、
> 「ちゃんと作り込まれている」と伝わる中身を置く考え方でデータを選んでいます。

固定IDのupsertなので**何度実行しても増えません**（内容を直して再実行すれば更新できます）。
やめたくなったら `prisma/seed-launch.ts` のIDで削除すればきれいに消せます。

## 7.（任意）会社ノウハウRAGを投入

```bash
DATABASE_URL="<neon-direct-url>" VOYAGE_API_KEY="<key>" npm run ingest:knowledge
```

---

## 運用メモ

- **個人情報**: DBが持つのはハンドル（ペンネーム）・自己記入の作業メモ・招待トークンのみ。メール/氏名は保持しない。テスターには「本名・客先実名を書かない」旨をトップ(/welcome)でも案内済み。
- **コンディション（気分・稼働・メンタル）**は公開ビューに一切出さない設計（`src/lib/public-profile.ts`）。
- マイグレーションは **Vercel ビルドに組み込み済み**（push→デプロイで自動適用）。手動での `migrate deploy` は初回セットアップ（手順2）以外は不要。ローカルの `npm run build` もローカルDBに `migrate deploy` を実行するので、DB（docker compose）を起動しておくこと。
- 認証は招待リンク方式。将来 Google SSO 等に替える場合も `getCurrentUser`（`src/lib/auth.ts`）差し替えで対応可能。
