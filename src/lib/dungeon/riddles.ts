// 戦闘用の問題（TSマスタ）。○× と 四択 の2種類。
//
// 【役割】
//  - ○×: 浅い階の雑魚戦を「○×5連」の高速ラウンドにするための問題。
//  - 四択: 良問バンク（DB）に敵の得意領域の問題が無いときでも、その敵らしい問いを出すための問題。
//    敵の個性（得意領域）はここで担保する。バンクが薄い環境の保険も兼ねる。
// 採点はサーバー（session-actions）で行い、answer / answerIndex はクライアントに渡さない。
//
// 【拡充のしかた】配列に足すだけ。id は ○× と四択を通して一意に。topics は良問バンクの topic と
// 同じ語彙で（MONSTERS.topics と照合するので、モンスターの得意領域は必ずカバーする。
// quiz-pool.test.ts が敵ごとの問題数を見張っている）。
//  - ○と×の数は偏らせない（どちらかを押し続ければ勝てる問題群にしない）
//  - 四択は正解の位置（answerIndex）を散らす（「いつもB」にしない）

type RiddleBase = {
  id: string;
  /** 得意領域（MONSTERS.topics / QuizQuestion.topic と同じ語彙） */
  topics: string[];
  /** 解答後に出す一言（正誤どちらでも出す） */
  note: string;
};

/** ○× 問題 */
export type TrueFalseRiddle = RiddleBase & {
  kind: "truefalse";
  statement: string;
  answer: boolean;
};

/** 四択 問題 */
export type ChoiceRiddle = RiddleBase & {
  kind: "choice";
  prompt: string;
  /** 4つ。並びは固定で出す（answerIndex がこの並びの正解） */
  choices: string[];
  answerIndex: number;
};

export type Riddle = TrueFalseRiddle | ChoiceRiddle;

const TRUE_FALSE: Omit<TrueFalseRiddle, "kind">[] = [

  // --- HTTP ---
  { id: "http-404", topics: ["HTTP", "Web"], statement: "HTTP の 404 は「サーバー内部エラー」を意味する。", answer: false, note: "404 は Not Found。内部エラーは 500。" },
  { id: "http-get-idem", topics: ["HTTP", "Web"], statement: "GET は何度送っても結果が変わらない（冪等）であるべきとされる。", answer: true, note: "GET は取得専用。副作用を持たせない。" },
  { id: "http-tls-path", topics: ["HTTP", "セキュリティ"], statement: "HTTPS では URL のパスやクエリも暗号化される。", answer: true, note: "ホスト名は SNI で見えるが、パス以降は TLS の中。" },
  { id: "http-301", topics: ["HTTP", "Web"], statement: "ステータス 301 は「一時的な」リダイレクトを表す。", answer: false, note: "301 は恒久。一時的は 302 / 307。" },
  { id: "http-h2-mux", topics: ["HTTP", "Web"], statement: "HTTP/2 は 1 本の TCP 接続で複数リクエストを並行して送れる。", answer: true, note: "多重化（multiplexing）。HTTP/1.1 は接続ごとに順番待ち。" },
  { id: "http-httponly", topics: ["HTTP", "セキュリティ"], statement: "Cookie に HttpOnly を付けると JavaScript から読めなくなる。", answer: true, note: "XSS でトークンを抜かれにくくする定番の属性。" },
  { id: "http-401-403", topics: ["HTTP", "セキュリティ"], statement: "401 は「権限がなく禁止」、403 は「認証が必要」を表す。", answer: false, note: "逆。401 = 認証が必要、403 = 認証済みでも禁止。" },
  { id: "http-stateful", topics: ["HTTP", "Web"], statement: "HTTP はサーバーが前回のリクエスト内容を必ず覚えている（ステートフル）。", answer: false, note: "HTTP はステートレス。状態は Cookie やセッションで補う。" },
  { id: "http-put-patch", topics: ["HTTP", "Web"], statement: "PUT は部分更新、PATCH は全体の置き換えに使うのが慣例。", answer: false, note: "逆。PUT = 全体置換、PATCH = 部分更新。" },
  { id: "http-no-store", topics: ["HTTP", "Web"], statement: "Cache-Control: no-store は「キャッシュに保存しない」を指示する。", answer: true, note: "no-cache は「保存はするが使う前に再検証」。混同しやすい。" },

  // --- SQL ---
  { id: "sql-where-having", topics: ["SQL"], statement: "WHERE 句は GROUP BY の集計結果を絞り込むために使う。", answer: false, note: "集計後の絞り込みは HAVING。WHERE は集計前。" },
  { id: "sql-null-eq", topics: ["SQL"], statement: "SQL で NULL = NULL は真になる。", answer: false, note: "結果は UNKNOWN。NULL の判定は IS NULL。" },
  { id: "sql-inner-join", topics: ["SQL"], statement: "INNER JOIN は両方のテーブルで一致する行だけを返す。", answer: true, note: "片側だけ残したいときは LEFT / RIGHT JOIN。" },
  { id: "sql-index-cost", topics: ["SQL", "設計"], statement: "インデックスを張ると読み取りが速くなる代わりに書き込みのコストが増える。", answer: true, note: "INSERT / UPDATE のたびにインデックスも更新される。" },
  { id: "sql-truncate", topics: ["SQL"], statement: "TRUNCATE は WHERE 句で行を絞って削除できる。", answer: false, note: "TRUNCATE は全行。絞るなら DELETE。" },
  { id: "sql-count-star", topics: ["SQL"], statement: "COUNT(*) は NULL しか入っていない行も数える。", answer: true, note: "COUNT(列名) は NULL を数えない。ここが違う。" },
  { id: "sql-rollback", topics: ["SQL"], statement: "ROLLBACK は COMMIT 済みの変更も取り消せる。", answer: false, note: "COMMIT したら確定。取り消しは新しい変更で。" },
  { id: "sql-left-null", topics: ["SQL"], statement: "LEFT JOIN で右側に一致がない行は、右側の列が NULL で返る。", answer: true, note: "「一致しない側を探す」なら WHERE 右.id IS NULL。" },
  { id: "sql-order-guarantee", topics: ["SQL"], statement: "ORDER BY を省略した SELECT の結果の並び順は保証される。", answer: false, note: "並びが要るなら必ず ORDER BY。たまたま揃うのは保証ではない。" },
  { id: "sql-placeholder", topics: ["SQL", "セキュリティ"], statement: "プレースホルダ（バインド変数）を使うと SQL インジェクションを防ぎやすい。", answer: true, note: "値と構文を分けるのが要点。文字列連結はしない。" },

  // --- Linux ---
  { id: "linux-755", topics: ["Linux"], statement: "chmod 755 はオーナーに読み書き実行、それ以外に読みと実行を与える。", answer: true, note: "7 = rwx、5 = r-x。" },
  { id: "linux-kill9", topics: ["Linux"], statement: "kill -9 はプロセスに終了処理の機会を与えてから止める。", answer: false, note: "-9（SIGKILL）は即死。後始末させたいなら SIGTERM。" },
  { id: "linux-stderr", topics: ["Linux"], statement: "標準エラー出力のファイルディスクリプタ番号は 2 である。", answer: true, note: "0 = 標準入力、1 = 標準出力、2 = 標準エラー。" },
  { id: "linux-grep-i", topics: ["Linux"], statement: "grep -i は大文字と小文字を区別して検索する。", answer: false, note: "-i は ignore case。区別しない。" },
  { id: "linux-pipe-stderr", topics: ["Linux"], statement: "パイプ | は左のコマンドの標準エラー出力を右に渡す。", answer: false, note: "渡るのは標準出力。エラーも渡すなら 2>&1。" },
  { id: "linux-chmod-x", topics: ["Linux"], statement: "chmod +x でファイルに実行権限が付く。", answer: true, note: "スクリプトを ./run.sh で動かすときの定番。" },
  { id: "linux-cron-3am", topics: ["Linux"], statement: "cron の「0 3 * * *」は毎日 3 時 0 分に実行される。", answer: true, note: "分 時 日 月 曜日 の順。" },
  { id: "linux-ls-l-hidden", topics: ["Linux"], statement: "ls -l は隠しファイル（ドット始まり）も表示する。", answer: false, note: "隠しファイルは -a。詳細と両方なら -la。" },
  { id: "linux-ssh-port", topics: ["Linux", "セキュリティ"], statement: "SSH のデフォルトポートは 80 番である。", answer: false, note: "22 番。80 は HTTP。" },
  { id: "linux-tail-f", topics: ["Linux"], statement: "tail -f はファイルの末尾を追い続けて表示する。", answer: true, note: "ログ監視の基本。" },

  // --- Git ---
  { id: "git-pull", topics: ["Git"], statement: "git pull は fetch と merge をまとめて行う。", answer: true, note: "取ってきて、混ぜる。" },
  { id: "git-amend", topics: ["Git"], statement: "git commit --amend は直前のコミットを作り直す。", answer: true, note: "push 済みのコミットに使うと履歴がずれるので注意。" },
  { id: "git-reset-hard", topics: ["Git"], statement: "git reset --hard は作業ツリーの変更も捨てる。", answer: true, note: "戻せない。使う前に status を見る。" },
  { id: "git-stash-pop-only", topics: ["Git"], statement: "git stash で退避した変更は git stash pop でしか戻せない。", answer: false, note: "stash apply でも戻せる（stash は残る）。" },
  { id: "git-rebase-shared", topics: ["Git"], statement: "git rebase は履歴を書き換えるので、共有済みブランチでは避けるのが原則。", answer: true, note: "他人の checkout が壊れる。" },
  { id: "git-fetch-merge", topics: ["Git"], statement: "git fetch はリモートの変更を取得して、作業ブランチに自動でマージする。", answer: false, note: "fetch は取得だけ。混ぜるのは merge / pull。" },
  { id: "git-checkout-b", topics: ["Git"], statement: "git checkout -b は既存のブランチにしか切り替えられない。", answer: false, note: "-b は新しいブランチを作って切り替える。" },
  { id: "git-ignore-tracked", topics: ["Git"], statement: ".gitignore に書いたファイルは、すでに追跡中でも自動で追跡から外れる。", answer: false, note: "外すには git rm --cached が要る。" },
  { id: "git-revert", topics: ["Git"], statement: "git revert は指定コミットを打ち消す新しいコミットを作る。", answer: true, note: "履歴を消さないので共有ブランチでも安全。" },
  { id: "git-log-oneline", topics: ["Git"], statement: "git log --oneline は各コミットの変更差分も表示する。", answer: false, note: "1 行に要約するだけ。差分は -p。" },

  // --- セキュリティ ---
  { id: "sec-reversible", topics: ["セキュリティ"], statement: "パスワードは復号できる暗号化で保存するのが推奨される。", answer: false, note: "復号できない形（ソルト付きハッシュ）で保存する。" },
  { id: "sec-xss", topics: ["セキュリティ", "Web"], statement: "XSS はユーザー入力をエスケープせず HTML に埋め込むと起きる。", answer: true, note: "出力時のエスケープが基本。" },
  { id: "sec-csrf", topics: ["セキュリティ", "Web"], statement: "CSRF 対策のトークンはリクエストごとに検証する必要がある。", answer: true, note: "ログイン時に一度だけでは意味がない。" },
  { id: "sec-sqli-concat", topics: ["セキュリティ", "SQL"], statement: "SQL インジェクションはプレースホルダでは防げないので、文字列連結が推奨される。", answer: false, note: "逆。プレースホルダを使い、連結はしない。" },
  { id: "sec-https-validation", topics: ["セキュリティ", "Web"], statement: "HTTPS を使っていれば、サーバー側の入力検証は不要になる。", answer: false, note: "HTTPS は経路の暗号化。中身の検証は別。" },
  { id: "sec-mfa", topics: ["セキュリティ"], statement: "多要素認証は「知識・所持・生体」のうち 2 つ以上を組み合わせる。", answer: true, note: "パスワード 2 つは多要素ではない。" },
  { id: "sec-private-key", topics: ["セキュリティ"], statement: "秘密鍵は公開してよく、公開鍵だけを秘匿する。", answer: false, note: "逆。秘密鍵は絶対に出さない。" },
  { id: "sec-least-priv", topics: ["セキュリティ", "AWS"], statement: "最小権限の原則は「必要な権限だけを与える」ことを指す。", answer: true, note: "IAM でも同じ。とりあえず管理者権限、はしない。" },
  { id: "sec-bcrypt", topics: ["セキュリティ"], statement: "bcrypt のような計算に時間がかかるハッシュ関数はパスワード保存に向いている。", answer: true, note: "総当たりを遅くするのが狙い。" },
  { id: "sec-stacktrace", topics: ["セキュリティ", "Web"], statement: "本番環境でもスタックトレースをそのまま画面に出してよい。", answer: false, note: "攻撃の手がかりになる。ログに残し、画面には出さない。" },

  // --- 設計 ---
  { id: "design-srp", topics: ["設計"], statement: "単一責任の原則は、クラスを変更する理由を 1 つにすることを指す。", answer: true, note: "変更理由が 2 つあるなら分ける。" },
  { id: "design-coupling", topics: ["設計"], statement: "密結合なモジュールほど、変更の影響範囲は小さい。", answer: false, note: "逆。疎結合ほど影響が閉じる。" },
  { id: "design-dry", topics: ["設計"], statement: "DRY 原則は「同じ知識を重複させない」ことを指す。", answer: true, note: "コードの見た目でなく知識の重複がポイント。" },
  { id: "design-idempotent", topics: ["設計", "Web"], statement: "冪等な API は、同じリクエストを複数回送っても結果が変わらない。", answer: true, note: "リトライしても安全になる。" },
  { id: "design-measure", topics: ["設計"], statement: "早すぎる最適化は避け、まず計測するのが定石である。", answer: true, note: "遅いと思った場所は、たいてい違う。" },
  { id: "design-interface", topics: ["設計"], statement: "インターフェースに依存すると、実装を差し替えにくくなる。", answer: false, note: "逆。実装でなく抽象に依存すると差し替えやすい。" },
  { id: "design-yagni", topics: ["設計", "プロジェクト"], statement: "YAGNI は「今必要でない機能も先に作っておく」原則である。", answer: false, note: "You Aren't Gonna Need It。要るまで作らない。" },
  { id: "design-backoff", topics: ["設計", "Web"], statement: "リトライに指数バックオフを入れると、相手の過負荷を避けやすい。", answer: true, note: "一斉リトライは障害を長引かせる。" },
  { id: "design-magic", topics: ["設計"], statement: "マジックナンバーはコードに直接書いたほうが読みやすい。", answer: false, note: "意味のある定数名にする。" },
  { id: "design-cycle", topics: ["設計", "テスト"], statement: "循環依存があると、モジュールを独立してテストしやすくなる。", answer: false, note: "逆。切り離せなくなる。" },
  // --- テスト ---
  { id: "test-unit-external", topics: ["テスト"], statement: "ユニットテストは外部の DB や API に実際につないで動かすのが基本である。", answer: false, note: "外部は差し替える（モック / スタブ）。実際につなぐのは統合テストの仕事。" },
  { id: "test-aaa", topics: ["テスト"], statement: "テストを Arrange / Act / Assert の3段で書く流儀がある。", answer: true, note: "準備・実行・検証。読みやすさの型。" },
  { id: "test-flaky-retry", topics: ["テスト"], statement: "落ちたり通ったりするテスト（flaky）は、通るまで再実行すれば解決したことになる。", answer: false, note: "原因（時刻・順序・非同期への依存）を潰す。再実行は隠すだけ。" },
  { id: "test-coverage-100", topics: ["テスト"], statement: "カバレッジ 100% なら、バグが無いことが保証される。", answer: false, note: "通った行があるだけ。検証（assert）が無ければ意味は薄い。" },
  { id: "test-regression", topics: ["テスト"], statement: "回帰テストは「直したバグが再発していないか」を確かめるテストである。", answer: true, note: "バグを直したら、そのバグを再現するテストを残す。" },
  { id: "test-boundary", topics: ["テスト"], statement: "境界値テストでは、上限ちょうど・上限+1 のような端の値を狙う。", answer: true, note: "バグは境界に住む。off-by-one の巣。" },
  { id: "test-order", topics: ["テスト"], statement: "テストは実行順に依存して書いたほうが、並列実行でも安定する。", answer: false, note: "各テストは独立に。順序依存は flaky の元。" },
  { id: "test-tdd", topics: ["テスト"], statement: "TDD は「先にテストを書き、失敗させてから実装する」進め方である。", answer: true, note: "Red → Green → Refactor。" },
  { id: "test-mock-everything", topics: ["テスト"], statement: "モックを増やすほど、本番の挙動に近いテストになる。", answer: false, note: "モックは切り離す道具。増やすほど本物から遠ざかる。" },
  { id: "test-e2e-many", topics: ["テスト"], statement: "E2E テストはユニットテストより速いので、数を多くするのが定石である。", answer: false, note: "逆。E2E は遅く壊れやすいので少数精鋭（テストピラミッド）。" },

  // --- Docker ---
  { id: "docker-image-container", topics: ["Docker"], statement: "Docker のイメージとコンテナは同じものを指す。", answer: false, note: "イメージは設計図、コンテナはそれから起動した実体。" },
  { id: "docker-layer-cache", topics: ["Docker"], statement: "Dockerfile の命令は上から順にレイヤになり、変更が無ければキャッシュが効く。", answer: true, note: "変わりにくい命令（依存の install）を上に書く。" },
  { id: "docker-data-persist", topics: ["Docker"], statement: "コンテナを削除すると、コンテナ内に書いたファイルは消える。", answer: true, note: "残したいものは volume に。" },
  { id: "docker-expose-publish", topics: ["Docker"], statement: "EXPOSE を書けば、ホストからそのポートにアクセスできるようになる。", answer: false, note: "EXPOSE はドキュメント。公開は -p（publish）。" },
  { id: "docker-latest", topics: ["Docker"], statement: "latest タグは「常に最新版」を自動で指し続ける特別なタグである。", answer: false, note: "ただのデフォルト名。中身は push 側次第。本番はバージョン固定。" },
  { id: "docker-compose-network", topics: ["Docker"], statement: "docker compose の同じプロジェクト内のサービスは、サービス名で互いに名前解決できる。", answer: true, note: "db:5432 のように書ける。" },
  { id: "docker-root", topics: ["Docker", "セキュリティ"], statement: "コンテナ内のプロセスは root で動かすのが安全の基本である。", answer: false, note: "USER で一般ユーザーに落とす。" },
  { id: "docker-pid1", topics: ["Docker"], statement: "コンテナは主プロセス（PID 1）が終了すると停止する。", answer: true, note: "だから CMD はフォアグラウンドで動かす。" },
  { id: "docker-dockerignore", topics: ["Docker"], statement: ".dockerignore に書いたファイルはビルドコンテキストに送られない。", answer: true, note: "node_modules や .git を除くとビルドが軽くなる。" },
  { id: "docker-stop-data", topics: ["Docker"], statement: "docker stop したコンテナは、再び start すると中のファイルが失われている。", answer: false, note: "stop / start ではコンテナ層は残る。消えるのは rm。" },

  // --- AWS ---
  { id: "aws-s3-fs", topics: ["AWS"], statement: "S3 はブロックストレージで、EC2 にディスクとしてマウントするのが基本用途である。", answer: false, note: "S3 はオブジェクトストレージ。ディスクは EBS。" },
  { id: "aws-iam-role", topics: ["AWS", "セキュリティ"], statement: "EC2 上のアプリに権限を与えるには、アクセスキーを埋め込むより IAM ロールを使うのが推奨される。", answer: true, note: "鍵の漏洩・ローテーションの手間が消える。" },
  { id: "aws-az", topics: ["AWS"], statement: "アベイラビリティゾーン（AZ）は、1つのリージョン内にある独立したデータセンター群である。", answer: true, note: "複数 AZ に置くのが可用性の基本。" },
  { id: "aws-sg-stateful", topics: ["AWS"], statement: "セキュリティグループはステートフルで、許可した通信の戻りは自動で通る。", answer: true, note: "ステートレスなのはネットワーク ACL。" },
  { id: "aws-lambda-forever", topics: ["AWS"], statement: "Lambda は1回の実行時間に上限が無く、常駐処理にも向く。", answer: false, note: "上限あり（15分）。常駐は ECS / EC2。" },
  { id: "aws-rds-ssh", topics: ["AWS"], statement: "RDS は OS に SSH でログインして自前でパッチを当てるのが前提である。", answer: false, note: "マネージド。OS は触れない。" },
  { id: "aws-cloudwatch", topics: ["AWS"], statement: "CloudWatch はメトリクスやログを集めて監視・アラームに使うサービスである。", answer: true, note: "アラーム → SNS 通知 が定番。" },
  { id: "aws-root", topics: ["AWS", "セキュリティ"], statement: "日常運用はルートユーザーで行うのが AWS の推奨である。", answer: false, note: "ルートは MFA を付けて封印。IAM ユーザー / ロールで。" },
  { id: "aws-s3-public", topics: ["AWS"], statement: "S3 バケットは作成した時点で、既定でインターネットに公開されている。", answer: false, note: "既定は非公開（パブリックアクセスブロック）。" },
  { id: "aws-vpc-subnet", topics: ["AWS"], statement: "パブリックサブネットとは、インターネットゲートウェイへの経路を持つサブネットのことである。", answer: true, note: "IGW へのルートの有無で決まる。" },

  // --- プロジェクト ---
  { id: "proj-mvp", topics: ["プロジェクト"], statement: "MVP は「最小限の機能で価値を検証する版」を指す。", answer: true, note: "Minimum Viable Product。作り込む前に確かめる。" },
  { id: "proj-brooks", topics: ["プロジェクト"], statement: "遅れているプロジェクトに人を足せば、たいてい早く終わる。", answer: false, note: "ブルックスの法則。教育と連絡のコストで遅くなりがち。" },
  { id: "proj-agile-nodoc", topics: ["プロジェクト"], statement: "アジャイル開発ではドキュメントを一切書かないのが原則である。", answer: false, note: "「包括的なドキュメントよりも動くソフトウェア」＝優先度の話。" },
  { id: "proj-sprint", topics: ["プロジェクト"], statement: "スクラムのスプリントは、期間を固定して繰り返す。", answer: true, note: "タイムボックス。伸ばさない。" },
  { id: "proj-retro", topics: ["プロジェクト"], statement: "ふりかえり（レトロスペクティブ）は失敗の犯人探しをする場である。", answer: false, note: "次を良くする場。人でなく仕組みを見る。" },
  { id: "proj-wip", topics: ["プロジェクト"], statement: "WIP 制限は、同時に進める作業の数を絞ることで流れを良くする考え方である。", answer: true, note: "カンバンの基本。" },
  { id: "proj-tradeoff", topics: ["プロジェクト"], statement: "期限・人員・スコープを全部固定したまま要求だけ増やしても、品質は変わらない。", answer: false, note: "何かを動かさないと品質が削れる（トレードオフ）。" },
  { id: "proj-early-report", topics: ["プロジェクト"], statement: "問題は小さいうちに報告したほうが、手戻りが少ない。", answer: true, note: "悪い知らせほど早く。" },

  // --- Web ---
  { id: "web-cors-browser", topics: ["Web", "HTTP"], statement: "CORS はブラウザが別オリジンへのリクエストを制御する仕組みで、サーバー同士の通信には関係ない。", answer: true, note: "許可はサーバーのヘッダで出すが、判定するのはブラウザ。" },
  { id: "web-localstorage-secure", topics: ["Web", "セキュリティ"], statement: "localStorage は JavaScript から読めないので、トークンの保存に安全である。", answer: false, note: "JS から丸見え。XSS で抜かれる。" },
  { id: "web-dom", topics: ["Web"], statement: "DOM は HTML をツリー構造として JavaScript から操作するための仕組みである。", answer: true, note: "document.querySelector は DOM への入口。" },
  { id: "web-jwt-encrypt", topics: ["Web", "セキュリティ"], statement: "JWT の中身（ペイロード）は暗号化されているので、誰にも読めない。", answer: false, note: "Base64 なので読める。署名は改ざん検知であって秘匿ではない。" },
  { id: "web-div-button", topics: ["Web"], statement: "<button> の代わりに <div> に click を付けても、キーボード操作は同じように効く。", answer: false, note: "フォーカスも Enter も効かない。ボタンは button で。" },
  { id: "web-defer", topics: ["Web"], statement: "script の defer 属性は、HTML の解析を止めずに読み込み、解析後に実行する。", answer: true, note: "async は読み込み次第すぐ実行。順序が要るなら defer。" },
  { id: "web-spa-seo", topics: ["Web"], statement: "SPA は初期 HTML がほぼ空なので、そのままではクローラに内容が伝わりにくいことがある。", answer: true, note: "SSR / SSG で補う。" },
  { id: "web-samesite", topics: ["Web", "セキュリティ"], statement: "Cookie の SameSite=Strict は、他サイトからの遷移でも Cookie を必ず送る。", answer: false, note: "Strict は送らない。緩めるなら Lax。" },

  // --- HTTP（追加） ---
  { id: "http-503", topics: ["HTTP", "Web"], statement: "503 は「サーバーが一時的に処理できない」状態を表す。", answer: true, note: "メンテナンスや過負荷。Retry-After を添えることも。" },
  { id: "http-head-body", topics: ["HTTP", "Web"], statement: "HEAD メソッドはボディも含めて GET と同じレスポンスを返す。", answer: false, note: "ヘッダだけ。存在確認やサイズ確認に使う。" },
  { id: "http-post-idem", topics: ["HTTP", "Web"], statement: "POST は同じリクエストを2回送っても、必ず同じ結果になると決められている。", answer: false, note: "POST は冪等でない。二重登録に注意。" },
  { id: "http-429", topics: ["HTTP", "Web"], statement: "429 Too Many Requests はレート制限に引っかかった時に返る。", answer: true, note: "叩きすぎ。バックオフして再試行。" },

  // --- SQL（追加） ---
  { id: "sql-union-dup", topics: ["SQL"], statement: "UNION は重複行をそのまま残し、UNION ALL は重複を除く。", answer: false, note: "逆。UNION が重複除去。速いのは ALL。" },
  { id: "sql-atomic", topics: ["SQL", "設計"], statement: "トランザクションは「全部成功か、全部取り消し」を保証する（原子性）。", answer: true, note: "ACID の A。" },
  { id: "sql-like-prefix", topics: ["SQL"], statement: "LIKE '%abc' のような前方ワイルドカードは、通常の B-tree インデックスが効きにくい。", answer: true, note: "先頭が決まらないと木を辿れない。" },
  { id: "sql-delete-no-where", topics: ["SQL"], statement: "WHERE の無い DELETE は、1行も消さずにエラーになる。", answer: false, note: "全行消える。実行前に SELECT で件数を見る。" },

  // --- Linux（追加） ---
  { id: "linux-sudo", topics: ["Linux"], statement: "sudo は一般ユーザーが一時的に管理者権限でコマンドを実行する仕組みである。", answer: true, note: "root で常駐ログインしない。" },
  { id: "linux-df-du", topics: ["Linux"], statement: "df はディスクの空き、du はディレクトリの使用量を表示する。", answer: true, note: "満杯なら df -h → du で犯人探し。" },
  { id: "linux-root-home", topics: ["Linux"], statement: "root ユーザーのホームディレクトリは /home/root である。", answer: false, note: "/root。" },
  { id: "linux-symlink", topics: ["Linux"], statement: "シンボリックリンクは、元ファイルを消しても中身がそのまま残る。", answer: false, note: "指し先が消えれば壊れる。残るのはハードリンク。" },

  // --- Git（追加） ---
  { id: "git-merge-ff", topics: ["Git"], statement: "fast-forward マージでは、マージコミットは作られない。", answer: true, note: "ブランチのポインタが進むだけ。" },
  { id: "git-force-push", topics: ["Git"], statement: "git push --force は他人の push を上書きすることがあるので、共有ブランチでは避ける。", answer: true, note: "どうしても要るなら --force-with-lease。" },
  { id: "git-add-p", topics: ["Git"], statement: "git add -p はファイル単位でしか選べない。", answer: false, note: "変更の塊（hunk）ごとに選べる。" },
  { id: "git-tag-move", topics: ["Git"], statement: "git のタグは、コミットが増えると自動で最新のコミットに移動する。", answer: false, note: "タグは固定。動くのはブランチ。" },

  // --- セキュリティ（追加） ---
  { id: "sec-salt", topics: ["セキュリティ"], statement: "パスワードのソルトは秘密にしなくてよい。", answer: true, note: "役割はレインボーテーブル対策。ハッシュと一緒に保存する。" },
  { id: "sec-rate-limit", topics: ["セキュリティ", "Web"], statement: "ログインの試行回数制限はブルートフォース対策になる。", answer: true, note: "回数・間隔・ロック。" },
  { id: "sec-obscurity", topics: ["セキュリティ"], statement: "アルゴリズムを秘密にしておけば、鍵が漏れても安全である。", answer: false, note: "ケルクホフスの原則。秘密は鍵だけに。" },
  { id: "sec-env-commit", topics: ["セキュリティ", "Git"], statement: ".env の秘密情報は、コミットしても後から .gitignore に足せば履歴から消える。", answer: false, note: "履歴に残る。漏れたら鍵を無効化して再発行。" },

  // --- 設計（追加） ---
  { id: "design-cache-tradeoff", topics: ["設計"], statement: "キャッシュを入れると、データの鮮度と速度のトレードオフが生まれる。", answer: true, note: "無効化のタイミングが設計の芯。" },
  { id: "design-god-class", topics: ["設計"], statement: "何でも知っている巨大なクラス（God クラス）は、変更に強い設計である。", answer: false, note: "どこを触っても壊れる。責務で分ける。" },
  { id: "design-fail-fast", topics: ["設計"], statement: "フェイルファストは、異常を早く検知して即座に止める考え方である。", answer: true, note: "黙って進むより早く倒れる。" },
  { id: "design-log-context", topics: ["設計", "Linux"], statement: "ログには何が起きたかだけ書き、いつ・どこで は不要である。", answer: false, note: "時刻・場所（リクエスト ID 等）が無いと追えない。" },
];

const CHOICES: Omit<ChoiceRiddle, "kind">[] = [
  // --- テスト ---
  { id: "tq-pyramid", topics: ["テスト"], prompt: "テストピラミッドで「数を多く・速く」が基本とされる層はどれ？", choices: ["E2E テスト", "ユニットテスト", "手動テスト", "負荷テスト"], answerIndex: 1, note: "土台はユニット。上に行くほど少なく。" },
  { id: "tq-stub-mock", topics: ["テスト"], prompt: "「呼ばれたか・何回呼ばれたか」を検証するために使うテストダブルは？", choices: ["スタブ", "フィクスチャ", "スナップショット", "モック"], answerIndex: 3, note: "スタブは値を返すだけ。検証まで担うのがモック。" },
  { id: "tq-boundary", topics: ["テスト"], prompt: "「1〜100 が有効」という仕様の境界値テストで、最も外しにくい入力の組み合わせは？", choices: ["0・1・100・101", "50 と 75", "-100 と 200", "1 だけ"], answerIndex: 0, note: "境界の内側と外側を両方踏む。" },
  { id: "tq-flaky-cause", topics: ["テスト"], prompt: "flaky テストの原因として最も典型的なものは？", choices: ["assert が多すぎる", "テスト名が長い", "時刻や非同期処理への依存", "関数が純粋すぎる"], answerIndex: 2, note: "時刻は注入、非同期は待ち方を直す。" },
  { id: "tq-ci-fail", topics: ["テスト", "プロジェクト"], prompt: "CI でテストが落ちたときに、まずやるべきことは？", choices: ["通るまで再実行する", "テストを skip にする", "main に直接 push する", "落ちた原因を再現して特定する"], answerIndex: 3, note: "再現できれば半分直ったようなもの。" },
  { id: "tq-arrange", topics: ["テスト"], prompt: "AAA パターンの3つ目の A は？", choices: ["Assign", "Assert", "Await", "Attach"], answerIndex: 1, note: "Arrange（準備）→ Act（実行）→ Assert（検証）。" },

  // --- Git ---
  { id: "gq-undo-last", topics: ["Git"], prompt: "直前のコミットを取り消しつつ、変更は作業ツリーに残したい。使うのは？", choices: ["git reset HEAD~1", "git reset --hard HEAD~1", "git checkout .", "git clean -fd"], answerIndex: 0, note: "--hard は変更ごと消える。既定（--mixed）なら作業ツリーに残る。" },
  { id: "gq-conflict", topics: ["Git"], prompt: "マージでコンフリクトした。ファイルを直した後に行うのは？", choices: ["git reset --hard", "git push --force", "git add して commit", "git stash"], answerIndex: 2, note: "解決したファイルを add して、マージコミットを作る。" },
  { id: "gq-cherry", topics: ["Git"], prompt: "別ブランチの特定コミット1つだけを今のブランチに取り込むコマンドは？", choices: ["git merge", "git rebase", "git fetch", "git cherry-pick"], answerIndex: 3, note: "ホットフィックスを別ブランチにも当てる時の定番。" },
  { id: "gq-head", topics: ["Git"], prompt: "HEAD が指しているものとして正しいのは？", choices: ["リモートの最新コミット", "今チェックアウトしているコミット（またはブランチ）", "最初のコミット", "ステージング領域"], answerIndex: 1, note: "HEAD~1 は「その1つ前」。" },
  { id: "gq-bisect", topics: ["Git"], prompt: "「どのコミットでバグが入ったか」を二分探索で見つけるコマンドは？", choices: ["git blame", "git bisect", "git log -S", "git diff"], answerIndex: 1, note: "good / bad を答えるだけで絞り込める。" },
  { id: "gq-gitignore-env", topics: ["Git", "セキュリティ"], prompt: ".gitignore に書くべきものとして最も適切なのは？", choices: ["package.json", "README.md", "src/ 配下のソース", ".env（秘密情報）"], answerIndex: 3, note: "鍵と生成物は追跡しない。" },

  // --- SQL ---
  { id: "sq-groupby", topics: ["SQL"], prompt: "部署ごとの社員数を出す SQL として正しいのは？", choices: ["SELECT dept, COUNT(*) FROM emp", "SELECT dept, COUNT(*) FROM emp GROUP BY dept", "SELECT COUNT(dept) FROM emp ORDER BY dept", "SELECT dept FROM emp HAVING COUNT(*)"], answerIndex: 1, note: "集計の単位は GROUP BY で決める。" },
  { id: "sq-n1", topics: ["SQL", "設計"], prompt: "ORM で一覧を出すと「1件ごとに SELECT が飛んで遅い」。この現象の名前は？", choices: ["N+1 問題", "デッドロック", "ファントムリード", "フルスキャン"], answerIndex: 0, note: "JOIN か一括取得（IN）でまとめる。" },
  { id: "sq-explain", topics: ["SQL"], prompt: "クエリがインデックスを使っているか確認するのに使うのは？", choices: ["DESCRIBE", "SHOW GRANTS", "EXPLAIN", "VACUUM"], answerIndex: 2, note: "実行計画を読む。Seq Scan が出たら疑う。" },
  { id: "sq-isolation", topics: ["SQL"], prompt: "同じトランザクション内で同じ行を2回読んだら値が変わっていた。この現象は？", choices: ["ダーティリード", "ロストアップデート", "カーディナリティ", "ノンリピータブルリード"], answerIndex: 3, note: "分離レベル REPEATABLE READ 以上で防げる。" },
  { id: "sq-leftjoin-missing", topics: ["SQL"], prompt: "注文が一件も無い顧客を一覧したい。使う組み合わせは？", choices: ["INNER JOIN + WHERE 注文.id IS NULL", "LEFT JOIN + WHERE 注文.id IS NULL", "CROSS JOIN", "UNION"], answerIndex: 1, note: "「一致しない側」は LEFT JOIN で NULL になる。" },
  { id: "sq-pk", topics: ["SQL", "設計"], prompt: "主キー（PRIMARY KEY）の性質として正しいのは？", choices: ["NULL を許す", "重複を許す", "一意で NULL 不可", "文字列しか使えない"], answerIndex: 2, note: "行を一意に指す鍵。" },

  // --- HTTP ---
  { id: "hq-201", topics: ["HTTP", "Web"], prompt: "リソースの作成に成功したときに返すのが慣例のステータスは？", choices: ["200", "201", "204", "301"], answerIndex: 1, note: "Created。Location ヘッダで新しい場所を返すことも。" },
  { id: "hq-idempotent-set", topics: ["HTTP", "Web"], prompt: "冪等とされるメソッドの組み合わせは？", choices: ["POST / PATCH", "GET / POST", "GET / PUT / DELETE", "PATCH / DELETE"], answerIndex: 2, note: "同じ要求を繰り返しても結果が同じ。" },
  { id: "hq-etag", topics: ["HTTP", "Web"], prompt: "「変わっていなければ 304 を返して」と頼む条件付きリクエストのヘッダは？", choices: ["Content-Type", "Authorization", "Set-Cookie", "If-None-Match"], answerIndex: 3, note: "ETag と組で使う。転送量が減る。" },
  { id: "hq-cache-control", topics: ["HTTP", "Web"], prompt: "レスポンスを CDN にもブラウザにも1時間キャッシュさせたい。Cache-Control の値は？", choices: ["public, max-age=3600", "no-store", "private, max-age=3600", "must-revalidate"], answerIndex: 0, note: "private は共有キャッシュ（CDN）に置かせない。" },
  { id: "hq-bearer", topics: ["HTTP", "セキュリティ"], prompt: "API トークンを Authorization ヘッダで送るときの一般的な形式は？", choices: ["Authorization: Token=xxx", "Authorization: Bearer xxx", "X-Auth: xxx", "Cookie: token=xxx"], answerIndex: 1, note: "Bearer = 持っている者。漏れたら誰でも使える。" },
  { id: "hq-timeout", topics: ["HTTP", "Web"], prompt: "サーバーが上流（バックエンド）からの応答を待ちきれなかったときのステータスは？", choices: ["408", "500", "502", "504"], answerIndex: 3, note: "504 Gateway Timeout。502 は上流が変な応答を返した時。" },

  // --- Web ---
  { id: "wq-xss-fix", topics: ["Web", "セキュリティ"], prompt: "ユーザー入力を画面に出すときの XSS 対策として最も基本なのは？", choices: ["入力を全部禁止する", "HTTPS にする", "出力時に HTML エスケープする", "Cookie を消す"], answerIndex: 2, note: "入口で弾くより出口で無害化。" },
  { id: "wq-event-loop", topics: ["Web"], prompt: "JavaScript で setTimeout(fn, 0) のコールバックが動くタイミングは？", choices: ["即座に同期実行", "今の同期処理が全部終わった後", "1秒後", "次のページ遷移時"], answerIndex: 1, note: "イベントループ。0 でも「あとで」。" },
  { id: "wq-cors-header", topics: ["Web", "HTTP"], prompt: "別オリジンからの fetch を許可するためにサーバーが返すヘッダは？", choices: ["X-Frame-Options", "Access-Control-Allow-Origin", "Content-Security-Policy", "Referrer-Policy"], answerIndex: 1, note: "* は認証付きリクエストには使えない。" },
  { id: "wq-preflight", topics: ["Web", "HTTP"], prompt: "CORS のプリフライトリクエストで使われる HTTP メソッドは？", choices: ["GET", "HEAD", "OPTIONS", "TRACE"], answerIndex: 2, note: "本番の前に「送ってもいい？」と聞く。" },
  { id: "wq-lcp", topics: ["Web"], prompt: "Core Web Vitals のうち「最大の要素が表示されるまでの時間」を表す指標は？", choices: ["LCP", "CLS", "INP", "TTFB"], answerIndex: 0, note: "Largest Contentful Paint。画像とフォントが効く。" },
  { id: "wq-csrf-fix", topics: ["Web", "セキュリティ"], prompt: "CSRF の対策として適切なのは？", choices: ["パスワードを長くする", "画像を遅延読み込みする", "gzip 圧縮", "リクエストごとのトークン検証"], answerIndex: 3, note: "SameSite Cookie と併用する。" },

  // --- 設計 ---
  { id: "dq-solid-o", topics: ["設計"], prompt: "SOLID の O（Open/Closed）が言っているのは？", choices: ["公開メソッドは少なく", "拡張に開き、修正に閉じる", "オブジェクトは不変に", "継承より合成"], answerIndex: 1, note: "足すときに既存を壊さない。" },
  { id: "dq-di", topics: ["設計", "テスト"], prompt: "依存性注入（DI）の主な狙いは？", choices: ["実行速度の向上", "メモリ削減", "依存先を差し替え可能にしてテストしやすくする", "コード量を減らす"], answerIndex: 2, note: "new を外に出す。" },
  { id: "dq-circuit", topics: ["設計", "Web"], prompt: "外部サービスが落ちている間、呼び出しを一時的に止めて連鎖障害を防ぐパターンは？", choices: ["シングルトン", "オブザーバー", "デコレータ", "サーキットブレーカー"], answerIndex: 3, note: "落ちた相手を叩き続けない。" },
  { id: "dq-cqrs", topics: ["設計"], prompt: "「読み取り」と「書き込み」でモデルを分ける設計パターンは？", choices: ["CQRS", "MVC", "DDD", "REST"], answerIndex: 0, note: "Command Query Responsibility Segregation。" },
  { id: "dq-tech-debt", topics: ["設計", "プロジェクト"], prompt: "技術的負債の扱いとして最も健全なのは？", choices: ["見つけたら全部その場で返す", "無視して機能開発だけ続ける", "可視化して、利子（影響）の大きいものから計画的に返す", "負債は作らないルールにする"], answerIndex: 2, note: "負債は悪ではない。見えないのが悪。" },
  { id: "dq-idempotency-key", topics: ["設計", "HTTP"], prompt: "決済 API の二重実行を防ぐために、クライアントがリクエストに付けるものは？", choices: ["タイムスタンプだけ", "冪等キー（Idempotency-Key）", "ユーザーエージェント", "Content-Length"], answerIndex: 1, note: "同じキーなら2回目は前回の結果を返す。" },

  // --- Linux ---
  { id: "lq-port-proc", topics: ["Linux"], prompt: "ポート 3000 を使っているプロセスを調べるコマンドは？", choices: ["ps 3000", "lsof -i :3000", "ls -la 3000", "cat /proc/3000"], answerIndex: 1, note: "ss -lntp でも。" },
  { id: "lq-disk-full", topics: ["Linux"], prompt: "「No space left on device」。まず確認すべきは？", choices: ["free -m", "top", "df -h と du で大きいディレクトリ", "uptime"], answerIndex: 2, note: "たいていログか一時ファイル。" },
  { id: "lq-perm-denied", topics: ["Linux"], prompt: "自分のスクリプトを ./run.sh で実行したら Permission denied。対処は？", choices: ["chmod +x run.sh", "chown root run.sh", "rm run.sh", "sudo reboot"], answerIndex: 0, note: "実行ビットが無いだけ。" },
  { id: "lq-env", topics: ["Linux"], prompt: "環境変数を「このシェルと子プロセスから見える」ように設定するのは？", choices: ["FOO=bar だけ", "echo FOO=bar", "set FOO", "export FOO=bar"], answerIndex: 3, note: "export しないと子プロセスに渡らない。" },
  { id: "lq-grep-r", topics: ["Linux"], prompt: "ディレクトリ配下を再帰的に検索して、一致した行番号も出す grep のオプションは？", choices: ["-rn", "-il", "-c", "-v"], answerIndex: 0, note: "-r 再帰、-n 行番号。" },
  { id: "lq-journal", topics: ["Linux"], prompt: "systemd 環境でサービスのログを見るコマンドは？", choices: ["cat /var/log/service", "journalctl -u <service>", "dmesg -u", "syslog <service>"], answerIndex: 1, note: "-f で追い続ける。" },

  // --- Docker ---
  { id: "dkq-build-cache", topics: ["Docker"], prompt: "Dockerfile で依存インストールのキャッシュを効かせるための順序として良いのは？", choices: ["ソース全部 COPY → install", "install → 全部 COPY → もう一度 install", "package.json だけ COPY → install → ソース COPY", "順序は関係ない"], answerIndex: 2, note: "ソースを変えても install 層は再利用される。" },
  { id: "dkq-volume", topics: ["Docker"], prompt: "DB のデータをコンテナ削除後も残したい。使うのは？", choices: ["EXPOSE", "ENTRYPOINT", "--rm", "volume"], answerIndex: 3, note: "compose なら volumes: に書く。" },
  { id: "dkq-logs", topics: ["Docker"], prompt: "動いているコンテナの標準出力を見るコマンドは？", choices: ["docker logs <name>", "docker inspect <name>", "docker top <name>", "docker images"], answerIndex: 0, note: "-f で追い続ける。" },
  { id: "dkq-exec", topics: ["Docker"], prompt: "動いているコンテナの中でシェルを開くコマンドは？", choices: ["docker run -it <name> sh", "docker attach --shell <name>", "docker exec -it <name> sh", "docker start <name> sh"], answerIndex: 2, note: "run は新しいコンテナを作ってしまう。" },
  { id: "dkq-image-size", topics: ["Docker"], prompt: "イメージを小さくする手として適切なのは？", choices: ["全部 root で動かす", "マルチステージビルドで実行に要るものだけ残す", "latest を使う", "RUN を1つずつ分ける"], answerIndex: 1, note: "ビルド道具を最終イメージに持ち込まない。" },
  { id: "dkq-compose-depends", topics: ["Docker"], prompt: "compose で「DB が起動してから app を起動」の順序を指定するキーは？", choices: ["links", "volumes", "ports", "depends_on"], answerIndex: 3, note: "起動順だけ。準備完了を待つなら healthcheck と組で。" },

  // --- セキュリティ ---
  { id: "scq-hash-pw", topics: ["セキュリティ"], prompt: "パスワードの保存に適切なのは？", choices: ["MD5", "SHA-1", "Base64", "bcrypt / Argon2"], answerIndex: 3, note: "遅いハッシュ＋ソルト。" },
  { id: "scq-sqli", topics: ["セキュリティ", "SQL"], prompt: "SQL インジェクションの根本対策は？", choices: ["入力を短くする", "プレースホルダ（バインド変数）", "エラーメッセージを隠す", "HTTPS"], answerIndex: 1, note: "値と構文を分ける。" },
  { id: "scq-secret-leak", topics: ["セキュリティ", "Git"], prompt: "GitHub に API キーを push してしまった。最初にすべきは？", choices: ["履歴を rebase して消す", "README に注意書き", "そのキーを無効化して再発行", "そのまま様子見"], answerIndex: 2, note: "push した瞬間に漏れたと思う。消すより先に無効化。" },
  { id: "scq-mfa-factor", topics: ["セキュリティ"], prompt: "多要素認証の「所持」要素にあたるのは？", choices: ["スマホの認証アプリ", "パスワード", "秘密の質問", "指紋"], answerIndex: 0, note: "知識 = パスワード、生体 = 指紋。" },
  { id: "scq-least-priv", topics: ["セキュリティ", "AWS"], prompt: "最小権限の原則に沿った対応は？", choices: ["全員に管理者権限", "共有アカウントを使う", "権限は一度決めたら見直さない", "必要な操作だけ許可したロールを割り当てる"], answerIndex: 3, note: "足りなければ足す。最初から盛らない。" },
  { id: "scq-csp", topics: ["セキュリティ", "Web"], prompt: "インラインスクリプトの実行を制限して XSS の影響を抑えるヘッダは？", choices: ["Content-Security-Policy", "Cache-Control", "Accept-Language", "ETag"], answerIndex: 0, note: "許可した出所のスクリプトしか動かない。" },

  // --- AWS ---
  { id: "aq-static-site", topics: ["AWS", "Web"], prompt: "静的サイトを配信する構成として最も一般的なのは？", choices: ["EC2 で Apache", "RDS", "S3 + CloudFront", "Lambda だけ"], answerIndex: 2, note: "サーバー無しで安く速い。" },
  { id: "aq-iam-deny", topics: ["AWS", "セキュリティ"], prompt: "IAM ポリシーで Allow と明示的な Deny が両方当たった場合は？", choices: ["Allow が勝つ", "Deny が勝つ", "後に書いた方が勝つ", "エラーになる"], answerIndex: 1, note: "明示的 Deny は最強。" },
  { id: "aq-rds-multi-az", topics: ["AWS"], prompt: "RDS のマルチ AZ 配置の主な目的は？", choices: ["読み取り性能の向上", "コスト削減", "バックアップの省略", "可用性（自動フェイルオーバー）"], answerIndex: 3, note: "読み取り性能はリードレプリカ。" },
  { id: "aq-sqs", topics: ["AWS", "設計"], prompt: "処理を非同期のキューに積んでワーカーで捌きたい。使うのは？", choices: ["SQS", "Route 53", "CloudFront", "IAM"], answerIndex: 0, note: "受け付けと処理を切り離す。" },
  { id: "aq-cost", topics: ["AWS"], prompt: "夜間・休日に使わない検証用 EC2 のコストを抑える最も素直な手は？", choices: ["リージョンを変える", "インスタンスを止める", "EBS を増やす", "ログを消す"], answerIndex: 1, note: "止めれば計算料金は止まる（EBS は残る）。" },
  { id: "aq-secrets", topics: ["AWS", "セキュリティ"], prompt: "DB のパスワードをアプリに渡すのに適したサービスは？", choices: ["S3 の公開バケット", "CloudFront", "Secrets Manager / Parameter Store", "EC2 のユーザーデータに平文"], answerIndex: 2, note: "ローテーションも任せられる。" },

  // --- プロジェクト ---
  { id: "pq-estimate", topics: ["プロジェクト"], prompt: "見積もりが不確かなタスクに対して健全なやり方は？", choices: ["最短で言い切る", "黙っておく", "他人に決めてもらう", "幅（最良〜最悪）で伝え、前提を添える"], answerIndex: 3, note: "不確かさを隠さず数字にする。" },
  { id: "pq-scope-creep", topics: ["プロジェクト"], prompt: "スプリント途中に「ついでにこれも」と要求が増え続ける現象は？", choices: ["バーンダウン", "スコープクリープ", "ベロシティ", "デイリースクラム"], answerIndex: 1, note: "次のスプリントに回すのが基本。" },
  { id: "pq-daily", topics: ["プロジェクト"], prompt: "デイリースクラムの目的は？", choices: ["チームが今日の計画と障害を共有する", "進捗を上司に報告する", "仕様を決める", "工数を集計する"], answerIndex: 0, note: "報告会ではなく同期の場。" },
  { id: "pq-blocked", topics: ["プロジェクト"], prompt: "自分のタスクが他チームの返事待ちで止まった。最初にやることは？", choices: ["何もせず待つ", "勝手に仕様を決めて進める", "止まっていることを共有し、別の進められる作業に移る", "タスクを消す"], answerIndex: 2, note: "止まっていることを見えるようにする。" },
  { id: "pq-dod", topics: ["プロジェクト", "テスト"], prompt: "「完成の定義（Definition of Done）」に含めるべきなのは？", choices: ["担当者の気分", "テスト・レビュー・デプロイなどの完了条件", "顧客の実名", "会議の議事録"], answerIndex: 1, note: "「できた」の意味をチームで揃える。" },
  { id: "pq-postmortem", topics: ["プロジェクト", "設計"], prompt: "障害のふりかえりで最も重視するのは？", choices: ["誰のミスか特定する", "報告書を長く書く", "責任者を交代する", "再発防止のために仕組みを直す"], answerIndex: 3, note: "人を責めると次から報告が遅れる。" },
];

/** 戦闘用の問題マスタ（○× と 四択 をまとめたもの） */
export const RIDDLES: Riddle[] = [
  ...TRUE_FALSE.map((r): Riddle => ({ kind: "truefalse", ...r })),
  ...CHOICES.map((r): Riddle => ({ kind: "choice", ...r })),
];

/** ○× の選択肢（choices の並びは固定。index 0 = ○） */
export const TRUE_FALSE_CHOICES = ["○ 正しい", "× まちがい"] as const;

export function riddleById(id: string): Riddle | undefined {
  return RIDDLES.find((r) => r.id === id);
}
