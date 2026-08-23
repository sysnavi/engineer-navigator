---
name: mobile-release
description: iOS/Androidアプリ（Capacitorシェル）の再配布。再配布が必要かの判定→リリースノート生成→Android（CI）/iOS（Mac CLI）配布→配布点タグ→docs履歴更新まで。「アプリ配布」「TestFlight」「Firebase配布」「アプリ版を更新」を頼まれたら必ずこれ経由。引数: android / ios / both（省略時 both）
---

# モバイル再配布ワークフロー

`mobile/` は本番ドメインを包むだけのシェル。**Web側の変更はVercelデプロイで既存アプリにも
即反映される**ので、再配布が要るのは**ネイティブ側（`mobile/` 配下）が変わったときだけ**。
このskillはまず「本当に配る必要があるか」を判定し、必要なら配って記録を残す。

- Android は GitHub Actions「Android配布」で完結（**スマホ/クラウドセッションからも実行可**）
- iOS は Mac + Xcode が必須（クラウドセッションでは手順提示まで）
- 詳細・初回セットアップ・トラブルは docs/mobile-release.md

## 0. 環境と対象を確認する

```bash
uname                                   # Darwin = iOSも配れる / それ以外 = Androidのみ
git fetch -q origin && git log --oneline -1 origin/main
git tag -l 'android-vc*' 'ios-build*' | sort -V | tail -4   # 前回の配布点
```

- 引数が無ければ both。Darwin以外で ios/both を頼まれたら、Androidだけ進めて iOS は
  §4 の「クラウドからの場合」を案内する
- **配るのは origin/main の内容**。ローカルに未pushのコミットがあるなら先に /release

## 1. 再配布が必要か判定する

前回の配布点タグから origin/main までの `mobile/` 差分を見る:

```bash
LAST_ANDROID=$(git tag -l 'android-vc*' | sort -V | tail -1)
LAST_IOS=$(git tag -l 'ios-build*' | sort -V | tail -1)
git diff --stat "$LAST_ANDROID" origin/main -- mobile/ | tail -1   # Android
git diff --stat "$LAST_IOS" origin/main -- mobile/ | tail -1       # iOS
```

- **差分あり** → 再配布が必要。何が変わったか（プラグイン追加・権限・設定）を1行で報告
- **差分なし** → 「Web側の変更だけなので既存アプリで反映済み。再配布は不要」と報告して終了。
  ユーザーが「それでも配る」と言ったら進める（テスター招待のやり直し等の理由はある）
- 片方だけ差分がある（`mobile/android/` のみ等）なら、その OS だけ配るのを提案する

## 2. リリースノートを作る

前回配布点以降のコミットから、**テスター（利用者）向けの言葉**で3〜5項目・200字以内に起こす:

```bash
git log --no-merges --format='%s' "$LAST_ANDROID"..origin/main   # Android向け
git log --no-merges --format='%s' "$LAST_IOS"..origin/main       # iOS向け（TestFlightのテスト内容欄に使う）
```

- 内部用語（コミットの「skills化」「CI」「Prisma」等）は落とし、画面で何が変わるかだけ書く
- ネイティブ側の変更（音声入力プラグイン等）は「アプリを更新すると○○が使えます」と明記
- 末尾に「上書きインストールしてください」を付ける
- **案をユーザーに見せてから配る**（文言はそのままテスターへのメールに載る）

## 3. Android を配る（どこからでも可）

```bash
gh workflow run "Android配布" -f release_notes="<§2の文言>" -f distribute=true
sleep 15
RUN=$(gh run list --workflow "Android配布" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" --exit-status
gh run view "$RUN" --json number,headSha --jq '"run#\(.number) sha=\(.headSha[0:7])"'
```

- versionCode = **run番号 + 1**（ワークフロー内で採番）。成功ログの
  `uploaded new release 1.0.0 (N)` の N がそれ
- 成功したら配布点タグを打って push（タグはデプロイを起動しない）:
  ```bash
  git tag -a "android-vc<N>" <headSha> -m "Android配布 versionCode <N>（CI run #<番号>・<日付>）"
  git push origin "android-vc<N>"
  ```
- 失敗したら `gh run view "$RUN" --log-failed`。よくある原因: Secrets切れ（鍵JSON失効）、
  `testers` グループ未作成、Gradle/JDKの更新。docs/mobile-release.md のトラブル節を参照

## 4. iOS を配る（Macのみ）

```bash
.claude/skills/mobile-release/scripts/ios-upload.sh
```

- スクリプトが `cap sync` → archive → export(upload) まで行い、最後に
  `UPLOADED_BUILD=<N>` を出す。Build は Xcode が App Store Connect 上の最大+1 に自動採番
  （`manageAppVersionAndBuildNumber`）。pbxproj の `CURRENT_PROJECT_VERSION` も N に書き換わる
- 成功したら pbxproj の変更を §6 のコミットに含め、配布点タグを打って push:
  ```bash
  git tag -a "ios-build<N>" <origin/mainのsha> -m "iOS配布 1.0.0 (<N>)（TestFlight・<日付>）"
  git push origin "ios-build<N>"
  ```
- App Store Connect 側の処理（数分〜）が終わると内部テスターへ自動配布。
  外部テスター/テスト内容欄の更新は App Store Connect → TestFlight で行う（§2の文言を使う）
- **クラウドからの場合**: 「iOSはMacでしか上げられません。Macで
  `/mobile-release ios` を実行してください」と伝え、Androidの結果と§2のiOS向け文言を渡す
- 失敗したら `$TMPDIR/engnavi-ios-release/upload.log` の error 行を見る。
  「bundle version must be higher」は自動採番が効いていない（ExportOptionsを確認）、
  「No signing certificate」「not signed in」は Xcode → Settings → Accounts の再ログイン

## 5. テスターの確認（必要なとき）

- Android: `npx firebase-tools appdistribution:testers:list --project engnavi-app`。
  追加は `appdistribution:testers:add a@example.com --group-alias testers --project engnavi-app`
- iOS: App Store Connect → TestFlight → 内部グループ（App Store Connectユーザーである必要）

## 6. 記録を残す

1. docs/mobile-release.md の「配布履歴」行に今回を追記（日付・番号・CI run番号 or CLI）
2. 変更（docs + iOSなら pbxproj）を /feature の流儀でコミット:
   `モバイル配布 <日付>: iOS Build N / Android versionCode M`
3. push は /release で（タグは§3/§4で個別に push 済み）
4. ユーザーへの報告: 配った番号・テスターへの届き方・iOSの処理待ちの有無・
   「Web側だけの変更なら次回は再配布不要」の一言

## やってはいけないこと

- `mobile/` に差分が無いのに黙って配る（テスターに無意味な更新メールが飛ぶ）
- リリースノートをユーザーに見せずに配る
- Android をローカルで `./gradlew assembleRelease` して配る（versionCode がCIと衝突する。
  どうしても必要なら docs/mobile-release.md の「手動」節の採番ルールに従う）
- `agvtool` や Xcode GUI でのビルド番号手入力（CLI の自動採番と二重管理になる）
- `cap sync` を `CAP_SERVER_URL` 付きで実行したまま配る（ローカルURLが焼き込まれる）
