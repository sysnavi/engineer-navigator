// 戦闘用の ○× 問題（TSマスタ）。
//
// 浅い階の雑魚戦を「○×5連」の高速ラウンドにするための問題。
// 良問バンク（DB）が薄い環境でも戦闘が成立する保険を兼ねる。
// 採点はサーバー（session-actions）で行い、answer はクライアントに渡さない。
//
// 【拡充のしかた】配列に足すだけ。id は一意に。topics は良問バンクの topic と同じ語彙で。
// ○と×の数は偏らせない（どちらかを押し続ければ勝てる問題群にしない）。

export type Riddle = {
  id: string;
  topics: string[];
  statement: string;
  answer: boolean;
  /** 解答後に出す一言（正誤どちらでも出す） */
  note: string;
};

export const RIDDLES: Riddle[] = [
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
];

/** ○× の選択肢（choices の並びは固定。index 0 = ○） */
export const TRUE_FALSE_CHOICES = ["○ 正しい", "× まちがい"] as const;

export function riddleById(id: string): Riddle | undefined {
  return RIDDLES.find((r) => r.id === id);
}
