---
name: release
description: mainへのpush（=本番リリース）の手順。push前のゲート実行と、push後のCI見届け・失敗時の巻き取りまで。リリース・デプロイ・pushを頼まれたら必ずこれ経由
---

# リリースワークフロー

main への push は即 Vercel 本番デプロイ。CIはデプロイをブロックしない（並走する
事後の安全網）ので、**push前のゲートと push後の見届けの両方**がこの手順の本体。

## 1. 何をリリースするか確認する

```bash
git log --oneline origin/main..HEAD
git status --short
```

- 未コミットの変更が混ざっていないか、意図しないコミットが乗っていないか確認
- スキーマ変更（prisma/migrations の追加）が含まれる場合はその旨をユーザーに明示する
  （Vercelビルドが本番DBに `migrate deploy` を自動適用するため）

## 2. push前ゲート

環境検知（`nc -z localhost 5433`）で分岐:

- **DBあり（ローカル）**: `npm run check:release` を実行。通らなければ push しない
- **DBなし（クラウド）**: `npm run check` を実行。E2EはCIに委任する。
  この場合、**push後のCI見届けは省略不可**

## 2.5 クラウドセッションでmainに直接pushできない場合

ブランチにpushしてPRを作る（CIはPRでも走る）。その場合このskillの役割は
「PR作成 + CIグリーンの確認 + ユーザーへのマージ依頼」まで。
マージ（=本番リリース）の判断はユーザーがGitHub上で行う。

## 3. push と CI見届け

```bash
git push origin main
gh run watch $(gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

- **CI成功**: リリース完了をユーザーに報告（コミット内容の1行サマリ付き）
- **CI失敗**:
  1. `gh run view --log-failed` で原因を特定
  2. すぐ直せるなら修正して再度 /feature → /release（fix-forward）
  3. すぐ直せない・本番に実害がありそうなら `git revert` を push して戻す
  4. どちらの場合も、何が起きて何をしたかをユーザーに報告する
  （CIはブロックしないため、失敗を放置すると壊れたものが本番に残る。放置は禁止）

## 4. 本番確認（変更内容に応じて）

ユーザー向けの挙動を変えた場合は、本番URLで該当画面をひと目確認できるなら行う。
確認手段がない環境では「CI成功まで確認済み・本番の目視は未」と正直に報告する。
