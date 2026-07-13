# データモデル設計

スキーマ本体: [prisma/schema.prisma](../prisma/schema.prisma)

## 全体像

```
User ─┬─ Assignment ── Project（顧客名は clientAlias のみ・実名は持たない）
      │
      ├─ WeeklyReport ──── ReportAnalysis（AI解析結果 1:1）
      │        └────────── SkillSuggestion（AIのスキル更新提案）
      │
      ├─ EngineerSkill ── Skill（マスタ・aliasesで表記ゆれ吸収）
      │        └───────── SkillHistory（成長グラフ用の履歴）
      │
      ├─ ConditionAlert（Phase 2）
      ├─ MentorSession ── MentorMessage（Phase 3）
      └─ RoleplaySession ── RoleplayMessage / RoleplayScenario（Phase 4）
```

## 設計判断

### 週報とAI解析を分離（WeeklyReport / ReportAnalysis）
提出（人の行為）と解析（AIのジョブ）はライフサイクルが違う。解析は失敗・リトライ・モデル差し替えがありえるため、`status`（PENDING→RUNNING→DONE/FAILED）とコストログ（model, tokens）を持つ別テーブルにする。

### スキル更新は必ず SkillSuggestion を経由する
AIが直接 EngineerSkill を書き換えることはしない。ハルシネーション対策として、**AI提案 → 本人承認 → 反映**のフローを構造で強制する。承認時に `SkillHistory` へ履歴を積み、成長グラフと経歴書エビデンスの両方に使う。

`evidenceQuote` に週報からの引用を保持するのがポイント。「Reactレベル3の根拠は2026-W28の週報のこの記述」と辿れることが、単価交渉エビデンスの信頼性になる。

### コンディションは「2系統 + 乖離」
- `WeeklyReport.conditionSelf / workloadSelf` — 自己申告（毎週必ず取れる）
- `ReportAnalysis.conditionAi` — 文章トーンのAI解析
- `ReportAnalysis.divergence` — 両者の乖離。「☀️と申告しながら文章が沈んでいる」= 弱音を書けない状態のシグナル

アラートはスコアの絶対値ではなくトレンド（移動平均からの下降）で発火し、`ConditionAlert.trigger` に発火ルール名を記録する。

### 顧客情報を持たない
SESの機密対策として、DBに顧客実名を保存しない（`Project.clientAlias` のみ）。AI解析前のマスキング処理と合わせて二重の防御にする。

### pgvector は Phase 3 で導入
学習コンテンツのRAG（`LearningChunk` テーブル + vector列）は AIメンター実装時にマイグレーションで追加する。docker imageは最初から pgvector 入りを使用。

## スキルレベル定義（1-5）

| Lv | 定義 |
|---|---|
| 1 | 学習中・研修レベル |
| 2 | 指導のもとで実務可能 |
| 3 | 一人で実務可能 |
| 4 | 本番リリース経験あり・他者に指導可能 |
| 5 | 設計判断・技術選定をリードできる |

Lv4の「本番リリース経験」は単価+10万〜15万円の分水嶺（元資料より）なので、AIはこのキーワードを重点的に抽出する。
