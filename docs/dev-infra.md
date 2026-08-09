# 開発・テスト・リリース基盤の図解

依頼 → 実装 → 検証 → リリースの流れを支える環境の全体像。
コマンドの使い方は AGENTS.md、デプロイ手順と CI の詳細は DEPLOY.md を参照。

## 全体マップ

3つの実行環境（ローカル開発 / E2E / CI）と本番の関係。
**E2E はローカル開発と完全分離**（別ポート・別DB）なので、`npm run dev` を
立ち上げたまま `npm run test:e2e` を実行してよい。

```mermaid
flowchart LR
    subgraph mac["ローカル（Mac）"]
        direction TB
        dev["npm run dev<br/>localhost:3000"]
        unit["npm run check<br/>型 + lint + vitest 30件<br/>（DB不要・純ロジックのみ）"]
        e2e["npm run test:e2e<br/>Playwright + next dev :3111"]
        subgraph docker["Docker Postgres :5433（pgvector/pg16）"]
            devdb[("engineer_navigator<br/>開発DB")]
            e2edb[("engineer_navigator_e2e<br/>毎回 DROP→CREATE→migrate→seed")]
        end
        dev --> devdb
        e2e --> e2edb
    end

    subgraph github["GitHub"]
        repo["sysnavi/engineer-navigator<br/>main"]
        ci["Actions CI<br/>check + E2Eスモーク<br/>（サービスコンテナ pg16 :5433）"]
        repo --> ci
    end

    subgraph prod["本番"]
        vercel["Vercel（sin1）<br/>ビルド時に migrate deploy"]
        neon[("Neon Postgres")]
        vercel --> neon
    end

    mac -- "git push" --> repo
    repo -- "push と同時（CIを待たない）" --> vercel
```

## リリースゲート

ゲートの本体はローカルの `check:release`。CI は同じ内容を GitHub 上で
再実行する**事後の安全網**で、Vercel のデプロイはブロックしない
（ハードゲート化の選択肢は DEPLOY.md）。

```mermaid
flowchart LR
    change["コード変更"] --> check["npm run check<br/>（変更のたび）"]
    check --> release["npm run check:release<br/>（push前・E2E込み）"]
    release -- 通ったら --> push["git push origin main"]
    push --> ci["GitHub Actions CI<br/>✅ 安全網"]
    push --> deploy["Vercel 本番デプロイ<br/>（CIと並走）"]
```

## E2E の中身

外部依存ゼロ・決定的に回すための仕掛け。

```mermaid
sequenceDiagram
    participant PW as Playwright
    participant PREP as prepare-db.ts
    participant PG as Postgres :5433
    participant APP as next dev :3111

    PW->>PREP: webServer.command の先頭で実行<br/>（globalSetupはwebServerより後なので使わない）
    PREP->>PG: DROP/CREATE engineer_navigator_e2e<br/>（DB名が _e2e で終わらないと拒否）
    PREP->>PG: prisma migrate deploy + seed
    PW->>APP: 起動を待って5テスト直列実行
    Note over APP: DEV_LOGIN_ENABLED=true<br/>→ cookieなしでデモユーザー
    Note over APP: ANTHROPIC_API_KEY=""<br/>→ AI解析は即FAILED・提出は成功（仕様）<br/>実APIは呼ばない＝無料・決定的
```

スモークの5本: ホーム表示 / 週報の入力→自動保存→提出→リザルト /
今日の一問に解答→採点 / スキルマップ / ウェルカム（公開ページ）。

## 決まりごと（テスト設計）

- **ユニット**: `src/**/*.test.ts` に併置。DBに触らない純ロジックだけを対象にする
  （週の境界・レベルカーブ・ルーブリック・げんばの決定性など「壊れると全員に効く」計算）
- **E2E**: tests/e2e/。seed直後の状態を前提に書いてよい（毎回リセットされるため）。
  初回チュートリアルは `closeTutorialIfShown` で閉じる
- **CIとローカルの差をなくす**: CIのDBもローカルと同じイメージ・同じポート(5433)に
  合わせてあるので、接続設定の分岐が存在しない
