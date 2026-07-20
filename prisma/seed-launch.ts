// 公開用の初期データ（社内公開時に1回だけ流す）。
//
//   DATABASE_URL="<neon-direct-url>" npm run seed:launch
//
// 【方針】初回訪問者に「作り込まれている」と感じてもらうためのデータを入れる。
// ただし **架空の同僚を装ったアカウントは作らない**。社内公開では「この人だれ？」が
// すぐ露見し、分かった瞬間にツールへの信頼が落ちるため。
// 代わりに正体が明らかな「EN運営」名義で、話の呼び水と実用的なコンテンツを置く。
//
//   よもやま … 運営からの話題ふり（空っぽ感をなくし、投稿のハードルを下げる）
//   良問バンク … 実際に解く価値のある四択（偽装ではなく純粋なコンテンツ価値）
//
// 何度流しても同じ結果になる（固定IDでupsert）。開発用の prisma/seed.ts とは別物で、
// あちらのデモユーザー（〜デモ）には触らない。

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DAY = 86400_000;
const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * DAY - hours * 3600_000);

async function main() {
  // -------------------------------------------------------------------------
  // 運営アカウント（正体を隠さない。プロフィールにも「運営です」と書く）
  // -------------------------------------------------------------------------
  // 表示は「ハンドル > 表示名」の優先順（yomoyama/page.tsx）。ハンドルを付けると
  // 英字IDが出て運営だと伝わらないので、あえてハンドルなしにして「EN運営」を出す。
  // 発見ページにも載せない（スキルを育てている人の一覧に運営が混ざると紛らわしい）。
  const staff = await prisma.user.upsert({
    where: { id: "en-staff" },
    update: { name: "EN運営", handle: null, isPublic: false },
    create: {
      id: "en-staff",
      name: "EN運営",
      role: "ADMIN",
      consentedAt: new Date(),
      tutorialCompletedAt: new Date(),
      bio: "Engineer Navigator の運営アカウントです。",
      isPublic: false,
    },
  });
  console.log(`運営アカウント: ${staff.name}（投稿者名として表示されます）`);

  // -------------------------------------------------------------------------
  // よもやま: 運営からの話題ふり
  // 「まだ投稿はありません」の空っぽ感をなくす。内容は答えやすい問いかけにして、
  // 最初の1人が書き込むハードルを下げる役割を持たせる。
  // -------------------------------------------------------------------------
  const posts: { id: string; body: string; days: number; hours?: number }[] = [
    {
      id: "launch-y-01",
      body: "はじめまして、EN運営です。ここは現場の悲喜こもごもを気軽に書ける場所です。ハンドル名で残るので、こわがらずにどうぞ。まずは「今週いちばん時間を溶かしたこと」から書いてみませんか？",
      days: 6,
    },
    {
      id: "launch-y-02",
      body: "本番のログを追いかけて3時間、原因が環境変数のスペルミスだったときの脱力感、共有したい。",
      days: 5,
      hours: 4,
    },
    {
      id: "launch-y-03",
      body: "「ちょっといいですか」から始まる相談が30分コースだったこと、あるあるだと思っています。逆に、短く終わらせるコツがある方いたら教えてほしい。",
      days: 4,
    },
    {
      id: "launch-y-04",
      body: "レビューで指摘するとき、どう書けば角が立たないか毎回悩みます。「〜した方がいい」より「〜だと自分は読みやすかったです」の方が受け取りやすい気がしている。",
      days: 3,
      hours: 6,
    },
    {
      id: "launch-y-05",
      body: "資格の勉強、朝と夜どっち派ですか。自分は朝30分に振り切ってから続くようになりました。",
      days: 2,
      hours: 2,
    },
    {
      id: "launch-y-06",
      body: "客先で「それ前も言いましたよね」と言われて凹んだ日。議事録を残す習慣がなかった自分の負けでした。以来、その場でメモを画面共有しながら書くようにしています。",
      days: 1,
      hours: 8,
    },
    {
      id: "launch-y-07",
      body: "はじめて後輩のメンターを任されました。教えるつもりが、自分の理解の穴を見つけてもらってばかりです。",
      days: 1,
    },
    {
      id: "launch-y-08",
      body: "ダンジョンに潜らせたら地下1階で帰ってきました。うちの子、もう少し頑張ってほしい。",
      days: 0,
      hours: 5,
    },
  ];

  for (const p of posts) {
    await prisma.yomoyamaPost.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        authorId: staff.id,
        body: p.body,
        createdAt: ago(p.days, p.hours ?? 0),
      },
    });
  }
  console.log(`よもやま: ${posts.length}件（運営名義の話題ふり）`);

  // -------------------------------------------------------------------------
  // 良問バンク: 実際に解く価値のある四択
  // 「腕試しが数回で尽きる」のを防ぐのが目的。作者は運営名義で、
  // 現場で判断を間違えやすい所を選んである。
  // -------------------------------------------------------------------------
  const quizzes: {
    id: string;
    topic: string;
    domains: string[];
    prompt: string;
    choices: string[];
    answerIndex: number;
    explanation: string;
  }[] = [
    {
      id: "lq-net-1",
      topic: "TCP/IP",
      domains: ["infra"],
      prompt: "TIME_WAIT が大量に残るのは通常どちら側？",
      choices: ["先に close した側", "後に close した側", "常にサーバ側", "常にクライアント側"],
      answerIndex: 0,
      explanation:
        "TIME_WAIT は能動的に close した側に残る。遅れて届くパケットを誤って新しい接続に混ぜないための待機時間。サーバが先に切る設計だとサーバ側に溜まる。",
    },
    {
      id: "lq-net-2",
      topic: "HTTP",
      domains: ["web"],
      prompt: "リダイレクトで 301 と 302 を使い分ける基準は？",
      choices: [
        "301は恒久的な移動でキャッシュされる、302は一時的",
        "301は一時的、302は恒久的",
        "どちらも同じでブラウザが勝手に決める",
        "301はHTTPSのみで使える",
      ],
      answerIndex: 0,
      explanation:
        "301はブラウザや中継に強くキャッシュされるため、間違えるとURLを戻したくても戻せなくなる。迷ったら302（または307）から始めるのが安全。",
    },
    {
      id: "lq-net-3",
      topic: "HTTP",
      domains: ["web"],
      prompt: "CORSのプリフライト（OPTIONS）が飛ぶのはどれ？",
      choices: [
        "単純なGETリクエスト",
        "Content-Type: application/json のPOST",
        "同一オリジンへのPOST",
        "画像の読み込み",
      ],
      answerIndex: 1,
      explanation:
        "application/json は「単純リクエスト」の条件から外れるためプリフライトが発生する。サーバ側で OPTIONS に応答していないと本リクエストまで届かない。",
    },
    {
      id: "lq-sql-1",
      topic: "SQL",
      domains: ["web", "fullstack"],
      prompt: "「N+1問題」の説明として正しいのは？",
      choices: [
        "1件のクエリが N 回失敗すること",
        "一覧取得の後、各行ごとに追加クエリが飛んでN回発行されること",
        "インデックスがN個必要になること",
        "トランザクションがN重にネストすること",
      ],
      answerIndex: 1,
      explanation:
        "ORMで関連を遅延ロードすると起きやすい。JOINやeager loading、IN句でまとめて取ることで1〜2クエリに減らせる。件数が増えてから顕在化するので開発時に気づきにくい。",
    },
    {
      id: "lq-sql-2",
      topic: "SQL",
      domains: ["web"],
      prompt: "複合インデックス (a, b) が効きにくいのはどの検索？",
      choices: [
        "WHERE a = ? AND b = ?",
        "WHERE a = ?",
        "WHERE b = ?",
        "WHERE a = ? ORDER BY b",
      ],
      answerIndex: 2,
      explanation:
        "複合インデックスは左側から使う。先頭のaを条件に含まないbだけの検索では原則使えない（インデックススキップスキャンが効く場合を除く）。",
    },
    {
      id: "lq-sql-3",
      topic: "SQL",
      domains: ["web"],
      prompt: "トランザクション分離レベル READ COMMITTED で起こりうるのは？",
      choices: [
        "ダーティリード",
        "ファントムリード",
        "何も起きない",
        "常にデッドロック",
      ],
      answerIndex: 1,
      explanation:
        "READ COMMITTED はコミット済みだけを読むのでダーティリードは防げるが、同一トランザクション内で2回読むと結果が変わる（ファントム/ノンリピータブルリード）ことがある。",
    },
    {
      id: "lq-aws-1",
      topic: "AWS IAM",
      domains: ["infra"],
      prompt: "EC2上のアプリからS3を読むとき、最も安全な認証情報の渡し方は？",
      choices: [
        "アクセスキーをソースコードに書く",
        "アクセスキーを環境変数に置く",
        "インスタンスプロファイル（IAMロール）をアタッチする",
        "S3を公開設定にする",
      ],
      answerIndex: 2,
      explanation:
        "ロールをアタッチすれば一時認証情報が自動で供給され、キーの管理・ローテーションが不要になる。キーを置く方式はどこかで漏れる前提で考えると避けたい。",
    },
    {
      id: "lq-aws-2",
      topic: "AWS",
      domains: ["infra"],
      prompt: "セキュリティグループとネットワークACLの違いで正しいのは？",
      choices: [
        "SGはステートフル、NACLはステートレス",
        "SGはステートレス、NACLはステートフル",
        "どちらもステートフル",
        "どちらもサブネット単位で効く",
      ],
      answerIndex: 0,
      explanation:
        "SGは戻りの通信が自動で許可される（ステートフル）。NACLは行き帰りを両方書く必要がある。NACLで戻りポートを開け忘れて通信できない、は定番のハマり。",
    },
    {
      id: "lq-linux-1",
      topic: "Linux",
      domains: ["infra"],
      prompt: "ディスクを空けたのに df の使用量が減らないときに疑うのは？",
      choices: [
        "ファイルシステムの破損",
        "削除したファイルをプロセスが開いたままである",
        "inodeの枯渇",
        "スワップの不足",
      ],
      answerIndex: 1,
      explanation:
        "プロセスが開いているファイルは削除しても領域が解放されない。`lsof | grep deleted` で特定し、該当プロセスを再起動すると解放される。ログファイルでよく起きる。",
    },
    {
      id: "lq-linux-2",
      topic: "Linux",
      domains: ["infra"],
      prompt: "ロードアベレージが「4.0」。CPUが4コアのとき最も近い解釈は？",
      choices: [
        "CPU使用率が4%",
        "実行待ちを含む平均タスク数が4で、ほぼ使い切っている状態",
        "4つのプロセスが停止している",
        "メモリが4GB足りない",
      ],
      answerIndex: 1,
      explanation:
        "ロードアベレージは実行中＋実行待ち（Linuxではディスク待ちも含む）の平均。コア数と同じ値なら飽和の目安。I/O待ちで上がることもあるので、CPU使用率と併せて見る。",
    },
    {
      id: "lq-git-1",
      topic: "Git",
      domains: ["web", "fullstack"],
      prompt: "共有ブランチに対して避けたほうがよい操作は？",
      choices: ["git merge", "git fetch", "git push --force（履歴の書き換え）", "git log"],
      answerIndex: 2,
      explanation:
        "共有ブランチの履歴を書き換えると、他の人の手元と食い違って事故になる。どうしても必要なら --force-with-lease を使い、事前に共有すること。",
    },
    {
      id: "lq-git-2",
      topic: "Git",
      domains: ["web"],
      prompt: "コミットせずに作業中の変更を一時退避するコマンドは？",
      choices: ["git reset --hard", "git stash", "git clean -fd", "git revert"],
      answerIndex: 1,
      explanation:
        "git stash は変更を退避して作業ツリーを綺麗にする。`git stash pop` で戻す。reset --hard や clean は変更を捨てるので、退避のつもりで打つと失う。",
    },
    {
      id: "lq-sec-1",
      topic: "セキュリティ",
      domains: ["web"],
      prompt: "SQLインジェクションの最も確実な対策は？",
      choices: [
        "入力値からシングルクォートを削除する",
        "プレースホルダ（バインド変数）を使う",
        "エラーメッセージを隠す",
        "WAFを入れる",
      ],
      answerIndex: 1,
      explanation:
        "値と構文を分離するプレースホルダが本質的な対策。エスケープの自作やブラックリストは抜け道が残る。WAFやエラー隠蔽は多層防御であって根本対策ではない。",
    },
    {
      id: "lq-sec-2",
      topic: "セキュリティ",
      domains: ["web"],
      prompt: "パスワードの保存方法として適切なのは？",
      choices: [
        "AESで暗号化して保存",
        "MD5でハッシュ化",
        "bcrypt/argon2 などのパスワード用ハッシュ + ソルト",
        "平文（アクセス権で保護）",
      ],
      answerIndex: 2,
      explanation:
        "復号できる暗号化は鍵が漏れれば終わり。MD5/SHA-1 は高速すぎて総当たりに弱い。意図的に計算コストが高いパスワード専用ハッシュを使う。",
    },
    {
      id: "lq-sec-3",
      topic: "セキュリティ",
      domains: ["web"],
      prompt: "CSRF対策として有効なのはどれ？",
      choices: [
        "入力値のHTMLエスケープ",
        "リクエストにトークンを載せて検証する / SameSite Cookie",
        "HTTPSにする",
        "パスワードを長くする",
      ],
      answerIndex: 1,
      explanation:
        "CSRFは「利用者の権限で意図しない操作をさせられる」攻撃。トークン検証やSameSite属性で「別サイトからの送信」を弾く。HTMLエスケープはXSSの対策。",
    },
    {
      id: "lq-docker-1",
      topic: "Docker",
      domains: ["infra"],
      prompt: "イメージを小さく保つのに最も効くのは？",
      choices: [
        "COPYを1行にまとめる",
        "マルチステージビルドでビルド成果物だけを最終段に持ち込む",
        "CMDをENTRYPOINTに変える",
        "コンテナ起動時に不要ファイルを消す",
      ],
      answerIndex: 1,
      explanation:
        "レイヤーは積み上がるので、後から消してもサイズは減らない。ビルド用と実行用を分け、最終段には成果物と実行環境だけを入れるのが定石。",
    },
    {
      id: "lq-docker-2",
      topic: "Docker",
      domains: ["infra"],
      prompt: "コンテナを止めるとDBのデータが消える。原因として最も可能性が高いのは？",
      choices: [
        "イメージが壊れている",
        "ボリュームをマウントせずコンテナ内に書き込んでいる",
        "メモリ不足",
        "ポートが競合している",
      ],
      answerIndex: 1,
      explanation:
        "コンテナのファイルシステムは破棄される前提。永続化が要るデータは named volume やバインドマウントに逃がす。",
    },
    {
      id: "lq-test-1",
      topic: "テスト",
      domains: ["qa", "web"],
      prompt: "「同値分割」と組み合わせて使うと効果が高い技法は？",
      choices: ["境界値分析", "総当たりテスト", "モンキーテスト", "静的解析"],
      answerIndex: 0,
      explanation:
        "同値分割で代表値を選び、境界値分析で境目（0, 1, 上限, 上限+1 など）を足す。不具合は境界に集中するため、この組み合わせが費用対効果に優れる。",
    },
    {
      id: "lq-test-2",
      topic: "テスト",
      domains: ["qa"],
      prompt: "「たまに落ちるテスト」を見つけたときの対応として適切なのは？",
      choices: [
        "リトライ設定を入れて緑にする",
        "原因（時刻依存・並行処理・外部依存など）を特定して直す",
        "そのテストを削除する",
        "CIの並列度を上げる",
      ],
      answerIndex: 1,
      explanation:
        "不安定なテストを放置するとCI全体が信用されなくなる。リトライは一時しのぎで、本当のバグ（競合状態など）を隠すことがある。",
    },
    {
      id: "lq-design-1",
      topic: "設計",
      domains: ["web", "fullstack"],
      prompt: "べき等（idempotent）なHTTPメソッドの組み合わせは？",
      choices: ["GET, PUT, DELETE", "POST, PATCH", "POST, GET", "すべてべき等"],
      answerIndex: 0,
      explanation:
        "同じリクエストを何度送っても結果の状態が変わらないのがべき等。リトライ設計で効いてくる。POSTは通常べき等でないため、二重送信対策が必要。",
    },
    {
      id: "lq-design-2",
      topic: "設計",
      domains: ["web"],
      prompt: "外部APIの呼び出しが不安定なときに入れる仕組みとして適切なのは？",
      choices: [
        "無限リトライ",
        "指数バックオフ付きリトライ + タイムアウト",
        "呼び出しを同期にする",
        "ログを消す",
      ],
      answerIndex: 1,
      explanation:
        "間隔を空けずに再送すると相手をさらに詰まらせる。指数バックオフ＋上限回数＋タイムアウトを組み合わせ、必要ならサーキットブレーカーで遮断する。",
    },
    {
      id: "lq-design-3",
      topic: "設計",
      domains: ["web", "fullstack"],
      prompt: "ログに書いてはいけないものはどれ？",
      choices: [
        "リクエストID",
        "処理時間",
        "パスワードやカード番号などの秘密情報",
        "エラーのスタックトレース",
      ],
      answerIndex: 2,
      explanation:
        "ログは広く共有・長期保管されるため、秘密情報を書くと漏洩経路になる。マスキングするか、そもそも渡さない設計にする。",
    },
    {
      id: "lq-agile-1",
      topic: "プロジェクト",
      domains: ["pm", "qa"],
      prompt: "見積もりが常に楽観的になる傾向を何という？",
      choices: ["パーキンソンの法則", "計画錯誤", "ブルックスの法則", "コンウェイの法則"],
      answerIndex: 1,
      explanation:
        "計画錯誤（planning fallacy）。過去の実績を基準にする、バッファを明示する、分割して見積もるなどで補正する。",
    },
    {
      id: "lq-agile-2",
      topic: "プロジェクト",
      domains: ["pm"],
      prompt: "「遅れているプロジェクトに人を追加するとさらに遅れる」を指すのは？",
      choices: ["ブルックスの法則", "パレートの法則", "マーフィーの法則", "ムーアの法則"],
      answerIndex: 0,
      explanation:
        "教育とコミュニケーション経路の増加が短期的な生産性を下げるため。人を足す判断は、教育コストも含めて早い段階でするほど痛みが小さい。",
    },
    {
      id: "lq-web-1",
      topic: "Web",
      domains: ["web"],
      prompt: "画面表示が遅い。まず測るべきなのは？",
      choices: [
        "勘でクエリを直す",
        "どこで時間がかかっているかを計測する（ネットワーク/サーバ/描画）",
        "サーバのスペックを上げる",
        "画像をすべて削除する",
      ],
      answerIndex: 1,
      explanation:
        "推測で直すと外れたときに何も学べない。開発者ツールのネットワーク/パフォーマンスやサーバ側のトレースで、支配的な区間を特定してから手を入れる。",
    },
    {
      id: "lq-web-2",
      topic: "Web",
      domains: ["web"],
      prompt: "iOS Safariで入力欄をタップすると画面が拡大される。原因は？",
      choices: [
        "viewportの設定漏れ",
        "入力欄のfont-sizeが16px未満",
        "CSSのz-index",
        "JavaScriptのエラー",
      ],
      answerIndex: 1,
      explanation:
        "16px未満の入力欄にフォーカスするとiOSが自動でズームする。user-scalable=no で塞ぐのはアクセシビリティ上よくないので、入力欄を16px以上にするのが正攻法。",
    },
    {
      id: "lq-career-1",
      topic: "キャリア",
      domains: ["pm"],
      prompt: "単価交渉で最も効きやすい材料はどれ？",
      choices: [
        "在籍年数",
        "担当した業務範囲と成果が具体的に示せること",
        "保有資格の数だけ",
        "希望額の強い主張",
      ],
      answerIndex: 1,
      explanation:
        "「何を任され、どこまで一人でやり、どんな結果になったか」が判断材料になる。週報を書き続けると、この材料が自然に貯まる（経歴書に反映される）。",
    },
  ];

  for (const q of quizzes) {
    await prisma.quizQuestion.upsert({
      where: { id: q.id },
      update: {},
      create: {
        id: q.id,
        authorId: staff.id,
        topic: q.topic,
        domains: q.domains,
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
      },
    });
  }
  console.log(`良問バンク: ${quizzes.length}問（運営名義）`);

  const total = await prisma.quizQuestion.count();
  const postCount = await prisma.yomoyamaPost.count();
  console.log("");
  console.log(`完了。よもやま計${postCount}件 / 良問バンク計${total}問`);
  console.log("※ 何度実行しても同じ状態になります（固定IDでupsert）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
