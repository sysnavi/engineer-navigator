# モバイルアプリ配布ガイド（TestFlight / Firebase App Distribution）

`mobile/` は Capacitor 製のシェルアプリ。**アプリ本体はサーバー（本番ドメイン）にあり、
シェルはそれをWebViewで読み込むだけ**。Web側をデプロイすればアプリの中身も即座に更新される
（ストア再審査が要るのはネイティブ側=シェルを変えたときだけ）。

- appId: `jp.engnavi.app`（iOS Bundle ID / Android applicationId 共通）
- 接続先: `mobile/capacitor.config.ts` の `PROD_URL`

## 日常の開発コマンド

```bash
cd mobile
npm install                 # 初回のみ
npm run sync                # 本番ドメイン向けに焼き込み
npm run sync:local          # ローカル検証（iOSシミュレータ → localhost:3000）
npm run sync:local-android  # ローカル検証（Androidエミュレータ → 10.0.2.2:3000）
npm run open:ios            # Xcodeで開く
npm run open:android        # Android Studioで開く
npm run assets              # public/icon-512.png からアイコン・スプラッシュ再生成
```

> ⚠️ `sync` は接続先URLをネイティブ側に**焼き込む**。ローカル検証した後は、
> 必ず `npm run sync` で本番向けに戻してからアーカイブすること。

---

## iOS: TestFlight 配布

### 0. 前提（1回だけ・Apple Developerサイトでの手動作業）

署名まわりのプロジェクト設定は済んでいる（Team `KFW7UH97T3` / 自動署名 / 縦向き固定 /
iPhone専用 / 暗号輸出コンプライアンス回答済み）ので、**Apple側にアプリの器を作るだけ**。

1. [Apple Developer](https://developer.apple.com/account) → Identifiers →
   App ID `jp.engnavi.app` を登録（Capabilities は当面デフォルトのまま）。
   ※ Xcodeのアーカイブ時に自動作成させることもできる（Signing & Capabilities で
   「Try Again」を押すと登録される）。
2. [App Store Connect](https://appstoreconnect.apple.com) → マイApp → 新規App:
   - プラットフォーム: iOS / 名前: Engineer Navigator / プライマリ言語: 日本語
   - Bundle ID: `jp.engnavi.app` / SKU: `engnavi`
3. Xcode → Settings → Accounts に Apple ID が入っていることを確認。

### 1. アーカイブ & アップロード（配布のたび）

```bash
cd mobile && npm run sync && npm run open:ios
```

Xcode 側:
1. デバイス選択を **Any iOS Device (arm64)** にして Product → Archive
   （シミュレータが選ばれているとArchiveがグレーアウトする）
2. Organizer → Distribute App → **TestFlight & App Store** → Upload

バージョンは Xcode の TARGETS → App → General で変更する（`MARKETING_VERSION` = Version /
`CURRENT_PROJECT_VERSION` = Build）。**同じビルド番号は再アップロードできない**ので、
2回目以降は Build を +1 すること。

> ⚠️ `agvtool` は使わないこと。Info.plist の `CFBundleVersion` を
> `$(CURRENT_PROJECT_VERSION)` 参照からハードコード値に書き換えてしまい、
> ビルド設定との二重管理になる。

### 2. テスターに配る

App Store Connect → TestFlight タブ:
- **内部テスター**（審査なし・最大100人）: App Store Connectユーザーに追加した
  Apple IDを内部グループへ。アップロード処理が終わり次第すぐ配布される。社内配布はこれで十分。
- **外部テスター**（簡易審査あり・最大10,000人）: メール招待 or 公開リンク。
  初回ビルドのみBeta App Reviewを通す（通常1日以内）。

テスターは iPhone に [TestFlight アプリ](https://apps.apple.com/jp/app/testflight/id899247664) を
入れて招待を受けるだけ。

---

## Android: Firebase App Distribution 配布

### 0. 前提（セットアップ済み）

以下は完了している（2026-08-04・CLIで作成）:

- Firebaseプロジェクト **engnavi-app** / Androidアプリ登録済み
  - App ID: `1:664916758573:android:e844da2a0cbc90d84be8a4`
  - Console: https://console.firebase.google.com/project/engnavi-app/appdistribution
- 署名鍵 `mobile/android/release.keystore` + `keystore.properties`（どちらもgitignore）
  - **この鍵とパスワードは厳重にバックアップすること**（1Password等）。
    紛失すると既存テスターは新しいAPKに上書きインストールできなくなり、
    将来のPlay移行時にも困る
- `google-services.json` は App Distribution だけなら**不要**（プッシュ通知導入時に追加）

### 1. ビルド & 配布（配布のたび）

```bash
cd mobile && npm run sync
cd android
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
./gradlew assembleRelease
npx firebase-tools appdistribution:distribute \
  app/build/outputs/apk/release/app-release.apk \
  --app 1:664916758573:android:e844da2a0cbc90d84be8a4 \
  --project engnavi-app \
  --release-notes "変更点をここに" --groups testers
```

> JDKは `brew install openjdk@21` で導入済み。シェルのrcに `JAVA_HOME` を
> 書いておくと毎回のexportは不要。

### 2. テスターの管理

[Console → App Distribution → テスターとグループ](https://console.firebase.google.com/project/engnavi-app/appdistribution)
でグループ `testers` を作り、メールアドレスを追加する。以後は上のコマンドの
`--groups testers` で配布するたび全員に招待メールが飛ぶ。
テスターはメールのリンクから端末に直接インストールできる（Play不要・
「提供元不明のアプリ」の許可だけ必要）。

---

## ストア公開に向けた残作業（テスト配布とは別）

WebViewだけのアプリは App Store 審査（ガイドライン4.2 Minimum Functionality）で
リジェクトされやすい。公開申請までに以下を積む:

- [ ] **プッシュ通知**（最有力のネイティブ付加価値。週報リマインド・メンター返信・レアキャラ来訪と相性◎）
  - `@capacitor/push-notifications` + FCM/APNs + サーバー側にトークン登録テーブル
- [ ] **OAuthログインの外部ブラウザ化**: GoogleはWebView内OAuthをブロックする
  （`disallowed_useragent`）。`@capacitor/browser`（SFSafariViewController / Custom Tabs）で
  開くか、当面はアプリでは招待リンク方式を案内する
- [ ] **ディープリンク**（Universal Links / App Links）: `/join/<token>` をアプリで開けるように。
  サーバー側に `.well-known/apple-app-site-association` と `assetlinks.json` を配置
- [ ] **オフライン時のフォールバック改善**（現状は www/index.html の静的メッセージ）
- [ ] **アカウント削除導線**（App Store必須要件）: アプリ内から到達できる削除機能
- [ ] App Store Connect: プライバシーラベル・スクリーンショット・説明文・サポートURL
- [ ] Google Play: データセーフティフォーム・ストア掲載情報（PlayはTWA/WebView可だが
  同様に掲載情報が必要）

## 補足メモ

- **サービスワーカー**: WKWebView内ではSW登録が失敗するが、`public/sw.js` は静的アセットの
  cache-firstのみなので実害なし（ページは常にネットワーク取得）。
- **cookieセッション**: シェルは本番ドメインをそのまま読み込むためファーストパーティcookieとして
  そのまま動く。Web側の変更は不要。
- **セーフエリア**: `ios.contentInset: "never"` にしてあるので、ノッチ回りの余白は
  Web側の `viewport-fit=cover` + `env(safe-area-inset-*)` で制御する。
