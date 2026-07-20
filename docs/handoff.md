# 引き継ぎノート（作業再開時にまず読む）

最終更新: 2026-07-18

別エージェント／別セッションで作業を継続するための現在地メモ。
設計思想は [roadmap.md](roadmap.md) / [weekly-report.md](weekly-report.md) / [data-model.md](data-model.md) / [../AGENTS.md](../AGENTS.md) に、進捗チェックボックスは roadmap.md にある。ここには**コードから読み取れない現在地**だけを書く。

## 方針転換（2026-07-17）: 個人サービスとしてリリースする

シスナビ社内ツールではなく、まず**個人向けサービス**として出す。適用済み: 週報の営業相談チェック削除・設問7を「AIメンターへの共有・相談」に・経歴書はPDF直接ダウンロード(/api/resume/pdf, pdfmake+IPAexゴシック同梱)・**週報インタビューモード**(/report?mode=interview: AIが1問ずつ聞いて7設問ドラフトに変換、部分更新で既存記入を消さない)。未決: /condition(営業・管理者向け)の扱い、同意ゲート文言、認証。詳細はメモリ personal-service-pivot。

## いま動くもの

Phase 0（基盤）+ Phase 1 の縦切りが実装済み。**実 ANTHROPIC_API_KEY で end-to-end 動作確認済み**（2026-07-13）。

```
週報を書く(/report) → 提出 → AI解析 → SkillSuggestion生成
   → 本人が承認/却下(/skills) → EngineerSkill反映 + SkillHistory記録
```

画面は15+: `/`(ホーム) / `/report`(週報・自動保存) / `/skills`(スキルマップ＋レーダー＋成長ログ) / `/resume`(経歴書・印刷=PDF) / `/condition`(営業・管理者向け) / `/mentor`(AIメンター) / `/plan`(資格学習プラン) / `/quiz`(良問バンク=四択・腕試し) / `/roleplay`(役割シミュレーター) / `/yomoyama`(現場のよもやま掲示板) / `/discover`(発見) / `/u/[handle]`(公開プロフィール) / `/admin`(管理者ダッシュボード) / `/welcome`(招待制LP) / `/mypage`(きせかえ＋共有設定)。

**Phase 7 ゲーム性の土台（2026-07-18, commit 77302e5）:**
- **TOPヒーロー**: 「がんばりは、ぜんぶ経験値になる。」＋つながりパイプライン＋PLAYER_FILEカード（Lv/EXPバー/進化予告/今週のかつどう）。
- **EXP導出** `src/lib/exp.ts`: 既存データの集計から毎回導出（過去の頑張りも遡ってEXP化）。重み変更はEXP_WEIGHTSだけ。レベル=平方根カーブ、進化段階はレベルから決定的（保存不要）。
- **全活動EXP化（2026-07-18, commit 4c7f69a）**: 全16ソース（週報/公開/スキル承認/演習/腕試し/作問/良問/評価/相談/プラン作成・進行/よもやま/プロフィール公開/訪問/連続ボーナス）。**腕試しは1問につき初回のみ**（解き直しファーミング対策・実証済み）。訪問だけ `UserVisit` テーブル（1日1行・layoutでskipDuplicates記録）、🔥連続日数をカードに表示。**新しいEXP対象の機能を足したら exp.ts にもソースを足すこと。**
- **PixelAvatar** `src/components/pixel-avatar.tsx`: 段階別スプライトをCSS gridで描画（画像不要・パレット変数準拠）。
- **継承（転生）システム（2026-07-18, Issue #1）**: マイスター(Lv12)到達で「卵を産む」が解放。データは一切消さず `AvatarGeneration` に世代の墓標を1行残し、現世代EXP=「生涯EXP−スナップショット+遺産(前世代EXPの5%)」で導出（0クランプ必須・重み変更ドリフト対策）。**遺伝子** `src/lib/genes.ts`: 世代内で最も稼いだ活動カテゴリ→優性/2位→劣性（6種・決定的・乱数なし）、組み合わせ称号＋純血統(同優性3代)。**継承限定形態**: きんのたまご(gen2+ Lv1)/けんじゃ(gen2+ Lv14)/でんせつ(gen3+ Lv16)＝周回が最強への道。UI: マイページ INHERIT.sys（2段階確認モーダル→孵化演出→家系図）、TOPカードに世代・血統称号・遺伝子色オーラ枠、公開面(/u・/discover)に世代バッジ（世代数のみSELECT、コンディション鉄則は維持）。**新しいEXPソースを足したら exp.ts の EXP_WEIGHTS に加えて genes.ts の SOURCES 割当も更新すること。**
- 将来のローグライク（潜れる深さ=Lv）・レアペット・作業環境コレクションはこの上に乗せる。継承の世代数・遺伝子はローグライク(#3)の深度ボーナスの入力になる予定。
- **ローグライクダンジョン /dungeon（2026-07-19, Issue #3）**: 育てたアバターの**フルオート潜行**。サーバーが5ステップ（出発/イベント×3/結果）を`performDive`で一括確定し`DungeonRun.steps`に保存、クライアントは**紙芝居再生**するだけ（`src/app/dungeon/player.tsx`・AIトークンゼロ）。基礎深度=f(現世代Lv,世代数,継承限定形態)で#1の周回報酬を回収。**コンテンツは `src/lib/dungeon/content.ts` のTSマスタに足すだけ**（モンスター12+ボス2/ガジェット31=N〜UR/罠8/癒やし6、ID文字列参照でマイグレーション不要、引退はretired:true）。ドット絵は`scripts/gen-dungeon.py`（文字マップ・25スプライト）。**挑戦回数の哲学: 1日1回+週報提出週のみ+1回。タイマー回復は意図的に無し**（依存させない・制限は「アバターの休養💤」として表示=休むのも仕事のうち）。`DungeonRun.slot`("d:日付"/"b:週開始")の@@uniqueが構造で強制。遺伝子は`GENE_DUNGEON_MODS`で得意分野化（罠回避/宝発見等）。週報提出週は「週報の盾」で敗走1回無効。**ダンジョンはEXP対象外**（意図的・遊びは消費でありファーミング誘発を避ける）。コレクションは`OwnedGadget`（1種1個・図鑑形式で未所持は???表示）。
- **UIシェル切替: デスクトップOS風UI（2026-07-20, feature/desktop-shell）**: メニュー肥大化の整理として松案を実装。**旧UIは削除せず「クラシックモード」として共存**（ロールバックはgitでなく設定で）。`resolveShell`（src/lib/shell.ts）= User.uiShell（マイページSHELL.cfgで本人切替）→ `UI_SHELL_DEFAULT` env（未設定=classic）。機能一覧は **src/lib/apps.ts の APPS レジストリが単一ソース**（クラシックナビ/スタートメニュー/デスクトップ/ドックすべてここから生成。機能追加は1件足すだけ）。desktop時: ホーム=デスクトップ（4グループ点線ゾーン+PixelIconアイコン+TODAY.sys案内所+PLAYER_FILE）、下部タスクバー（▶スタートメニュー・現在地チップ・⛏🔥トレイ）。モバイルは同コンポーネントがドック+全画面ドロワーに変形。アイコンは src/components/pixel-icon.tsx（文字マップ・画像不要）。getPlayerStats はReact cacheでリクエスト内メモ化（layout+ページの二重呼び出し対策）。デザインモック: claude.ai artifact e77cc6d5（PC/モバイル両モード）。
- **LOADING宇宙人（2026-07-19, Issue #7）**: 20種（10形状×2カラー）× 通常/にっこり差分 = 40PNG（`public/aliens/`）。原本は `scripts/gen-aliens.py` の文字マップ（1文字=1ドット、実行で再生成、一覧は docs/design/aliens-sheet*.png）。`<LoadingAlien>`（src/components/loading-alien.tsx）がランダム1体+3アクション（ぱたぱた/にっこり/ジャンプ、globals.cssのalien-*）を抽選、連続同キャラはsessionStorageで回避、reduced-motionは静止。**塩梅ルール: 体感1秒超の待ちだけに出す** — ルート遷移(loading.tsx)とAI待ち(sending-overlay)のみ。保存等の短い待ちには出さない（ガチャの新鮮味維持）。#2のレアキャラ来訪・図鑑と設定を共有できる。

**Phase 5-6 追加機能（2026-07-17）:**
- **管理者ダッシュボード /admin**（admin限定・非管理者404）: 全ユーザー分析(サマリ6枚+ユーザー表)＋BAN(停止/復帰)＋招待発行/失効を集約。マイページからは撤去。
- **良問バンク /quiz**: ユーザーが四択を作り皆で解いて育てる問題集。採点はサーバー(submitQuizAnswer)でローカル完結＝**AIトークン消費ゼロ**、正解はクライアントに渡さない。評価(0-10)は`rateQuiz`がトランザクションで**全員分を集計**(QuizQuestion.ratingSum/Count)＝1問の良問スコアは総意で決まる。QuizQuestion/QuizRating(@@unique questionId+userId)/QuizAttempt。
- **よもやま掲示板 /yomoyama**: ハンドル名で現場の話を投稿。投稿前にAI門番(src/lib/ai/moderation.ts)が①個人特定 ②会社/案件固有名 ③実在著名人 ④誹謗中傷/荒らし を検知しブロック(本文はデータ扱いでインジェクション耐性)。postYomoyamaは`assertAiAllowed`通過→門番→OKだけ保存、ブロック時は理由と修正案を返す。AIチェック失敗時は安全側でブロック。
  - **ソーシャル拡張（Issue #4, 2026-07-19）**: いいね(YomoyamaLike・postId+userId unique・楽観更新・非AIの軽量レート制限40/分)、コメント(YomoyamaComment・**投稿と同じAI門番**を通す=`addComment`)、投稿者の**コメント可否トグル**(YomoyamaPost.allowComments)、管理者の**ソフト削除**(deletedAt+deletedById・tombstone表示)。**EXPは対象外**(将来足すならファーミング対策必須)。UI: like-button.tsx / comment-form.tsx / page.tsx。
**Phase 1〜4 完了 + 会社独自ノウハウのRAG化 完了（2026-07-14）**。8bit/Y2Kデザイン + きせかえ5種。コンディション検知は src/lib/condition.ts（急落/下降トレンド/乖離/高負荷/相談フラグ、未クローズ中は重複発火しない）。デモ: /mypage の DEBUG.sys で営業に切替→ /condition。デモ履歴はseed投入済み（engineer2@… は要注意の物語）。

## 再開手順

```bash
cd /Users/sysnavi_admin/Projects/sysnavi/engineer-navigator
docker compose up -d          # DB(port 5433)。既にvolume/migrate/seed済み
npm run dev                   # http://localhost:3000
open docs/design/styletile.html   # デザイン方向の見本（ブラウザで直接開ける）
```

## 会社独自ノウハウのRAG（このアプリの差別化の核）

AIの提案・評価を一般知識ではなく**会社のノウハウ**で裏付ける。`KnowledgeChunk` を kind で分け、各AI呼び出し前に該当kindだけを検索して system に注入する（用途外の知識が混ざらないようにするため kind 絞り込みが重要）。

```bash
# .env に VOYAGE_API_KEY（https://www.voyageai.com/）を設定してから:
npm run ingest:knowledge      # content/knowledge/<kind>/*.md を埋め込み投入
```

| kind ディレクトリ | 用途（注入先） |
|---|---|
| `learning/` | メンター・学習プラン |
| `skill-criteria/` | 週報のスキル抽出（analyzeReport） |
| `condition-playbook/` | コンディションのトーン解析・シグナル判断 |
| `role-definition/` | 役割シミュレーターの評価 |
| `rate-evidence/` | 経歴書の単価キーワード（現状は highlight.tsx の配列と対応させる運用） |

- ヘッダ `# source:` `# topic:` `# url:` 付きの .md を置いて再ingestするだけで差し替え可能（booknavi研修資産・社内規程の流用先）
- VOYAGE_API_KEY 未設定・該当なしなら全機能が従来どおり動く（RAGをスキップするだけ）
- 距離しきい値は実測ベース: 学習=0.5 / ノウハウ=0.7（src/lib/ai/retrieval.ts のコメント参照）

デモユーザー（cookie `dev-user` で切替、デフォルト engineer@sysnavi.co.jp）:
`admin@sysnavi.co.jp` / `sales@sysnavi.co.jp` / `engineer@sysnavi.co.jp`

## Git / リポジトリ

- リモート: https://github.com/sysnavi/engineer-navigator （origin/main 追跡済み）
- 初回コミット 90721d1 済み。author は tsuyoshi.shimada@sysnavi.co.jp に修正済み（グローバル git 設定も同アドレスに変更済み）
- `.env`（APIキー）と `.claude/`（マシン固有パス）は gitignore 済み

## デザイン方向（2026-07-13 確定）

**フル 8bit / Y2K / レトロGUI で振り切る。** 由来は社員総会プレゼン資料の p59〜75（午後アクティビティ区画）。
見本: [design/styletile.html](design/styletile.html)（このリポジトリ内・ブラウザで直接開ける）

- パレット: ロイヤルブルー #004AAD（枠・タイトルバー）/ #2A6FD6 / スカイ #5DADE2 / ペリウィンクル #C1DBFF / 方眼青 #D7E7F4 / ライラック #F9ECFD / **ホットピンク #F24E9C は「行動」ボタン専用** / レモン #FFD84D / ネイビー #12235F（線と文字）
- モチーフ: レトロOSウィンドウ（`週報.exe` `SKILL_MAP.sav`）/ 方眼紙デスクトップ / ピクセル見出し＋可読な本文 / ゲーム語彙（LEVEL UP・ACHIEVEMENT）/ スキルLv＝光るブロック
- 技術: アプリ本体は DotGothic16 (next/font) でピクセル見出し・本文は Hiragino 系（canvasドット化はアーティファクト見本のみ）。トークンとパレットは globals.css、共通部品は src/components/retro.tsx
- 2026-07-14 確定: ドット解像度は現行 / ホットピンク=行動専用 / スキルLv=光るブロック / パレット5種（固定色: ピンク・レモン）

## 次の一手（優先順）

1. **会社独自ノウハウのRAG化**（ユーザー最重要要望・機能完成後に着手と合意）: 全AI提案/フィードバックを社内ノウハウで裏付ける。既存 LearningChunk RAG基盤を一般化。詳細はメモリ [[knowhow-rag-direction]]
2. Phase 4 仕上げ: ロールプレイ実施履歴をスキルマップ/経歴書のエビデンスに載せる
3. 運用: 週次ジョブの本番cron化 / Slack Webhookの実チャンネル / 本番SSO / 8bit演出磨き込み

## 注意点（ハマりどころ）

- 単発 tsx スクリプトは **先頭で `import "dotenv/config"`** を書かないと DATABASE_URL 未設定で 5432 に繋ぎに行く（このDBは5433）。top-level await 不可なので async main で包む
- Prisma 7 系。client出力は `src/generated/prisma`（gitignore済み、`npx prisma generate` で再生成）。DB接続は `@prisma/adapter-pg` 経由（`src/lib/db.ts`）
- **認証は招待リンク方式**（PII非保持）: `Invite.token` がログイン資格。`/join/<token>` で引換→`en_session` cookie→`getCurrentUser`(src/lib/auth.ts)がInvite→Userを解決。招待ユーザーは `User.email` が null（メール/氏名を持たない）。ローカルは `DEV_LOGIN_ENABLED=true` で従来のdev-cookie切替＆ゲート無効。本番はこの変数を**設定しない**（middlewareが未認証を/welcomeへ誘導）。管理者はマイページADMINで招待発行/失効。ブートストラップは `ADMIN_INVITE_TOKEN`＋seed→`/join/<token>`。将来のSSO化もgetCurrentUser差し替えで可能
- デプロイは Vercel + Neon（[DEPLOY.md](../DEPLOY.md)）。build/postinstallで `prisma generate`（生成clientはgitignore）。マイグレーションは direct 接続で `prisma migrate deploy`
- /report 画面の「設問間の大きな空白」はアプリのバグではない（ブラウザプレビューペインが0幅で描画したアーティファクト。実ページは正常）
- **マイグレーション運用**: 非対話シェルでは `migrate dev` が使えない（seed実行や@unique制約の確認プロンプトで止まる）。additive変更は「手書き migration.sql + `migrate deploy`」で適用する。適用済みmigrationを手編集するとチェックサム不整合で`migrate dev`が全面停止→`_prisma_migrations.checksum`を現ファイルのsha256に更新して整合（resetは全データ消えるので厳禁）
- **公開共有の鉄則**: 公開ビュー(/u/[handle], /discover, src/lib/public-profile.ts)にコンディション(設問1/2/5/7・スコア)を絶対に含めない。SELECTすらしない設計を維持すること
- **AIレート制限/停止**: 全AI呼び出しは `src/lib/usage.ts` の `assertAiAllowed(userId, kind)` を**トークン消費前に**通す（3ストリーミングRoute + 週報解析/メンター提案/学習プラン/ロールプレイ開始・評価/インタビュー要約）。1分15回・24h300回で拒否、24h600回超で自動停止（`AI_RATE_PER_MINUTE`/`AI_RATE_PER_DAY`/`AI_AUTO_SUSPEND_PER_DAY`で調整）。新しいAI入口を足したら必ずこのガードを通すこと。停止/復帰は管理者のみ（マイページADMINパネル、`setUserSuspended`）

## 未実装・今後

- 会社独自ノウハウのRAG化（[[knowhow-rag-direction]]・最重要）
- Phase 4: ロールプレイ実施履歴のスキルマップ/経歴書反映
- 運用系: 本番cron/Slack実チャンネル/Google SSO
- ポート注意: 3000が別プロジェクトのdockerコンテナ(inno_work)に取られることがある。launch.jsonは autoPort:true 済みなので別ポートで起動する
