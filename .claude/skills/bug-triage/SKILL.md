---
name: bug-triage
description: 日次バグトリアージ。機能ツアー（全画面一周）で検出した不備を「軽微なら修正PR / そうでなければ診断のみ」に振り分け、Slack #engineer-navigator に報告する。CIの定期実行（.github/workflows/bug-triage.yml）と手元の手動実行の両方で使う
---

# バグトリアージ

入力は `tour-results/failures.json`（機能ツアーの失敗一覧。scripts/triage/report.ts が生成）。
1件ずつ「軽微か」を判定し、軽微なら **mainから派生したブランチで修正→検証→PR→Slack**、
軽微でなければ **診断だけをSlackのスレッドに返す**。判断に迷ったら軽微でない側に倒す。

## CIでの前提（.github/workflows/bug-triage.yml から呼ばれたとき）

- 対話相手はいない。確認を求めず、この skill の判定基準で決めて進める
- 機能ツアーは実行済み。Slack への不備報告（1件=1投稿・キャプチャ付き）も投稿済み
- DB（localhost:5433）・Playwright（chromium）・gh（GH_TOKEN）・git のユーザー設定は準備済み
- Slack は scripts/triage/slack.ts 経由で投稿できる（SLACK_BOT_TOKEN 未設定なら標準出力）
- 手元（この skill を手動で呼んだとき）は 0. のコマンドでツアーと報告を先に回す

## 0. 入力を用意する

```bash
test -f tour-results/failures.json || (npm run test:tour; npm run triage:report)
cat tour-results/failures.json
```

各要素: `id`（ツアーの識別子 = ブランチ名の元）/ `title` / `projects`（desktop, mobile）/
`error` / `screenshot`（失敗時のキャプチャ）/ `slackTs`（報告投稿のts。スレッド返信先）/
`knownPr`（同じidの修正PRが未マージ。**あればスキップ**して次へ）。

失敗が0件なら何もせず終了。

## 1. 原因を特定する

- `tour-results/artifacts/` の trace（`npx playwright show-trace` は使えないので zip 内の
  `trace.trace` を読むか、`error` とキャプチャから判断する）
- 該当のツアーは `tests/tour/tour.spec.ts` で id を検索。触っている画面・操作が分かる
- 再現は単体で回せる（DBは使い捨て・実APIは呼ばない）:
  ```bash
  TOUR_ONLY=<id> npm run test:tour
  ```
- **ツアー側の不備**（セレクタ古い・仕様変更に追従していない）の可能性も必ず検討する。
  アプリの挙動が仕様どおりでテストが古いなら、直すのはテストの方（その旨をPRに書く）

## 2. 「軽微」の判定基準

全部を満たすものだけ軽微。1つでも外れたら「軽微でない」として 4. へ。

- [ ] 原因が1〜2ファイルに閉じている（コンポーネント・ページ・純ロジック・ツアー自体）
- [ ] 差分が概ね 50 行以内で済む
- [ ] `prisma/schema.prisma` / migrations に触らない
- [ ] 認証・権限・課金・AIレート制限・コンディション（労務データ）のロジックに触らない
- [ ] 仕様の解釈が要らない（「明らかに壊れている」であって「こう変えたい」ではない）。
      迷ったら docs/（roadmap / weekly-report / data-model）を読み、それでも決まらなければ軽微でない
- [ ] AGENTS.md の決まりごと（LLMは src/lib/ai/client.ts 経由・EngineerSkill直書き禁止・
      顧客実名禁止・音声は src/lib/speech/ 経由）を破らずに直せる

## 3. 軽微なら修正する（1件につき1ブランチ・1PR）

```bash
git fetch origin main
git checkout -B triage/<id> origin/main      # 必ず main から派生（前の修正ブランチに積まない）
```

1. 修正する。無関係な変更を混ぜない（別の不備は別のPR）
2. 検証:
   ```bash
   npm run check                              # 型 + lint + ユニット（必須）
   TOUR_ONLY=<id> npm run test:tour           # 該当ツアーが通ること
   ```
   通ったら `tour-results/screens/<id>-desktop.png`（mobileがあれば `-mobile.png` も）が
   **改善後キャプチャ**。これをSlackに添付する
3. 影響が他画面に及びそうなら `npm run test:e2e`（スモーク）も回す
4. コミット（メッセージは「エリア: 何をどうした（なぜ）」・日本語・既存 git log の流儀）:
   ```bash
   git add -A && git commit -m "<エリア>: <修正内容>（日次トリアージ <id>）

   Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
   git push -u origin triage/<id>
   ```
5. PR作成（base=main）。本文に「症状 / 原因 / 修正 / 検証（実行したコマンド）/ 元の報告
   （Slack ts か run URL）」を書く:
   ```bash
   gh pr create --base main --head triage/<id> --title "<コミット1行目>" --body-file <(cat <<'EOF'
   ## 症状
   ...
   ## 原因
   ...
   ## 修正
   ...
   ## 検証
   - npm run check ✅
   - TOUR_ONLY=<id> npm run test:tour ✅（改善後キャプチャは Slack 参照）

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )
   ```
6. Slackに **PRリンク + 改善後キャプチャ** を投稿（本文にidと1行の修正内容）。
   報告投稿のスレッドにも一言返して紐づける:
   ```bash
   npx tsx scripts/triage/slack.ts --text "🔧 [<id>] 修正PRを作成しました: <PR URL>
   <修正内容1行>（検証: npm run check + 該当ツアー再実行）" --file tour-results/screens/<id>-desktop.png
   npx tsx scripts/triage/slack.ts --thread "<slackTs>" --text "修正PR: <PR URL>"
   ```
7. `git checkout origin/main --detach` で main に戻ってから次の不備へ（作業ツリーを汚さない）

## 4. 軽微でなければ診断を返す

修正せず、報告投稿のスレッドに「原因の見立て / 影響範囲 / 軽微でないと判断した理由 /
人が着手するときの入口（ファイル・関数）」を返す:

```bash
npx tsx scripts/triage/slack.ts --thread "<slackTs>" --text "🔍 [<id>] 自動修正の対象外（<理由>）
見立て: ...
入口: src/..."
```

`slackTs` が無い（Slack未設定のdry-run）ときは同じ内容を標準出力に出す。

## 5. 終了時

- 何件を修正PRにし、何件を診断のみにしたかを1行でまとめて出力する（CIログ用）
- main には **絶対に直接コミット・pushしない**。マージは人が GitHub 上で判断する
- 途中で予算・ターン上限に達したら、作りかけのブランチを push せずに終了する
  （中途半端なPRを出さない。翌日のツアーが再検出して仕切り直す）
