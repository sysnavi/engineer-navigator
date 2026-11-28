# 会社アカウント → 個人アカウントへの差し替え手順

> 状態: 手順書（2026-11-28）。Vercel と Neon の移行はほぼ済み。残りは、Vercel の環境変数のうち会社のものを指している分を個人のものに差し替える作業。
> この文書には変数名と置き場所だけを書く。**実際の値（秘密）はここにも、コミットにも、チャットにも書かない。**
> 本番の URL は `https://www.engineer-navigator.jp`（`mobile/capacitor.config.ts` の PROD_URL）。以下 `<本番>` と書く。

## 1. 環境変数の一覧（コードから洗い出し）

「Vercel」の列は、2026-11-28 にオーナーが見せた Vercel のプロジェクト環境変数の一覧（P = Production、Pv = Preview）。

### アプリ（Vercel）で使うもの

| 変数 | Vercel | どこで使われているか | 差し替え | 新しい値を作る場所 | 未設定のときのアプリ |
|---|---|---|---|---|---|
| `APP_URL` | P | OAuth の戻り先（`src/lib/oauth.ts`）、通知のリンク（`src/lib/notify.ts`）、サイトの URL（`src/lib/site-url.ts`）、定期ジョブ | 不要（ドメインが変わらない限り）| ― | OAuth の戻り先をリクエストの URL から組み立てる（登録した戻り先と違うとログインが失敗する）|
| `DATABASE_URL` | P・Pv | アプリの DB 接続（`src/lib/db.ts`）、ビルドの `prisma migrate deploy`（`prisma.config.ts`）| 済み（Neon 移行時に更新済み）| Neon（個人）の接続文字列 | アプリもビルドも動かない |
| `DATABASE_URL_DIRECT` | 無し | ビルドの `prisma migrate deploy` 用の直結（`prisma.config.ts`）| ― | Neon の「Direct connection」の接続文字列 | `DATABASE_URL` で migrate する（4 章を参照）|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | P | Google ログイン（`src/lib/oauth.ts`）。スマホアプリのログインの署名にも使う（`src/lib/mobile-login.ts`）| **要る** | Google Cloud Console（個人）の OAuth クライアント | Google のボタンが出ない（2 つそろったときだけ有効）|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | P・Pv | GitHub ログイン（同上）| **要る** | GitHub（個人）の Settings → Developer settings → OAuth Apps | GitHub のボタンが出ない |
| `ANTHROPIC_API_KEY` | P・Pv | AI 機能すべて（`src/lib/ai/client.ts` 経由）| **要る** | Anthropic Console（個人）→ API Keys | AI のボタンが出なくなる。週報は提出でき、解析だけ FAILED（仕様）|
| `VOYAGE_API_KEY` | P・Pv | メンターの知識検索（RAG。`src/lib/ai/embeddings.ts`・`retrieval.ts`）| **要る** | Voyage AI（個人）のダッシュボード | 知識検索を飛ばし、メンターは知識なしで答える |
| `JOB_SECRET` | P | 定期ジョブの入口の合言葉（`/api/jobs/oauth-health`・`/api/jobs/weekly-insights`）| 作り直すだけ | 手元で乱数を作る（例: `openssl rand -hex 32`）| 入口は閉じる（503 を返す）。開いたままにはならない |
| `ADMIN_INVITE_TOKEN` | P・Pv | **実行中のアプリは読まない。** `prisma/seed.ts` が管理者の最初の招待リンクを DB に作るときだけ使う | 不要（会社のものではない）| ― | 影響なし（ビルドは seed を走らせない）|
| `SLACK_WEBHOOK_URL` | 無し | お知らせの Slack 投稿（`src/lib/notify.ts`: お問い合わせ・コンディションの警告・AI 利用の自動停止）| 付けるなら個人の Slack で作る | Slack（個人）→ Incoming Webhooks | Slack に送らず、Vercel のログに出すだけ（機能は止まらない）|
| `OPENAI_API_KEY` | 無し | サーバー側の音声認識（`src/lib/ai/stt.ts`）| ― | ― | 端末の音声入力・文字入力に切り替わる |
| `DEV_LOGIN_ENABLED` | 無し | 開発用ログイン（`src/middleware.ts`・`src/lib/auth.ts`）| ― | ― | **本番では付けない**（付けると誰でも他人として入れる）|
| `AI_GLOBAL_PER_DAY` ほか AI の上限 | 無し | `src/lib/usage.ts`（3 章を参照）| ― | ― | 既定値で動く |
| `PET_TALK_PER_DAY` | 無し | ペットとの会話の 1 日の回数（`src/app/home/talk-actions.ts`）| ― | ― | 既定 10 回 |
| `UI_SHELL_DEFAULT` | 無し | 画面の見た目の既定（`src/lib/shell.ts`）| ― | ― | `classic` |

### GitHub Actions（リポジトリの Settings → Secrets and variables → Actions）で使うもの

アプリとは別に、GitHub 側にも同じ秘密が入っている。**Vercel と一緒に変えないと、毎日の仕事が失敗する。**

| 名前 | 種類 | 使う workflow | 差し替え |
|---|---|---|---|
| `JOB_SECRET` | Secret | `oauth-health.yml`（毎日）・`weekly-insights.yml`（毎週金曜）| **Vercel と同じ新しい値にする** |
| `ANTHROPIC_API_KEY` | Secret | `bug-triage.yml`（毎朝のバグトリアージ）| **要る**（会社のキーなら）|
| `SLACK_BOT_TOKEN` / `SLACK_TRIAGE_CHANNEL` | Secret / Variable | トリアージ・見張り・週次・SNS の報告 | Slack を個人に移すなら要る |
| `TRIAGE_GH_TOKEN` | Secret | `bug-triage.yml`（修正 PR を作る）| 会社の人の PAT なら要る（個人の PAT を作る）|
| `APP_URL` | Variable | 見張り・週次が叩く本番の URL | ドメインが変わらない限り不要 |
| `FIREBASE_SERVICE_ACCOUNT_JSON`・`ANDROID_KEYSTORE_*`・`ANDROID_KEY_*` | Secret | `android-distribute.yml`（Android の配布）| Firebase が会社のプロジェクトなら要る。**キーストアは失うとアプリを更新できなくなる**ので、本体のファイルを必ず手元に控える |
| `X_*` | Secret | `sns-post.yml` | X への投稿は止める方針なので不要（cron は残っている）|

## 2. ログイン設定（OAuth）の作り直し

### 戻り先 URL（callback）
- Google: `https://www.engineer-navigator.jp/api/auth/google/callback`
- GitHub: `https://www.engineer-navigator.jp/api/auth/github/callback`

コードは `${APP_URL}/api/auth/<provider>/callback` を組み立てる（`src/lib/oauth.ts` の `redirectUri`）。スマホアプリのログインも、この同じ戻り先を通る（別の URL は要らない）。

### 今の利用者は、同じアカウントのままログインできるか → **できる**
- DB（`AuthIdentity.providerHash`）に入っているのは `SHA-256("<provider>:<相手側の利用者ID>")` だけ。OAuth アプリの ID や秘密は混ぜていない（`src/lib/oauth.ts` の `providerHash`）。
- Google の利用者ID（id_token の `sub`）は、Google アカウントごとに 1 つで、OAuth クライアントが変わっても同じ。GitHub の利用者ID（`/user` の `id`）も、アカウントごとに 1 つで同じ。
- そのため、OAuth アプリを個人のものに作り直しても、同じ Google/GitHub アカウントでログインすれば、同じ利用者として入れる。
- ログイン中の人のセッション（`AuthSession`）は DB の乱数で、OAuth の秘密とは関係ないので、差し替えでログアウトされない。
- 影響が出るのは、差し替えの瞬間に**スマホアプリでログインの途中だった人**だけ（10 分間有効な署名に GOOGLE/GITHUB の秘密を使っているため。やり直せば通る）。
- 念のための確認: 差し替え後、**既存のアカウントで 1 回ログインし、マイページのハンドル名が前と同じか**を見る（新しいハンドル名になったら、別の利用者として作られている）。

### Google（Google Cloud Console・個人のプロジェクト）
1. API とサービス → OAuth 同意画面: アプリ名などを入れる。スコープは追加しない（アプリは `openid` だけ使う）。
2. **公開ステータスを「本番環境」にする。**「テスト」のままだと、テストユーザーに登録した人しかログインできない。`openid` だけなら Google の審査は要らない。
3. 認証情報 → OAuth クライアント ID を作成 → 種類「ウェブ アプリケーション」→ 承認済みのリダイレクト URI に上の Google の戻り先を 1 つ入れる。
4. 出てきたクライアント ID とシークレットを、Vercel の `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`（Production）に入れる。

### GitHub（個人のアカウント）
1. Settings → Developer settings → OAuth Apps → New OAuth App。
2. Homepage URL に `<本番>`、Authorization callback URL に上の GitHub の戻り先を入れる（GitHub の OAuth App は戻り先を 1 つしか持てない）。
3. Client ID と、Generate a new client secret で出た秘密を、Vercel の `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`（Production）に入れる。

## 3. AI のキー（ANTHROPIC_API_KEY・VOYAGE_API_KEY）

### Anthropic
1. Anthropic Console（個人）で組織と支払いを用意し、API キーを作る。
2. **Console の Limits で月の使用上限（spend limit）を決めて入れる。** アプリ側の上限は「回数」で、金額では止まらない。
3. Vercel の `ANTHROPIC_API_KEY`（Production）に入れる。毎朝のバグトリアージも会社のキーなら、GitHub の Secret `ANTHROPIC_API_KEY` も替える。
4. モデル名はコード側（`src/lib/ai/client.ts`）で決めているので、キーを替えてもモデルは変わらない。個人の組織でそのモデルが使えることだけ確かめる。

### Voyage
1. Voyage AI（個人）でキーを作り、Vercel の `VOYAGE_API_KEY`（Production）に入れる。
2. モデルは `voyage-3.5`（1024 次元）のまま。DB に入っている知識の埋め込みは、同じモデルならキーが変わってもそのまま使える（作り直しは要らない）。

### アプリ側の上限（`src/lib/usage.ts`）。今はどれも Vercel に無く、既定値で動いている
| 変数 | 既定 | 中身 |
|---|---|---|
| `AI_RATE_PER_MINUTE` | 15 | 1 人の直近 1 分の上限（連打対策）|
| `AI_RATE_PER_DAY` | 50 | 1 人の 24 時間の上限（届いたらその日は打ち止め）|
| `AI_AUTO_SUSPEND_PER_DAY` | 600 | 1 人がこれを超えたら自動で止める（Slack に通知）|
| `AI_GLOBAL_PER_DAY` | 300 | 全員合わせた 24 時間の上限。請求が青天井にならないための防波堤 |
| `PET_TALK_PER_DAY` | 10 | ペットとの会話の 1 日の回数 |

利用者がほぼいないので、既定のままでよい。費用を固く止めたいなら、Anthropic Console の月の上限のほうが確実。

## 4. Slack（SLACK_WEBHOOK_URL）
- 今は Vercel に無いので、お知らせはすべて Vercel のログに出ているだけ。送られる内容は次の 3 つ。
  - お問い合わせ
  - コンディションの警告（レベル・きっかけ・氏名・ダッシュボードへのリンク。週報の本文は載せない）
  - AI 利用の自動停止
- 付けるなら、個人の Slack に Incoming Webhook を作り、Vercel の `SLACK_WEBHOOK_URL`（Production）に入れる。氏名が載るので、自分だけが見るチャンネルにする。
- 付けなくても機能は止まらない（このままでもよい）。
- GitHub Actions の報告（`SLACK_BOT_TOKEN`）は別の仕組み。会社の Slack に投稿しているなら、個人の Slack の Bot トークンとチャンネルに替える。

## 5. ADMIN_INVITE_TOKEN と JOB_SECRET

### ADMIN_INVITE_TOKEN
- 実行中のアプリは読まない。管理者の最初の招待リンクを DB に作るときに、`prisma/seed.ts` が使うだけ。
- 会社のものではないので、差し替えは要らない。Vercel から外しても、アプリは何も変わらない。
- 招待リンクを作り直したいときは、マイページの ADMIN から古い招待を失効させ、新しく発行する。
- **本番 DB に `prisma/seed.ts` を流してはいけない**（デモデータを入れ、管理者の招待を書き換える）。

### JOB_SECRET
1. 手元で乱数を作る（例: `openssl rand -hex 32`）。
2. **Vercel の `JOB_SECRET`（Production）と、GitHub の Secret `JOB_SECRET` に同じ値を入れる。** 呼ぶ側は GitHub Actions の `oauth-health.yml`・`weekly-insights.yml` で、Vercel Cron は使っていない（`vercel.json` に cron 無し）。
3. 片方だけ替えると、呼ぶ側が 401 で失敗する（Slack に失敗の報告が来る）。入口は閉じたままなので、危なくはない。

## 6. 差し替える順番と、戻し方

**会社のキーやアプリは、最後の確認が終わるまで消さない**（戻すときに使う）。

1. 新しい値を全部作る: Anthropic・Voyage のキー、Google・GitHub の OAuth アプリ、JOB_SECRET、（付けるなら）Slack の Webhook。
2. Vercel → Settings → Environment Variables で、Production の値を差し替える: `ANTHROPIC_API_KEY`・`VOYAGE_API_KEY`・`GOOGLE_CLIENT_ID/SECRET`・`GITHUB_CLIENT_ID/SECRET`・`JOB_SECRET`（・`SLACK_WEBHOOK_URL`）。
3. GitHub → リポジトリの Settings → Secrets: `JOB_SECRET`（Vercel と同じ値）・`ANTHROPIC_API_KEY`・（Slack を移すなら）`SLACK_BOT_TOKEN`・`SLACK_TRIAGE_CHANNEL`。
4. **再デプロイで反映する。** Vercel の環境変数は、次のデプロイから効く。Vercel → Deployments → 一番上の Production → Redeploy（または main への次の push）。
5. 確かめる:
   - Google と GitHub それぞれ、**既存のアカウントで**ログインし、マイページのハンドル名が前と同じ。
   - 週報を出して、AI の解析が FAILED にならない。メンターに質問して答えが返る。
   - GitHub → Actions → `oauth-health` を Run workflow で手で動かし、成功する（Google/GitHub の設定と JOB_SECRET の確認を兼ねる）。
6. 数日問題が無ければ、会社側のもの（会社の Anthropic キー、会社の OAuth アプリ）を止める。会社のアカウントで行う作業なので、権限を持つ人に頼む。

### 失敗したときの戻し方
- **すぐ戻す:** Vercel → Deployments → 差し替え前の Production → Instant Rollback。前のデプロイは、そのときの環境変数のまま動くので、会社のキーで元どおりになる（会社のキーを消していない場合に限る）。
- **値を戻す:** 環境変数を元の値に戻して、もう一度 Redeploy。
- DB には何も書き換えが無いので、データの戻しは要らない。

## 7. 気をつけたい点

### Preview に付いている変数
テスト環境は作らない方針になったので、Preview の変数は外すのがよい。

| 変数 | Preview にあると何が起きるか | おすすめ |
|---|---|---|
| `DATABASE_URL` | main 以外のブランチ（毎朝のトリアージの修正 PR など）を Vercel がビルドすると、`prisma migrate deploy` が**本番 DB に流れる**。マージ前の migration が本番に入りうる | **外す。** Preview のビルドは migrate で失敗するようになるので、合わせて Preview のビルド自体を止める（Settings → Git → Ignored Build Step に `[ "$VERCEL_GIT_COMMIT_REF" != "main" ]` を入れると、main 以外はビルドしない）|
| `ANTHROPIC_API_KEY`・`VOYAGE_API_KEY` | Preview の URL から AI を使われると、本番と同じ請求に乗る | 外す |
| `GITHUB_CLIENT_ID/SECRET` | Preview の URL は戻り先と違うので、どのみちログインできない | 外す |
| `ADMIN_INVITE_TOKEN` | アプリは読まない | 外す（Production からも外してよい）|

### DATABASE_URL_DIRECT が無く、migrate が `DATABASE_URL` で走っている件
- `prisma.config.ts` の作りでは、`DATABASE_URL_DIRECT` が無いとき、ビルドの `prisma migrate deploy` は `DATABASE_URL` を使う。
- **`DATABASE_URL` が Neon の pooled 接続（ホスト名に `-pooler` が入っている）の場合**: PgBouncer 経由になる。Prisma は migrate に direct 接続を勧めていて、pooled だと migration のロックや複数の文でつまずくことがある。
  - これまでのデプロイで問題が出ていないなら、すぐ壊れるものではない。ただ、Neon の画面で「Direct connection」の文字列をとり、Vercel の `DATABASE_URL_DIRECT`（Production）に入れるのが安全。値は Neon の画面にしか無いので、オーナーの作業になる。
- **`DATABASE_URL` が direct 接続の場合**: migrate は問題ない。代わりに、アプリの実行時も direct 接続になる。利用者がほぼいない今は問題にならない。
- どちらなのかはリポジトリからは分からない。Vercel の画面で、`DATABASE_URL` のホスト名に `-pooler` があるかを見る（値そのものはどこにも書き写さない）。

### リポジトリ `sysnavi/engineer-navigator` を個人へ移す場合（分かる範囲）
- **Vercel の Git 連携:** Vercel のプロジェクトはリポジトリに結びついている。移したあと、Vercel → Settings → Git で、新しい置き場所に繋ぎ直す。個人の GitHub に Vercel の GitHub App を入れる必要がある。繋ぎ直すまでは、push しても本番に出ない。
- **GitHub Actions の Secrets と Variables:** 組織（sysnavi）の単位で入れたものは、移った先では使えない。リポジトリの単位のものも、移したあとに残っているかを必ず目で確かめる。消えていたら入れ直す。上の表の全部が対象で、特に Android のキーストアは失うとアプリを更新できなくなる。
- **毎朝のトリアージの `TRIAGE_GH_TOKEN`:** PAT（Classic）が会社の人のものなら、移したリポジトリに書けなくなる。個人の PAT に替える。
- **GitHub の OAuth App:** sysnavi の組織の下にあるなら、2 章のとおり個人のアカウントで作り直す（リポジトリを移すかどうかとは関係なく要る）。
- **手元の clone:** GitHub は古い URL から転送してくれるが、`git remote set-url origin` で新しい URL にしておく。並行で動いているほかのセッションの clone も同じ。
- **ドキュメントの中のリポジトリ名:** `docs/handoff.md`・`docs/dev-infra.md` に `sysnavi/engineer-navigator` が書いてある（動きには影響しない）。
- **本番のドメイン** `www.engineer-navigator.jp`: ドメインの登録とDNSが会社の名義なら、それも移す必要がある。ドメインが変わると、次のものを全部替えることになる。
  - `APP_URL`
  - OAuth の戻り先
  - GitHub の Variable `APP_URL`
  - スマホアプリの PROD_URL（アプリの再配布が要る）
