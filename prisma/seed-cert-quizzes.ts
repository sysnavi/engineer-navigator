// 良問バンクの「資格の範囲から選ぶ」(src/app/quiz/page.tsx) を全分野で選択可能にするための
// 資格シラバス準拠クイズ（src/lib/certifications.ts の CertChapter.topic を1件ずつカバー）。
//
// 背景: 良問バンクは topic に紐づく QuizQuestion が1件も無い分野を非活性表示にする
// （countByTopic===0 → リンク無効）。カタログにある分野を実際に選べるようにするには、
// 各 topic に最低1問必要。AWS IAM は既存シード(seed.ts/seed-launch.ts)で既にカバー済みなので
// ここでは対象外。IPA/基本情報で重複する topic（"ネットワーク基礎" "情報セキュリティ基礎"）は
// 1問のみ用意すれば両方の資格から選べるようになる（topic文字列が唯一の正のため）。
//
// seed.ts から読み込んで upsert する。作成時のみの人力データ＝実行時トークンゼロ。

import type { SeedQuiz } from "./seed-quizzes";

export const SEED_CERT_QUIZZES: SeedQuiz[] = [
  // ===== ITパスポート =====
  {
    id: "quiz-cert-ip-strategy",
    topic: "IPA ストラテジ系",
    domains: ["web", "pm"],
    prompt: "自社の強み・弱みと外部環境の機会・脅威を整理して経営戦略を立てる分析手法はどれ？",
    choices: ["SWOT分析", "ABC分析", "PPM分析", "バリューチェーン分析"],
    answerIndex: 0,
    explanation:
      "SWOT分析は自社の強み(Strengths)・弱み(Weaknesses)と外部の機会(Opportunities)・脅威(Threats)を4象限で整理する代表的なフレームワーク。PPMは事業ポートフォリオ、バリューチェーンは活動連鎖の分析に使う。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-ip-management",
    topic: "IPA マネジメント系",
    domains: ["web", "pm"],
    prompt:
      "システム開発を要件定義→設計→実装→テストと順番に進め、前工程には戻らない前提の開発モデルはどれ？",
    choices: ["ウォーターフォールモデル", "アジャイル（スクラム）", "スパイラルモデル", "プロトタイピングモデル"],
    answerIndex: 0,
    explanation:
      "ウォーターフォールは工程を順に完了させて次に進む計画駆動型。要件変更には弱いが進捗管理はしやすい。スクラムは反復開発、スパイラルはリスク低減の反復、プロトタイピングは試作で要件を固める手法。",
    scores: [8, 8],
  },
  {
    id: "quiz-cert-ip-tech-base",
    topic: "IPA テクノロジ基礎",
    domains: ["web"],
    prompt: "2進数の「1010」を10進数に変換すると？",
    choices: ["8", "10", "12", "16"],
    answerIndex: 1,
    explanation:
      "1010(2) = 1×8 + 0×4 + 1×2 + 0×1 = 10。桁ごとに2の累乗を掛けて足す基本的な基数変換。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-network-basic",
    topic: "ネットワーク基礎",
    domains: ["web", "infra"],
    prompt: "IPアドレス「192.168.1.10/24」のネットワークアドレスとして正しいのはどれ？",
    choices: ["192.168.1.0", "192.168.0.0", "192.168.1.255", "10.0.0.0"],
    answerIndex: 0,
    explanation:
      "/24は先頭24ビットがネットワーク部。192.168.1.0〜192.168.1.255の範囲を持ち、先頭の192.168.1.0がネットワークアドレス、末尾の192.168.1.255がブロードキャストアドレスになる。",
    scores: [8, 7, 8],
  },
  {
    id: "quiz-cert-security-basic",
    topic: "情報セキュリティ基礎",
    domains: ["web", "infra"],
    prompt: "公開鍵暗号方式の説明として正しいのはどれ？",
    choices: [
      "暗号化と復号に同じ鍵を使う",
      "暗号化に使う鍵と復号に使う鍵が異なり、公開鍵は誰でも入手できる",
      "鍵を一切使わずハッシュ関数だけで暗号化する",
      "通信の度に新しい共通鍵を電話で伝える",
    ],
    answerIndex: 1,
    explanation:
      "公開鍵暗号は公開鍵で暗号化し秘密鍵でしか復号できない（またはその逆）非対称の仕組み。暗号化と復号に同じ鍵を使うのは共通鍵（対称鍵）暗号の説明。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-ip-new-tech",
    topic: "IT新技術トレンド",
    domains: ["web"],
    prompt:
      "多数の小さな機能単位をAPIで疎結合に連携させる、近年のシステム開発トレンドを表すキーワードはどれ？",
    choices: ["メインフレーム集中処理", "マイクロサービスアーキテクチャ", "バッチ集中処理", "単一の巨大モノリスアプリケーション"],
    answerIndex: 1,
    explanation:
      "マイクロサービスは機能ごとに独立してデプロイ・スケールできる小さなサービス群をAPIで連携させるアーキテクチャ。クラウドネイティブ/DXの文脈で頻出のキーワード。",
    scores: [7, 7],
  },

  // ===== 基本情報技術者 =====
  {
    id: "quiz-cert-fe-base-theory",
    topic: "基礎理論（基本情報）",
    domains: ["web", "fullstack"],
    prompt: "配列の末尾に要素を追加する操作の計算量として一般的に正しいのはどれ？",
    choices: [
      "先頭挿入と同じくO(n)で必ず遅い",
      "多くの実装でO(1)（動的配列なら償却O(1)）で、既存要素のシフトが不要",
      "常にO(n^2)",
      "配列では末尾追加ができない",
    ],
    answerIndex: 1,
    explanation:
      "末尾追加は既存要素の移動が不要なためO(1)（動的配列は容量拡張時のみ償却O(1)）。先頭挿入は既存要素を1つずつ後ろへシフトする必要がありO(n)。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-fe-computer",
    topic: "コンピュータシステム",
    domains: ["infra", "embedded"],
    prompt:
      "稼働率0.9の装置2台を並列（どちらか1台が動けばシステム稼働）で構成したときのシステム稼働率はどれ？",
    choices: ["0.81", "0.9", "0.99", "1.8"],
    answerIndex: 2,
    explanation:
      "並列(OR)構成の稼働率は 1-(1-0.9)×(1-0.9) = 1-0.01 = 0.99。両方が同時に故障して初めて停止するため単体より稼働率が上がる。直列(AND)構成なら0.81。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-fe-database",
    topic: "データベース基礎",
    domains: ["web", "fullstack"],
    prompt: "第1正規形から第2正規形にするために解消すべき従属関係はどれ？",
    choices: ["推移的関数従属", "複合主キーの一部の列にしか依存しない部分関数従属", "多値従属性", "候補キー同士の従属"],
    answerIndex: 1,
    explanation:
      "第2正規形は、複合主キーの一部だけに従属する列（部分関数従属）を別表に分離する。推移的関数従属の解消は第3正規形の話。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-fe-dev-mgmt",
    topic: "開発プロセスとマネジメント",
    domains: ["web", "pm"],
    prompt: "テストを「単体テスト→結合テスト→システムテスト→受入テスト」の順に段階的に行う理由はどれ？",
    choices: [
      "手戻りのコストを小さい単位のうちに抑えるため",
      "テスト工程を増やして開発期間を長く見せるため",
      "単体テストを省略できるようにするため",
      "テスト担当者を増やす口実にするため",
    ],
    answerIndex: 0,
    explanation:
      "小さい単位（単体）で欠陥を早期に見つけるほど修正コストが小さい。段階を追って対象範囲を広げることで、結合や全体設計に起因する欠陥も後段で拾える。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-fe-algorithm",
    topic: "アルゴリズムとプログラミング",
    domains: ["web", "fullstack"],
    prompt: "ソート済み配列から特定の値を探す二分探索の計算量として正しいのはどれ？",
    choices: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
    answerIndex: 1,
    explanation:
      "二分探索は探索範囲を毎回半分に絞るためO(log n)。線形探索のO(n)より高速だが、事前に配列がソートされている必要がある。",
    scores: [8, 8],
  },

  // ===== 応用情報技術者 =====
  {
    id: "quiz-cert-ap-tech-core",
    topic: "応用情報 テクノロジ",
    domains: ["fullstack", "infra"],
    prompt: "キャッシュメモリのヒット率が高いほど期待できる効果として正しいのはどれ？",
    choices: [
      "主記憶へのアクセス頻度が減り実効アクセス時間が短くなる",
      "CPUのクロック周波数が上がる",
      "ディスク容量が増える",
      "ネットワーク帯域が広がる",
    ],
    answerIndex: 0,
    explanation:
      "キャッシュヒット率が高いほど低速な主記憶へのアクセスが減り、平均（実効）アクセス時間が短縮される。クロック周波数やディスク容量、帯域とは別の話。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-ap-database",
    topic: "データベース設計",
    domains: ["fullstack"],
    prompt: "「1人の顧客が複数の注文を持ち、1つの注文は1人の顧客に属する」関係を表すカーディナリティはどれ？",
    choices: ["1対1", "1対多", "多対多", "0対0"],
    answerIndex: 1,
    explanation:
      "顧客1に対して注文が複数ぶら下がる典型的な1対多関係。多対多にするには中間テーブルが必要になる（例: 注文と商品の関係）。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-ap-network",
    topic: "ネットワーク設計",
    domains: ["infra"],
    prompt: "複数のWebサーバーにリクエストを振り分けて負荷分散する装置・仕組みはどれ？",
    choices: ["ロードバランサ", "ファイアウォール", "DNSキャッシュサーバー", "プロキシキャッシュ専用機"],
    answerIndex: 0,
    explanation:
      "ロードバランサは複数サーバーへリクエストを分散し可用性とスループットを高める。ファイアウォールは通信の許可/遮断、DNSは名前解決が主目的で役割が異なる。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-ap-security",
    topic: "情報セキュリティ設計",
    domains: ["infra", "qa"],
    prompt: "認証(Authentication)と認可(Authorization)の違いとして正しいのはどれ？",
    choices: [
      "認証は「あなたは誰か」の確認、認可は「何をしてよいか」の許可",
      "認証と認可は同じ意味",
      "認可は本人確認、認証は権限確認",
      "どちらもパスワードの強度を指す",
    ],
    answerIndex: 0,
    explanation:
      "認証は本人確認（ログイン等）、認可はログイン後に何のリソースへのアクセスを許すかの制御。設計時にこの2つを混同すると権限昇格の欠陥につながりやすい。",
    scores: [8, 8],
  },
  {
    id: "quiz-cert-ap-architecture",
    topic: "システムアーキテクチャ",
    domains: ["infra", "fullstack"],
    prompt:
      "可用性を高めるため、同じ役割のサーバーを異なるデータセンター（アベイラビリティゾーン）に分散配置する設計方針はどれ？",
    choices: ["垂直分割", "冗長化（マルチAZ構成）", "正規化", "シャーディングのみ"],
    answerIndex: 1,
    explanation:
      "単一障害点をなくすため、同じ役割の構成要素を複数のゾーン/拠点に冗長配置するのが基本方針。垂直分割や正規化はデータ設計、シャーディングは水平分割の話で可用性そのものの答えではない。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-ap-pm",
    topic: "プロジェクトマネジメント",
    domains: ["pm"],
    prompt: "プロジェクトの全作業を漏れなく階層的に分解して一覧にする技法はどれ？",
    choices: ["WBS（作業分解構成図）", "ガントチャート", "EVM", "SWOT分析"],
    answerIndex: 0,
    explanation:
      "WBS(Work Breakdown Structure)は成果物・作業を階層的に分解して洗い出す技法。ガントチャートはスケジュール表示、EVMは進捗・コストの実績評価に使う。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-ap-strategy",
    topic: "経営戦略と監査",
    domains: ["pm"],
    prompt: "独立した第三者的立場からシステムのリスクや統制状況を検証する活動はどれ？",
    choices: ["システム監査", "要件定義", "リファクタリング", "ユーザー受け入れテスト"],
    answerIndex: 0,
    explanation:
      "システム監査は開発・運用から独立した監査人が、情報システムのリスクマネジメントや内部統制の妥当性を検証し改善を助言する活動。",
    scores: [6, 6],
  },

  // ===== AWS SAA（IAMは既存シードでカバー済み） =====
  {
    id: "quiz-cert-saa-network",
    topic: "AWS VPC・ネットワーク",
    domains: ["infra"],
    prompt: "VPC内でサブネットレベルの通信制御を行い、戻り通信も明示的に許可が必要な（ステートレスな）仕組みはどれ？",
    choices: ["セキュリティグループ", "ネットワークACL（NACL）", "IAMポリシー", "Route53のヘルスチェック"],
    answerIndex: 1,
    explanation:
      "NACLはサブネット単位でステートレスにIN/OUTを個別に評価する。セキュリティグループはインスタンス単位でステートフル（戻り通信は自動許可）という違いが頻出ポイント。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-saa-compute",
    topic: "AWS コンピューティング",
    domains: ["infra"],
    prompt: "アクセス増加に応じてEC2インスタンス数を自動的に増減させる仕組みはどれ？",
    choices: ["Auto Scaling", "AWS IAM", "Amazon S3ライフサイクル", "AWS CloudTrail"],
    answerIndex: 0,
    explanation:
      "Auto Scalingはメトリクス（CPU使用率等）に応じてインスタンス数を自動調整し、コストと可用性のバランスを取る。ELBと組み合わせるのが典型構成。",
    scores: [8, 8],
  },
  {
    id: "quiz-cert-saa-storage",
    topic: "AWS ストレージ・DB",
    domains: ["infra"],
    prompt:
      "アクセス頻度が低いデータを低コストに保管し、取り出しに数分〜数時間かかっても構わない用途に向くS3ストレージクラスはどれ？",
    choices: ["S3 Standard", "S3 Glacier", "S3 Transfer Acceleration", "S3 Static Website Hosting"],
    answerIndex: 1,
    explanation:
      "Glacierはアーカイブ用途の低コストストレージで、取り出しに時間がかかる代わりに保管コストが非常に安い。頻繁アクセスにはStandard、高速アップロードにはTransfer Accelerationを使う。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-saa-resilience",
    topic: "AWS 可用性設計",
    domains: ["infra"],
    prompt:
      "サービス間を疎結合にし、受信側が一時的に落ちてもメッセージを溜めておいて後で処理できるようにするAWSサービスはどれ？",
    choices: ["Amazon SQS", "AWS IAM", "Amazon Route53", "AWS CloudFormation"],
    answerIndex: 0,
    explanation:
      "SQS（キューイングサービス）はプロデューサーとコンシューマーを疎結合にし、受信側の一時停止や障害があってもメッセージを保持できる。可用性・耐障害性を高める定番パターン。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-saa-cost",
    topic: "AWS コスト最適化",
    domains: ["infra"],
    prompt: "常時稼働が前提で1〜3年の利用予定があるEC2に対して、最もコストを抑えられる購入オプションはどれ？",
    choices: [
      "オンデマンドインスタンス",
      "リザーブドインスタンス",
      "スポットインスタンス（中断可能ワークロード向け）",
      "Savings Plansなしのオンデマンドのみ",
    ],
    answerIndex: 1,
    explanation:
      "リザーブドインスタンスは1年/3年の利用コミットと引き換えにオンデマンドより大幅に割引される。常時稼働が確定している用途に向く。スポットは中断リスクがある代わりに最安。",
    scores: [7, 6],
  },

  // ===== JSTQB FL =====
  {
    id: "quiz-cert-jstqb-fundamentals",
    topic: "テストの基礎",
    domains: ["qa"],
    prompt:
      "JSTQBのテストの原則にある「テストは欠陥がないことを示すのではなく、欠陥があることを示す」に近い考え方はどれ？",
    choices: [
      "テストで欠陥が見つからなくても「バグがない」ことの証明にはならない",
      "テストをすれば必ず全てのバグが見つかる",
      "テストは開発の最後にだけ行えばよい",
      "テスト担当者は開発者と同じ人が兼任すべき",
    ],
    answerIndex: 0,
    explanation:
      "「欠陥があることは示せるが、欠陥がないことは証明できない」はJSTQBの7原則の1つ。テストで不具合が出なかったのは「品質が十分」ではなく「見つけられなかった」可能性がある。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-jstqb-lifecycle",
    topic: "開発ライフサイクルとテスト",
    domains: ["qa"],
    prompt: "開発の早い段階（要件定義など）からテスト活動を始める考え方を指す用語はどれ？",
    choices: ["シフトレフト", "シフトライト", "フリーズ期間", "コードフリーズ"],
    answerIndex: 0,
    explanation:
      "シフトレフトはテストをより早い工程（左）に前倒しし、欠陥を早期発見して修正コストを下げる考え方。対義語的に本番環境での検証を重視するのがシフトライト。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-jstqb-static",
    topic: "静的テスト・レビュー",
    domains: ["qa"],
    prompt: "プログラムを実行せずにソースコードやドキュメントの欠陥を見つけるテスト手法を何と呼ぶか？",
    choices: ["静的テスト", "動的テスト", "探索的テスト", "負荷テスト"],
    answerIndex: 0,
    explanation:
      "静的テストはコードを実行せずレビューや静的解析ツールで欠陥を見つける手法。動的テストは実際にプログラムを実行して検証する。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-jstqb-design",
    topic: "テスト設計技法",
    domains: ["qa"],
    prompt: "「0, 1, 100, 101」のように、有効範囲の境目とその前後の値を重点的にテストする技法はどれ？",
    choices: ["境界値分析", "同値分割のみ", "デシジョンテーブルテスト", "状態遷移テスト"],
    answerIndex: 0,
    explanation:
      "境界値分析は範囲の端（最小値・最大値の前後）にバグが集中しやすいという経験則に基づき、境界付近の値を重点的にテストする技法。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-jstqb-management",
    topic: "テストマネジメント",
    domains: ["qa", "pm"],
    prompt: "限られたテスト工数を、障害発生時の影響が大きい機能や発生確率が高い箇所に優先配分する考え方はどれ？",
    choices: ["リスクベースドテスト", "全数テスト", "ランダムテスト", "無計画テスト"],
    answerIndex: 0,
    explanation:
      "リスクベースドテストは影響度×発生確率でリスクの高い部分を優先的にテストし、限られたリソースで効果的に品質を確保するアプローチ。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-jstqb-tools",
    topic: "テストツールと自動化",
    domains: ["qa"],
    prompt: "テスト自動化を導入する際の注意点として適切なのはどれ？",
    choices: [
      "導入すれば必ずテストコストがゼロになる",
      "全てのテストケースを無条件に自動化すべき",
      "変化の激しい画面や1回しか実行しないテストは自動化に向かないことがある",
      "自動化ツールを導入すればテスト設計は不要になる",
    ],
    answerIndex: 2,
    explanation:
      "自動化には作成・保守コストがかかるため、繰り返し実行する回帰テストなどに向く一方、頻繁にUIが変わる画面や単発のテストは費用対効果が低いことがある。自動化はテスト設計の代替にはならない。",
    scores: [7, 7],
  },

  // ===== LPIC-1 / LinuC-1 =====
  {
    id: "quiz-cert-lpic-arch",
    topic: "Linux システム起動",
    domains: ["infra"],
    prompt: "多くの現代のLinuxディストリビューションで、起動後のサービス管理を担う仕組みはどれ？",
    choices: ["systemd", "BIOS", "GRUB単体", "cron"],
    answerIndex: 0,
    explanation:
      "systemdはサービス（ユニット）の起動・管理・依存関係解決を担う初期化システム。BIOS/UEFIはハード起動前段階、GRUBはブートローダ、cronは定期実行の仕組みで役割が異なる。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-lpic-package",
    topic: "Linux パッケージ管理",
    domains: ["infra"],
    prompt: "Debian系ディストリビューションで依存関係を解決しながらパッケージをインストールするコマンドはどれ？",
    choices: ["apt install", "rpm -i", "dnf install", "yum install"],
    answerIndex: 0,
    explanation:
      "aptはDebian/Ubuntu系のパッケージ管理コマンドで依存関係を自動解決する。rpm単体は依存解決をしない低レベルコマンド、dnf/yumはRed Hat系のパッケージ管理コマンド。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-lpic-command",
    topic: "Linux コマンド操作",
    domains: ["infra"],
    prompt: "コマンドAの標準出力をコマンドBの標準入力へそのまま渡すために使う記号はどれ？",
    choices: ["|（パイプ）", ">（リダイレクト）", "&&", ";"],
    answerIndex: 0,
    explanation:
      "パイプ(|)は左側コマンドの標準出力を右側コマンドの標準入力に接続する。>は出力をファイルへリダイレクト、&&は前段成功時のみ次を実行、;は単純な逐次実行。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-lpic-filesystem",
    topic: "Linux ファイルシステム",
    domains: ["infra"],
    prompt: "パーミッション「rwxr-xr-x」を8進数で表すと？",
    choices: ["755", "644", "777", "700"],
    answerIndex: 0,
    explanation:
      "所有者rwx=7、グループr-x=5、その他r-x=5で755。644は所有者rw、他は読み取りのみの一般的なファイル権限を表す。",
    scores: [7, 6],
  },
  {
    id: "quiz-cert-lpic-shell",
    topic: "シェルスクリプト",
    domains: ["infra"],
    prompt: "毎日深夜3時に定期的にスクリプトを実行したいとき、設定すべき仕組みはどれ？",
    choices: ["cron", "systemd-analyze", "lsof", "chmod"],
    answerIndex: 0,
    explanation:
      "cronはcrontabに登録したスケジュールでコマンドを定期実行するデーモン。「0 3 * * *」のような書式で分単位まで指定できる。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-lpic-admin",
    topic: "Linux システム管理",
    domains: ["infra"],
    prompt: "新しいユーザーアカウントを作成するコマンドはどれ？",
    choices: ["useradd", "userdel", "passwd -l", "groups"],
    answerIndex: 0,
    explanation:
      "useraddは新規ユーザーを作成するコマンド。userdelは削除、passwd -lはアカウントロック、groupsは所属グループの表示に使う。",
    scores: [6, 6],
  },
  {
    id: "quiz-cert-lpic-network",
    topic: "Linux ネットワーク設定",
    domains: ["infra"],
    prompt: "公開鍵認証でSSHログインする際に、リモートサーバー側に登録しておく必要があるのはどれ？",
    choices: ["接続元の公開鍵", "接続元の秘密鍵", "サーバーのrootパスワード", "接続元のMACアドレス"],
    answerIndex: 0,
    explanation:
      "公開鍵認証ではクライアントの公開鍵をサーバーの~/.ssh/authorized_keysに登録しておき、秘密鍵はクライアント側から外に出さない。秘密鍵をサーバーに置くのは誤り。",
    scores: [8, 7],
  },
];
