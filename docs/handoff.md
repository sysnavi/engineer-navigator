# 引き継ぎノート（作業再開時にまず読む）

最終更新: 2026-07-13

別エージェント／別セッションで作業を継続するための現在地メモ。
設計思想は [roadmap.md](roadmap.md) / [weekly-report.md](weekly-report.md) / [data-model.md](data-model.md) / [../AGENTS.md](../AGENTS.md) に、進捗チェックボックスは roadmap.md にある。ここには**コードから読み取れない現在地**だけを書く。

## いま動くもの

Phase 0（基盤）+ Phase 1 の縦切りが実装済み・ブラウザで提出フローまで動作確認済み。

```
週報を書く(/report) → 提出 → AI解析 → SkillSuggestion生成
   → 本人が承認/却下(/skills) → EngineerSkill反映 + SkillHistory記録
```

画面は3つ: `/`(ホーム) / `/report`(週報フォーム) / `/skills`(スキルマップ＋AI提案承認)。

## 再開手順

```bash
cd /Users/sysnavi_admin/Projects/sysnavi/engineer-navigator
docker compose up -d          # DB(port 5433)。既にvolume/migrate/seed済み
npm run dev                   # http://localhost:3000
```

デモユーザー（cookie `dev-user` で切替、デフォルト engineer@sysnavi.co.jp）:
`admin@sysnavi.co.jp` / `sales@sysnavi.co.jp` / `engineer@sysnavi.co.jp`

## 注意点（ハマりどころ）

- **`.env` の `ANTHROPIC_API_KEY` が未設定**。このため週報提出時のAI解析は必ず `ReportAnalysis.status=FAILED` になる。提出自体は成功する設計（異常系は確認済み）。キーを入れれば解析→提案フローが通る。これが次の最優先タスク。
- **git init 済みだが未コミット**。初回コミットはまだ。
- Prisma 7 系。client出力は `src/generated/prisma`（gitignore済み、`npx prisma generate` で再生成）。DB接続は `@prisma/adapter-pg` 経由（`src/lib/db.ts`）。
- 認証は本番未対応（開発用cookie方式）。本番は Google Workspace SSO(sysnavi.co.jp限定) に置換予定。

## 次の一手（優先順）

1. `.env` に `ANTHROPIC_API_KEY` を設定 → 実LLMでスキル抽出の精度確認、`src/lib/ai/analyzeReport.ts` のプロンプト調整
2. スキルマップのレーダーチャート・時系列の成長グラフ（`SkillHistory` を可視化）
3. 初回 git コミット
4. Phase 2: コンディションダッシュボード（営業・管理者向け）。週報パイプラインに解析を1つ足すだけで成立する設計

## 未実装（フェーズ別）

- Phase 1 残: レーダーチャート／成長グラフ、経歴書ビュー、週報の自動保存
- Phase 2: コンディション検知（トレンド検知ロジック・ダッシュボード・アラート対応フロー）
- Phase 3: AIメンター（pgvectorでRAG。研修資産 booknavi/docs/training のRAG化を検討）
- Phase 4: 役割シミュレーター
