# 引き継ぎノート（作業再開時にまず読む）

最終更新: 2026-07-17

別エージェント／別セッションで作業を継続するための現在地メモ。
設計思想は [roadmap.md](roadmap.md) / [weekly-report.md](weekly-report.md) / [data-model.md](data-model.md) / [../AGENTS.md](../AGENTS.md) に、進捗チェックボックスは roadmap.md にある。ここには**コードから読み取れない現在地**だけを書く。

## 方針転換（2026-07-17）: 個人サービスとしてリリースする

シスナビ社内ツールではなく、まず**個人向けサービス**として出す。適用済み: 週報の営業相談チェック削除・設問7を「AIメンターへの共有・相談」に・経歴書はPDF直接ダウンロード(/api/resume/pdf, pdfmake+IPAexゴシック同梱)。未決: /condition(営業・管理者向け)の扱い、同意ゲート文言、認証。詳細はメモリ personal-service-pivot。

## いま動くもの

Phase 0（基盤）+ Phase 1 の縦切りが実装済み。**実 ANTHROPIC_API_KEY で end-to-end 動作確認済み**（2026-07-13）。

```
週報を書く(/report) → 提出 → AI解析 → SkillSuggestion生成
   → 本人が承認/却下(/skills) → EngineerSkill反映 + SkillHistory記録
```

画面は9つ: `/`(ホーム) / `/report`(週報・自動保存) / `/skills`(スキルマップ＋レーダー＋成長ログ) / `/resume`(経歴書・印刷=PDF) / `/condition`(営業・管理者向け) / `/mentor`(AIメンター) / `/plan`(資格学習プラン) / `/roleplay`(役割シミュレーター) / `/mypage`(きせかえ＋開発用ユーザー切替)。
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
- 認証は本番未対応（開発用cookie方式）。本番は Google Workspace SSO(sysnavi.co.jp限定) に置換予定
- /report 画面の「設問間の大きな空白」はアプリのバグではない（ブラウザプレビューペインが0幅で描画したアーティファクト。実ページは正常）

## 未実装・今後

- 会社独自ノウハウのRAG化（[[knowhow-rag-direction]]・最重要）
- Phase 4: ロールプレイ実施履歴のスキルマップ/経歴書反映
- 運用系: 本番cron/Slack実チャンネル/Google SSO
- ポート注意: 3000が別プロジェクトのdockerコンテナ(inno_work)に取られることがある。launch.jsonは autoPort:true 済みなので別ポートで起動する
