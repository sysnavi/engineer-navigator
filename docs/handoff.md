# 引き継ぎノート（作業再開時にまず読む）

最終更新: 2026-07-13 深夜

別エージェント／別セッションで作業を継続するための現在地メモ。
設計思想は [roadmap.md](roadmap.md) / [weekly-report.md](weekly-report.md) / [data-model.md](data-model.md) / [../AGENTS.md](../AGENTS.md) に、進捗チェックボックスは roadmap.md にある。ここには**コードから読み取れない現在地**だけを書く。

## いま動くもの

Phase 0（基盤）+ Phase 1 の縦切りが実装済み。**実 ANTHROPIC_API_KEY で end-to-end 動作確認済み**（2026-07-13）。

```
週報を書く(/report) → 提出 → AI解析 → SkillSuggestion生成
   → 本人が承認/却下(/skills) → EngineerSkill反映 + SkillHistory記録
```

画面は3つ: `/`(ホーム) / `/report`(週報フォーム) / `/skills`(スキルマップ＋AI提案承認)。
確認済みの実績: FAILED だった解析を実キーで再実行 → DONE、提案5件生成、/skills に承認UIごと正常表示。

## 再開手順

```bash
cd /Users/sysnavi_admin/Projects/sysnavi/engineer-navigator
docker compose up -d          # DB(port 5433)。既にvolume/migrate/seed済み
npm run dev                   # http://localhost:3000
open docs/design/styletile.html   # デザイン方向の見本（ブラウザで直接開ける）
```

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
- 技術: display文字は canvas ニアレストネイバー拡大でドット化（日本語もOK・Webフォント不要）。本文は Hiragino 系のまま
- ユーザーへの確認待ち: ①ピクセル化の粒度 ②ホットピンクの使用範囲 ③スキルLvのブロック表現の是非

## 次の一手（優先順）

1. **スタイルタイルのフィードバック反映** → カラートークン（Tailwind @theme）化
2. **A: Phase 1 残タスクを8bitデザインで実装**（この順で合意済み: C調査→B初回コミット→A残タスク。C/Bは完了）
   - スキルマップのレーダーチャート／成長グラフ（SkillHistory可視化）
   - 経歴書ビュー + 営業向けエクスポート
   - 単価交渉キーワードの自動ハイライト（8bit実績解除演出と相性◎）
   - 週報の自動保存
3. Phase 2: コンディションダッシュボード

## 注意点（ハマりどころ）

- 単発 tsx スクリプトは **先頭で `import "dotenv/config"`** を書かないと DATABASE_URL 未設定で 5432 に繋ぎに行く（このDBは5433）。top-level await 不可なので async main で包む
- Prisma 7 系。client出力は `src/generated/prisma`（gitignore済み、`npx prisma generate` で再生成）。DB接続は `@prisma/adapter-pg` 経由（`src/lib/db.ts`）
- 認証は本番未対応（開発用cookie方式）。本番は Google Workspace SSO(sysnavi.co.jp限定) に置換予定
- /report 画面の「設問間の大きな空白」はアプリのバグではない（ブラウザプレビューペインが0幅で描画したアーティファクト。実ページは正常）

## 未実装（フェーズ別）

- Phase 1 残: レーダーチャート／成長グラフ、経歴書ビュー、単価キーワードハイライト、週報の自動保存
- Phase 2: コンディション検知（トレンド検知ロジック・ダッシュボード・アラート対応フロー）
- Phase 3: AIメンター（pgvectorでRAG。研修資産 booknavi/docs/training のRAG化を検討）
- Phase 4: 役割シミュレーター
