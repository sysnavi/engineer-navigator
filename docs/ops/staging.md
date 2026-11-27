# テスト環境（staging）の作り方

> 状態: **手順書のみ（2026-11-27）**。Vercel・Neon・OAuth の設定はまだしていない。ローカルに `staging` ブランチだけ作ってある（未 push）。
> 目的: 本番に出す前に、本番と同じ作り（Vercel + Neon）で確かめられる場所を用意する。本番の DB・利用者・外部サービスには触らない。

## まず結論

- **いちばん危ないのは DB。** `npm run build` は `prisma migrate deploy` を含む。Vercel は main 以外のブランチも「Preview」としてビルドするので、Preview でもこれが走る。
  - Preview の環境変数に本番の `DATABASE_URL` / `DATABASE_URL_DIRECT` が入っていると、**テスト用ブランチのマイグレーションが本番 DB に流れる**。
  - これは staging に限らない。今でも、バグトリアージの自動修正 PR（`triage/<id>` ブランチ）や、ほかの push のたびに起こり得る。
  - リポからは Vercel 側の設定が見えないので、**最初に Vercel の画面で確認が要る**（手順 A）。
- 分け方: **staging 専用の Neon の DB を作り、その接続文字列を「Preview・staging ブランチだけ」の環境変数に入れる。** 本番の DB の変数は「Production だけ」にする。
- 外部サービスは、staging では**入れない・別のものを使う・上限を絞る**のどれかにする（下の表）。

## 今の作り（リポから読めた範囲）

| 項目 | 中身 | 場所 |
|---|---|---|
| Vercel の設定 | リージョン sin1 だけ。Cron・リダイレクト・ビルドの上書きなし | `vercel.json` |
| ビルド | `prisma generate && prisma migrate deploy && next build`。seed は走らない | `package.json` の `build` |
| DB 接続 | 実行時は `DATABASE_URL`（Neon の pooled 接続）。マイグレーションは `DATABASE_URL_DIRECT` があればそれ、無ければ `DATABASE_URL` | `src/lib/db.ts`・`prisma.config.ts` |
| Preview デプロイ | リポに無効化の設定は無い（Vercel の既定は「全ブランチを Preview でビルド」）。実際に有効かは Vercel の画面で確認 | — |
| 環境の見分け | コードは `VERCEL_ENV` を見ていない。本番かどうかは環境変数の中身だけで決まる | — |
| 公開URL | `APP_URL`（sitemap・robots・OGP・通知のリンク・OAuth のコールバック） | `src/lib/site-url.ts`・`src/lib/oauth.ts` |
| 定期ジョブ | Vercel Cron は無い。GitHub Actions の cron が `vars.APP_URL`（本番）を叩く（oauth-health・weekly-insights）。バグトリアージと SNS Bot は Actions の中で動く | `.github/workflows/` |
| モバイルアプリ | 本番 URL を読むだけのシェル。`CAP_SERVER_URL` で向け先を変えてビルドできる | `mobile/capacitor.config.ts` |

## 本番に影響し得るもの

| もの | 環境変数 | 本番への影響 | staging での扱い |
|---|---|---|---|
| DB | `DATABASE_URL`・`DATABASE_URL_DIRECT` | マイグレーション・データの書き込み | **staging 専用の Neon DB**（必須） |
| 公開URL | `APP_URL` | 通知のリンク・OAuth のコールバック・sitemap が本番を指す | staging の URL を入れる |
| Google ログイン | `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET` | 登録外のコールバックURLは `redirect_uri_mismatch` で失敗するだけ（本番は壊れない） | 同じクライアントに staging の URI を足すか、staging 用のクライアントを作る |
| GitHub ログイン | `GITHUB_CLIENT_ID`・`GITHUB_CLIENT_SECRET` | 同上。GitHub の OAuth App はコールバックURLを1つしか持てない | **staging 用の OAuth App を別に作る**（無ければボタンが出ないだけ） |
| Claude API | `ANTHROPIC_API_KEY` | 費用が本番と同じ請求に乗る | 別キーか、`AI_GLOBAL_PER_DAY` を小さく（例 30）。未設定でも週報提出は動き、解析だけ FAILED（仕様） |
| 埋め込み・文字起こし | `VOYAGE_API_KEY`・`OPENAI_API_KEY` | 費用 | 入れない（無くても動く） |
| Slack 通知 | `SLACK_WEBHOOK_URL` | **本番の限定チャンネルに、テストのコンディション通知（氏名入り）が流れる** | 入れない、または staging 用チャンネルの Webhook |
| 週次ジョブ | `JOB_SECRET` | Actions は本番 URL しか叩かないので影響なし | 本番と別の値（入れなければジョブは 503） |
| 管理者の招待 | `ADMIN_INVITE_TOKEN` | 同じ値だと、本番の招待 URL の形が staging から推測できる | 本番と別のランダム値 |
| 開発用ログイン | `DEV_LOGIN_ENABLED` | ユーザー切替が誰でもできる | 入れない。入れるなら必ず手順 C のアクセス制限と一緒に |
| UI の既定 | `UI_SHELL_DEFAULT` | なし | 本番と同じ |
| アクセス解析 | （Vercel Web Analytics） | Vercel は環境ごとに分けて集計（本番の数字には混ざらない） | そのままでよい |
| 検索エンジン | — | staging が検索に載ると重複コンテンツになる | Vercel の Preview URL には自動で `noindex` が付く。独自ドメインを付けるなら手順 C のアクセス制限で防ぐ |

## 手順（オーナーが画面でやること）

### A. Vercel：今の環境変数の割り当てを確認する（最初に、必ず）
1. Vercel → プロジェクト engineer-navigator → **Settings → Environment Variables**。
2. `DATABASE_URL` と `DATABASE_URL_DIRECT` の「Environments」列を見る。
   - **Production だけ** → OK。
   - **Preview にも付いている** → 今も、main 以外の push で本番 DB にマイグレーションが走り得る。編集で **Preview のチェックを外す**（Production だけにする）。
3. ほかの変数（`ANTHROPIC_API_KEY`・`SLACK_WEBHOOK_URL`・`GOOGLE_*`・`GITHUB_*`・`ADMIN_INVITE_TOKEN`・`JOB_SECRET`）も、Production だけにしておく。staging には B で別の値を入れる。
4. **Settings → Git** で「Production Branch」が `main` か確認する。

### B. Neon：staging 用の DB を作る
1. Neon → 本番と同じプロジェクトで **Branches → New branch**（名前 `staging`）。または新しいプロジェクトを作る。
   - Neon のブランチは、元のデータを丸ごと複製する。本番ブランチから作ると**利用者の個人データが staging に入る**。
   - **データを持ち込まない場合**: 複製したあと staging ブランチの中身を空にする（DB を作り直す）か、新しいプロジェクトで空の DB から始める。
   - **本番に近いデータで試したい場合**: 複製でよい。ただし、staging にアクセスできる人を本番と同じ範囲に絞る（手順 C）。→ 判断が要る点 1。
2. staging ブランチの接続文字列を2つ控える。
   - pooled（ホスト名に `-pooler` が付く）→ `DATABASE_URL` に使う
   - direct（`-pooler` なし）→ `DATABASE_URL_DIRECT` に使う

### C. Vercel：staging の環境変数とアクセス制限
1. **Settings → Environment Variables → Add**。Environment は **Preview** を選び、「Git Branch」に `staging` を指定する（staging ブランチのビルドだけに効く）。
   - `DATABASE_URL` = B の pooled
   - `DATABASE_URL_DIRECT` = B の direct
   - `APP_URL` = staging の URL（2 で決める。例 `https://staging.engineer-navigator.jp`）
   - `ADMIN_INVITE_TOKEN`・`JOB_SECRET` = 本番と別のランダム値
   - `ANTHROPIC_API_KEY` = 別キー（無ければ本番と同じキー）＋ `AI_GLOBAL_PER_DAY=30`
   - `SLACK_WEBHOOK_URL`・`VOYAGE_API_KEY`・`OPENAI_API_KEY`・`DEV_LOGIN_ENABLED` は**入れない**
2. **Settings → Domains → Add**: staging 用のドメイン（例 `staging.engineer-navigator.jp`）を足し、「Git Branch」に `staging` を指定する。DNS 側で CNAME を足す（Vercel が表示する値）。
   - ドメインを付けない場合は、Vercel が作る `engineer-navigator-git-staging-<チーム>.vercel.app` を使う。OAuth のコールバックにはこの固定 URL を登録する。
3. **Settings → Deployment Protection**: Preview に「Vercel Authentication」（Vercel にログインしたメンバーだけ見られる）をかける。
   - 独自ドメインを付ける場合は、そのドメインにも保護がかかる設定か確認する。
   - 保護をかけると、スマホのアプリや外部の人からは見えなくなる。→ 判断が要る点 2。
4. （おすすめ）**Settings → Git → Ignored Build Step**: main と staging 以外のブランチをビルドしない。コマンドの例:
   `if [ "$VERCEL_GIT_COMMIT_REF" = "main" ] || [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 1; else exit 0; fi`
   （exit 1 = ビルドする）。トリアージの自動修正 PR などの Preview ビルドで、どこかの DB にマイグレーションが走るのを止められる。ただし PR ごとの Preview は見られなくなる。→ 判断が要る点 3。

### D. ログイン（OAuth）
- **Google**: Google Cloud Console → APIs & Services → Credentials → 本番の OAuth クライアント → 「承認済みのリダイレクト URI」に `<staging のURL>/api/auth/google/callback` を足す。または staging 用のクライアントを作り、その ID・シークレットを C-1 の staging 変数に入れる。
- **GitHub**: GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**（staging 用。Callback URL = `<staging のURL>/api/auth/github/callback`）。ID・シークレットを C-1 の staging 変数に入れる。
- どちらも入れなければ、staging の /welcome にそのボタンが出ないだけで、ゲストで試せる。

### E. 初回だけ：staging の DB の準備
空の DB には、スキルマスタやデモユーザーなどの seed が要る（ビルドは seed を走らせない）。手元から1回だけ流す。

```bash
DATABASE_URL="<staging の direct>" DATABASE_URL_DIRECT="<staging の direct>" npx prisma migrate deploy
```

```bash
DATABASE_URL="<staging の direct>" DATABASE_URL_DIRECT="<staging の direct>" npx prisma db seed
```

接続先を何度も見直してから実行すること（本番の文字列を貼らない）。デモユーザーまで入るので、staging は手順 C-3 の保護をかけてから公開する。

### F. 動かし方（ふだんの流れ）
1. 作業ブランチで作る。
2. `staging` に取り込んで push する。staging の URL に Preview が出る。
3. staging で確かめる。
4. OK なら main に取り込んで push する（本番）。
- staging ブランチは main より先に進むだけにし、staging 専用のコミットは作らない（main と食い違わないように）。
- 本番に出したあとは `git switch staging && git merge --ff-only main` でそろえ直す。
- スキーマ変更は staging で先にマイグレーションが走るので、本番の前に壊れないか確かめられる。

### G. 確認
- staging の URL を開き、/welcome が出る・ゲストで試せる・ダンジョンに潜れる。
- staging でユーザーを作っても、本番の /admin（ユーザー一覧）に出ないこと（DB が分かれている確認）。
- Vercel のビルドログで、`prisma migrate deploy` の接続先ホストが staging の Neon になっていること。

## リポ側で追加でやるとよいこと（まだやっていない）
- **ビルドのマイグレーションに安全装置を付ける**: `VERCEL_ENV` が `production` 以外のときは、`MIGRATE_ON_BUILD=1` のような明示の変数があるときだけ `migrate deploy` を走らせる。手順 A の割り当てを間違えても本番 DB に流れなくなる。ただし本番のビルドの作りを変えるので、出すときは慎重に。→ 判断が要る点 4。
- **staging では robots で全部 Disallow**: `VERCEL_ENV !== "production"` のとき `robots.ts` で全体を Disallow にする（独自ドメインを付ける場合の保険）。
- モバイルのテスト版: `CAP_SERVER_URL=<staging のURL>` でシェルをビルドすれば、staging を見るアプリが作れる（配布は /mobile-release の手順）。

## 判断が要る点
1. staging の DB を空から作るか、本番の複製にするか（複製なら個人データが入る）。
2. staging にアクセス制限（Vercel Authentication）をかけるか。かけると外部の人やスマホのアプリからは見られない。
3. main と staging 以外のブランチの Preview ビルドを止めるか（PR ごとの Preview が無くなる）。
4. ビルドのマイグレーションに安全装置を入れるか（本番のビルドの作りを変える）。
5. staging のドメインを独自ドメインにするか、Vercel の固定 URL で済ませるか（OAuth の登録先が変わる）。
6. Claude API のキーを staging 用に分けるか（費用の見え方）。
