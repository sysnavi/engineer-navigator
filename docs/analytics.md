# 来訪者分析（Visitor Analytics）

「だれが来て、ゲストはどこで止まり、登録した人は戻ってくるか」を数字で見て、
サービス改善に繋げるための仕組み。3層に分けている。

| 層 | 見たいこと | 手段 | 場所 |
|---|---|---|---|
| 1 | ログイン後の行動・ゲスト→登録ファネル・定着 | **サーバー側イベント + 既存テーブル** | `/admin/analytics` |
| 2 | 公開ページ（LP・公開プロフィール・良問）の流入元・PV | **Vercel Web Analytics**（cookieなし） | Vercel ダッシュボード |
| 3 | 決まった画面にない自由な集計 | **Looker Studio → Neon 読み取り専用ロール** | Looker Studio |

方針:
- **PIIゼロ**はここでも守る。イベントに入れるのは機能ID・プロバイダ名・結果コードだけ。自由入力・IP・UAは入れない
- **記録はサーバー側だけ**（Route Handler / Server Action / サーバーコンポーネント）。クライアントJSに頼ると
  広告ブロッカーやWKWebView（モバイルアプリ）で欠損し、ゲストの数字が歪む
- 記録の失敗は本体を止めない（`track()` は throw しない）

## 1. サーバー側イベント（`AppEvent`）

書くのは `src/lib/analytics/track.ts` の `track(EVENT.xxx, { userId, props })` だけ。イベント名は
`EVENT` 定数からしか取れない（自由文字列で増やさない）。

| name | いつ | props | どこで書く |
|---|---|---|---|
| `guest_start` | ゲストを発行 | — | `api/guest/start` |
| `guest_gate` | ゲストが登録限定の機能で弾かれた | `app`（report / mentor / ai:mentor-chat …）, `via`（page / action / ai） | `lib/guest.ts`, `lib/usage.ts` |
| `guest_needsaccount` | 弾かれて /welcome の「登録すると使えます」を見た | — | `welcome/page.tsx` |
| `oauth_start` | OAuthを開始 | `provider`, `guest`（ゲストからか）, `mobile` | `api/auth/[provider]/start` |
| `oauth_result` | OAuthの結果 | `provider`, `outcome`（new / login / linked / promoted / already-linked / fail）, `reason`（failのみ）, `guest` | `lib/oauth-login.ts`, callback |
| `guest_promoted` | ゲストが本登録に昇格 | `provider` | `lib/oauth-login.ts` |

あわせて `User.promotedAt` を追加した（昇格日時）。`createdAt` との差が「お試しから登録までの日数」。

`guest_gate` の `app` は middleware が付けるヘッダ `x-en-pathname`（`PATHNAME_HEADER`）の先頭セグメント。
Server Action の POST もページURLに飛ぶので同じ経路で取れる。AI入口は `ai:<kind>`。

### 増やすとき
1. `track.ts` の `EVENT` と上の表に1行足す
2. props は「集計に使う値」だけ。人が書いた文章は入れない
3. ファネルの段にするなら `src/lib/analytics/stats.ts` の `guestFunnel` に足し、`stats.test.ts` を更新

## 2. `/admin/analytics` の読み方

- **VISITORS**: 日次ユニーク訪問（`UserVisit`）。ゲスト=pink / 登録済み=royal。ゲストの棒だけ伸びて
  登録済みが横ばいなら、ファネルを見る
- **GUEST FUNNEL**: 直近30日にゲストとして作られた人のうち、各行動をした**人数**（件数ではない）
  - 「2日目も来た」が低い → 初日の体験（育てて潜る）が弱い
  - 「登録限定に触れた」が低い → 登録の動機に出会えていない（遮断機能の露出を増やす）
  - 「登録案内を見た」が「触れた」より大きく低い → 弾かれた先で案内が出ていない（2026-09-10 修正済み。下記）
  - 「連携を始めた」→「登録完了」で減る → OAuth途中の失敗。右下の結果一覧で理由を見る
  - **既存アカウントと衝突（already-linked）** が出る → お試しのデータが宙に浮く。増えるならマージ導線を作る
- **RETENTION**: 登録週ごとの D1/D7/D30（登録からN日以上あとの訪問）。「—」は判定にはまだ早い
- **FEATURES**: 30日に各機能を使った人数。登録済みに対する割合で「使われていない機能」を見る

制約: イベントは導入日（画面に表示）以降しか無い。それ以前のゲストは中間の段が欠ける。
昇格済みユーザーの `promotedAt` も導入以降のみ。

### 2026-09-10 に見つけて直したハードル
登録限定ページはゲストを `/welcome?guest=needsaccount` に戻していたが、welcome はこのパラメータを
無視しており、**弾かれた理由も登録の導線も出さずLPをもう一度見せていた**（「ためしてみる」を押しても
`/` に戻るだけ）。ゲストでwelcomeに来たときは TRY を消し、「その機能は登録すると使えます／連携すると
引き継がれます」の UNLOCK 枠と「Googleで連携して登録」ボタンに切り替えた。効果は `guest_needsaccount`
→ `oauth_start(guest=true)` の落差で追う。

## 3. Vercel Web Analytics（公開ページ）

`src/components/public-analytics.tsx`。`beforeSend` で **/welcome, /u/, /q/, /contact, /join/ 以外は送らない**。
cookieを使わないので同意バナー不要。ログイン後のページは送らない（外部送信の最小化）。

有効化（1回・Vercel側）: プロジェクト → **Analytics** タブ → Enable。有効化するまでスクリプトは何も送らない。
見るもの: 流入元（Referrer）・UTM・LPのPV・国。**GA4 を入れる場合**は Search Console/広告連携が要るときだけ。
その際は外部送信の記載をプライバシーポリシーに足す。

## 4. Looker Studio → Neon（自由集計）

決まった画面で足りないときは Neon に**読み取り専用ロール**を作って Looker Studio の PostgreSQL コネクタで繋ぐ。
ハンドル名しか無いデータなので外に出しても安全だが、`Inquiry`（問い合わせ本文）と `AuthIdentity`（ハッシュ）は
念のため GRANT しない。

```sql
-- Neon の SQL Editor（direct 接続）で1回
CREATE ROLE bi_reader WITH LOGIN PASSWORD '<長いランダム文字列>';
GRANT CONNECT ON DATABASE neondb TO bi_reader;
GRANT USAGE ON SCHEMA public TO bi_reader;
GRANT SELECT ON
  "User", "UserVisit", "AppEvent", "AiUsage", "WeeklyReport", "QuizAttempt",
  "DungeonRun", "MentorSession", "RoleplaySession", "YomoyamaPost", "Purchase", "Encounter"
TO bi_reader;
```

Looker Studio: データを追加 → PostgreSQL → ホスト（Neon の pooled ホスト）・DB・`bi_reader`・パスワード、
**SSL を有効**にする。よく使う集計例:

```sql
-- ゲストの登録率（週別）
SELECT date_trunc('week', "createdAt") AS week,
       count(*) AS guests,
       count("promotedAt") AS promoted,
       round(100.0 * count("promotedAt") / count(*), 1) AS rate
FROM "User"
WHERE role = 'GUEST' OR "promotedAt" IS NOT NULL
GROUP BY 1 ORDER BY 1;

-- 弾かれた機能（30日）
SELECT props->>'app' AS app, count(*) FROM "AppEvent"
WHERE name = 'guest_gate' AND "createdAt" > now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;
```

注意: 無料枠の Neon は自動サスペンドするので最初の読み込みが遅い。

## 次の一手（データが溜まったら）
- ファネルの落差が「登録案内を見た→連携を始めた」なら、案内の文言・ボタンの位置を変えて2週比較
- 「既存アカウントと衝突」が月に数件出るなら、ゲストのデータを既存アカウントへマージする導線
- セッション単位の動線（どの順で画面を回ったか）まで見たくなったら PostHog を検討（いまの規模では過剰）
