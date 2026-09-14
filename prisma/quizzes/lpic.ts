// LPIC-1 / LinuC-1（Linux技術者認定）の追加問題。
//
// 背景: 良問バンクの「資格の範囲から選ぶ」は1セッション10問出題するが、章あたり1問しか
// 無いと成立しない。src/lib/certifications.ts の lpic1 の各章が最低6問になるよう追加する。
// 「Linux コマンド操作」は既存問題（quiz-linux-*）で足りているのでここでは扱わない。
//
// topic は src/lib/certifications.ts の CertChapter.topic と一字一句同じにすること
// （ズレると資格の範囲から永久に引けなくなる）。
//
// 良問の条件は seed-quizzes.ts の冒頭コメントに従う:
// - 現場で実際に判断を迫られる場面から作る（暗記クイズにしない）
// - 誤答の選択肢は「ありがちな誤解」にする
// - explanation は正解の理由 + なぜ他がダメかまで書く

import type { SeedQuiz } from "../seed-quizzes";

export const QUIZZES_LPIC: SeedQuiz[] = [
  // ===========================================================================
  // Linux システム起動
  // ===========================================================================
  {
    id: "quiz-cert-lpic-arch-2",
    topic: "Linux システム起動",
    domains: ["infra"],
    prompt:
      "電源投入からログインプロンプトが出るまでの流れとして正しいものはどれ？",
    choices: [
      "ブートローダ → UEFI/BIOS → カーネル → systemd",
      "UEFI/BIOS → ブートローダ（GRUB） → カーネルとinitramfs → systemd（PID 1）",
      "UEFI/BIOS → systemd → ブートローダ（GRUB） → カーネル",
      "UEFI/BIOS → カーネル → ブートローダ（GRUB） → systemd",
    ],
    answerIndex: 1,
    explanation:
      "ファームウェア（UEFI/BIOS）が起動デバイスを選んでブートローダを読み込み、GRUBがカーネルとinitramfsをメモリに展開、カーネルが最初のプロセスとしてsystemd（PID 1）を起動する。ブートローダはファームウェアに呼ばれる側なので先には来ないし、systemdはカーネルが動き出した後にしか存在できない。起動失敗の切り分けは「どこまで進んだか」で層を絞るのが基本なので、この順番が頭に入っていないと調査先を間違える。",
    scores: [8, 8],
  },
  {
    id: "quiz-cert-lpic-arch-3",
    topic: "Linux システム起動",
    domains: ["infra"],
    prompt:
      "UEFIブートのサーバーを構築している。ブートローダを置くEFIシステムパーティション(ESP)の説明として正しいものはどれ？",
    choices: [
      "FAT32でフォーマットし、通常 /boot/efi にマウントする",
      "ext4でフォーマットし、通常 /boot にマウントする",
      "スワップ領域と兼用にする",
      "ディスク先頭446バイトのMBR領域がそのままESPになる",
    ],
    answerIndex: 0,
    explanation:
      "ESPはファームウェアが読めるようFAT系（通常FAT32）でフォーマットする決まりで、Linuxからは /boot/efi にマウントして .efi ファイルを置く。/boot はカーネルやinitramfsを置く別の領域で、ext4などでよい（ESPと混同しやすい）。スワップは仮想メモリ用で兼用できず、MBR先頭446バイトにブートコードを書くのはBIOSブートの方式。",
    scores: [7, 7],
  },
  {
    id: "quiz-cert-lpic-arch-4",
    topic: "Linux システム起動",
    domains: ["infra"],
    prompt:
      "手動で起動したサービスが、サーバーを再起動すると立ち上がってこない。恒久的に自動起動させるコマンドはどれ？",
    choices: [
      "systemctl start <サービス名>",
      "systemctl restart <サービス名>",
      "systemctl enable <サービス名>",
      "systemctl status <サービス名>",
    ],
    answerIndex: 2,
    explanation:
      "enable はブート時に起動するようシンボリックリンクを張る操作で、次回以降の起動に効く。start は「今すぐ起動」するだけで再起動後は元に戻るため、この症状そのもの。restart も同じく一時的な操作、status は状態表示でしかない。今すぐ起動しつつ自動起動も設定したいなら systemctl enable --now を使う。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-arch-5",
    topic: "Linux システム起動",
    domains: ["infra"],
    prompt:
      "増設したディスクがOSに認識されているかを、起動時のカーネルメッセージから確認したい。使うコマンドはどれ？",
    choices: [
      "systemctl status",
      "dmesg（または journalctl -k）",
      "uptime",
      "free -h",
    ],
    answerIndex: 1,
    explanation:
      "デバイス認識やドライバのロードはカーネルが出すメッセージに残るので、dmesg か journalctl -k で追うのが定石。systemctl status はユニット（サービス）の状態であってハードウェアの認識結果は出ない。uptime は稼働時間、free はメモリ使用量で、どちらもデバイスの話をしていない。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-lpic-arch-6",
    topic: "Linux システム起動",
    domains: ["infra"],
    prompt:
      "GUIが入ったマシンをサーバー用途に転用するため、次回起動からCLI（マルチユーザー）で上げたい。systemctl set-default に指定するターゲットはどれ？",
    choices: [
      "graphical.target",
      "rescue.target",
      "emergency.target",
      "multi-user.target",
    ],
    answerIndex: 3,
    explanation:
      "multi-user.target はネットワークもサービスも動くCLIの通常運用状態で、旧ランレベル3に相当する。graphical.target はGUIありの状態なので現状のまま。rescue.target は単一ユーザーの復旧用、emergency.target はルートを読み取り専用でマウントしただけの最小状態で、どちらも通常運用には使えない。現在のターゲットは systemctl get-default で確認できる。",
    scores: [8, 7],
  },

  // ===========================================================================
  // Linux パッケージ管理
  // ===========================================================================
  {
    id: "quiz-cert-lpic-package-2",
    topic: "Linux パッケージ管理",
    domains: ["infra"],
    prompt:
      "Red Hat系のサーバーで、/usr/sbin/sshd がどのパッケージから入ったものかを調べたい。使うコマンドはどれ？",
    choices: [
      "rpm -ql /usr/sbin/sshd",
      "rpm -qa | grep sshd",
      "rpm -V /usr/sbin/sshd",
      "rpm -qf /usr/sbin/sshd",
    ],
    answerIndex: 3,
    explanation:
      "-qf（query file）は指定したファイルを提供しているパッケージを逆引きする。-ql はパッケージに含まれるファイル一覧を出す逆向きの操作、-qa はインストール済みパッケージの一覧でファイル名からは引けない、-V は導入時からの改変検証で目的が違う。Debian系で同じことをするなら dpkg -S /usr/sbin/sshd。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-lpic-package-3",
    topic: "Linux パッケージ管理",
    domains: ["infra"],
    prompt:
      "Debian系サーバーで単体の .deb を dpkg -i で入れたら「依存関係が満たされていない」と出て設定が完了しない。適切な対処はどれ？",
    choices: [
      "dpkg -i --force-all で警告を無視して入れる",
      "apt install -f（--fix-broken）を実行して不足している依存パッケージを入れる",
      "apt update を実行すれば自動的に解消される",
      "rpm -i で入れ直す",
    ],
    answerIndex: 1,
    explanation:
      "dpkg は低レベルツールで依存解決をしないため、リポジトリから不足分を取ってくる apt に後始末をさせるのが正しい。--force-all は依存を無視して壊れた状態のまま残すだけ。apt update はパッケージ一覧の更新であって、既に壊れた依存は直らない。rpm はRed Hat系のツールでDebian系では使わない。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-package-4",
    topic: "Linux パッケージ管理",
    domains: ["infra"],
    prompt:
      "自前でビルドしたバイナリが「共有ライブラリが見つからない」と言って起動しない。どのライブラリが足りないかを調べるコマンドはどれ？",
    choices: [
      "ldconfig /usr/local/bin/myapp",
      "strings /usr/local/bin/myapp",
      "ldd /usr/local/bin/myapp",
      "lsof /usr/local/bin/myapp",
    ],
    answerIndex: 2,
    explanation:
      "ldd は実行ファイルが必要とする共有ライブラリと、その解決先を一覧表示する。見つからないものは「not found」と出るのでそれを入れればよい。ldconfig は /etc/ld.so.conf などを読んでライブラリ検索キャッシュを更新する側のコマンド（ライブラリを置いた後に実行する）。strings は文字列抽出、lsof は開いているファイルの調査で、依存の一覧は得られない。",
    scores: [8, 8],
  },
  {
    id: "quiz-cert-lpic-package-5",
    topic: "Linux パッケージ管理",
    domains: ["infra"],
    prompt:
      "サーバーのパーティション設計で /var を独立させることが多い。その主な狙いはどれ？",
    choices: [
      "ログやパッケージキャッシュが膨らんでもルートファイルシステムを満杯にしないため",
      "/var に置いたファイルの読み書きが速くなるため",
      "メモリ使用量を減らせるため",
      "ユーザーのホームディレクトリを保護するため",
    ],
    answerIndex: 0,
    explanation:
      "/var はログ・キュー・パッケージキャッシュなど増え続けるデータの置き場で、ルートと同居していると溢れた瞬間にシステム全体が書き込み不能になる。分離してもディスクは同じなので速度は上がらないし、メモリ使用量とも無関係。ユーザーデータの保護が目的なら分けるのは /home。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-lpic-package-6",
    topic: "Linux パッケージ管理",
    domains: ["infra"],
    prompt:
      "Debian系で、あるパッケージを削除したのに再インストールすると前の設定が残っている。設定ファイルごと消すにはどれを使う？",
    choices: [
      "apt remove <パッケージ>",
      "apt clean",
      "apt purge <パッケージ>",
      "apt autoremove",
    ],
    answerIndex: 2,
    explanation:
      "purge はパッケージ本体に加えて /etc 以下の設定ファイルまで削除する。remove は設定ファイルを残す（だから再インストールで復活する）のがこの症状の原因。autoremove は自動で入った依存パッケージのうち不要になったものの掃除、clean は /var/cache/apt に溜まった .deb を消すだけで、どちらも設定ファイルには触れない。",
    scores: [8, 8],
  },

  // ===========================================================================
  // Linux ファイルシステム
  // ===========================================================================
  {
    id: "quiz-cert-lpic-filesystem-2",
    topic: "Linux ファイルシステム",
    domains: ["infra"],
    prompt:
      "別パーティションにマウントしたデータディレクトリへの参照を /srv/data という名前で作りたい。適切なコマンドはどれ？",
    choices: [
      "ln /mnt/disk2/data /srv/data",
      "ln -s /mnt/disk2/data /srv/data",
      "cp -r /mnt/disk2/data /srv/data",
      "mv /mnt/disk2/data /srv/data",
    ],
    answerIndex: 1,
    explanation:
      "ハードリンク（ln）は同じファイルシステム内の実体（inode）を指す仕組みなので、別パーティションをまたげず、ディレクトリにも作れない。シンボリックリンク（ln -s）はパス文字列を指すだけなのでファイルシステムをまたげ、ディレクトリも対象にできる。cp は実体が二重になって同期が取れなくなり、mv は元の場所から消えてしまう。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-filesystem-3",
    topic: "Linux ファイルシステム",
    domains: ["infra"],
    prompt:
      "/tmp のパーミッションは drwxrwxrwt になっている。末尾の t が意味するものはどれ？",
    choices: [
      "SUIDが設定されており、実行時に所有者の権限で動く",
      "SGIDが設定されており、作成したファイルがディレクトリのグループを引き継ぐ",
      "スティッキービットが設定されており、誰でも書き込めるが自分が所有するファイルしか削除できない",
      "全ユーザーに実行権限があることを示す特別な表記",
    ],
    answerIndex: 2,
    explanation:
      "共有ディレクトリにスティッキービット（1777）を付けると、書き込み権限があっても他人のファイルは消せなくなる。/tmp のように全員が書ける場所で必須の保護。SUIDは s が所有者の実行位置に出る（4000）、SGIDはグループの実行位置に出る（2000）で、いずれも t とは別のビット。x があるだけなら t ではなく x と表示される。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-filesystem-4",
    topic: "Linux ファイルシステム",
    domains: ["infra"],
    prompt:
      "mount コマンドで増設ディスクをマウントして運用を始めたが、再起動したらマウントが外れていた。恒久化するには？",
    choices: [
      "/etc/mtab を編集してエントリを追加する",
      "mount コマンドを ~/.bashrc に書いておく",
      "mount コマンドに -o remount を付けて実行し直す",
      "/etc/fstab にマウント設定を追記する",
    ],
    answerIndex: 3,
    explanation:
      "起動時のマウントは /etc/fstab に定義する。デバイス名（/dev/sdb1）は増設順で変わることがあるので UUID= 指定が安全。/etc/mtab は現在のマウント状態を反映する自動生成（多くの環境で /proc/self/mounts へのシンボリックリンク）で、編集しても意味がない。~/.bashrc はログインしたユーザーのシェル起動時にしか読まれず、システム起動とは無関係。remount は既存マウントのオプション変更にすぎない。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-filesystem-5",
    topic: "Linux ファイルシステム",
    domains: ["infra"],
    prompt:
      "root で作業した結果、アプリの作業ディレクトリが root 所有になり app ユーザーが書き込めない。最も適切な対処はどれ？",
    choices: [
      "chmod 777 で全員に書き込みを許可する",
      "chown -R app:app で所有者とグループを app に変更する",
      "chmod +w で書き込み権限を追加する",
      "app ユーザーを root グループに追加する",
    ],
    answerIndex: 1,
    explanation:
      "所有者を直すのが筋なので chown（所有者・グループの変更）を使う。chmod は「誰が何をできるか」を変えるだけで所有者は変わらず、777 は第三者にも書き込みを許す危険な逃げ。chmod +w も所有者側のビットが対象になるだけで app ユーザーには効かない。root グループへの追加は不要な特権を与えるうえ、root 所有ファイルのグループが root とは限らず効かないこともある。",
    scores: [9, 9],
  },
  {
    id: "quiz-cert-lpic-filesystem-6",
    topic: "Linux ファイルシステム",
    domains: ["infra"],
    prompt:
      "共有サーバーで、特定ユーザーが /home を使い切ってしまうのを防ぎたい。使う仕組みはどれ？",
    choices: [
      "ulimit でユーザーのリソース制限を設定する",
      "chmod でホームディレクトリの権限を絞る",
      "ディスククォータ（fstabに usrquota を付け、edquota で上限を設定する）",
      "df -h を定期実行して監視する",
    ],
    answerIndex: 2,
    explanation:
      "ファイルシステム単位でユーザー／グループごとの使用量と inode 数に上限を設けるのがクォータ。ulimit はシェルから起動するプロセスのリソース（ファイルサイズやメモリなど）の制限で、ユーザーの総使用量は抑えられない。chmod は権限の話で容量とは無関係。df の監視は気づけるだけで、使い切ること自体は止められない。",
    scores: [8, 7],
  },

  // ===========================================================================
  // シェルスクリプト
  // ===========================================================================
  {
    id: "quiz-cert-lpic-shell-2",
    topic: "シェルスクリプト",
    domains: ["infra"],
    prompt:
      "スクリプト内で、直前に実行したコマンドが成功したかどうかを判定したい。参照する変数はどれ？",
    choices: ["$!", "$$", "$0", "$?"],
    answerIndex: 3,
    explanation:
      "$? には直前のコマンドの終了ステータスが入り、0 が成功・0以外が失敗を表す（if [ $? -ne 0 ]; then ... のように使う）。$! は直近にバックグラウンド実行したプロセスのPID、$$ は実行中のシェル自身のPID、$0 はスクリプト名で、いずれも成否とは関係がない。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-shell-3",
    topic: "シェルスクリプト",
    domains: ["infra"],
    prompt:
      "シェルで定義した変数を、そこから起動するスクリプトやコマンドにも見せたい。正しい方法はどれ？",
    choices: [
      "VAR=値 と代入すれば子プロセスにも自動的に引き継がれる",
      "export VAR=値 として環境変数にする",
      "set VAR=値 と書く",
      "alias VAR=値 と書く",
    ],
    answerIndex: 1,
    explanation:
      "単なる代入はそのシェル内だけのシェル変数で、子プロセスには渡らない。export して環境変数にすることで初めて引き継がれる（確認は env や printenv）。set は引数なしで変数一覧の表示やシェルオプションの設定に使うもので、set VAR=値 は別言語の書き方の混同。alias はコマンドの別名定義で変数とは別物。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-shell-4",
    topic: "シェルスクリプト",
    domains: ["infra"],
    prompt:
      "毎週月曜の朝9時00分にバックアップスクリプトを動かしたい。crontab の記述として正しいものはどれ？",
    choices: [
      "9 0 * * 1 /opt/backup.sh",
      "0 9 1 * * /opt/backup.sh",
      "* 9 * * 1 /opt/backup.sh",
      "0 9 * * 1 /opt/backup.sh",
    ],
    answerIndex: 3,
    explanation:
      "crontab の5フィールドは「分 時 日 月 曜日」で、曜日は0か7が日曜、1が月曜。よって 0 9 * * 1 が正しい。9 0 * * 1 は分と時を取り違えて毎週月曜0時9分になる典型的なミス。0 9 1 * * は曜日ではなく毎月1日の9時。* 9 * * 1 は月曜9時台に毎分実行されてしまう。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-shell-5",
    topic: "シェルスクリプト",
    domains: ["infra"],
    prompt:
      "作成したスクリプトを ./deploy.sh で実行したら「Permission denied」と出た。最初に確認・対処すべきことはどれ？",
    choices: [
      "実行権限が付いていないので chmod +x deploy.sh を実行する",
      "ファイル名の拡張子を .bash に変更する",
      "sudo を付けて実行する",
      "ファイルの所有者を root に変更する",
    ],
    answerIndex: 0,
    explanation:
      "パス指定で直接実行するには実行権限（x）が必要で、無いと Permission denied になる。sudo で通ることもあるが、権限昇格は原因の解決ではないうえ不要な特権で動かすことになる。Linuxは拡張子で実行可否を決めないので改名は無意味、所有者をrootにしても x が無ければ同じエラーのまま。なお1行目のシバン（#!/bin/bash）が無い場合は別のエラーになる。",
    scores: [8, 8],
  },
  {
    id: "quiz-cert-lpic-shell-6",
    topic: "シェルスクリプト",
    domains: ["infra"],
    prompt:
      "設定ファイルが存在するときだけ読み込む処理を書きたい。条件式として適切なものはどれ？",
    choices: [
      'if [ -d "$CONF" ]; then',
      'if [ -z "$CONF" ]; then',
      'if [ -f "$CONF" ]; then',
      'if [ -x "$CONF" ]; then',
    ],
    answerIndex: 2,
    explanation:
      "-f は「通常ファイルとして存在するか」を判定する演算子で、設定ファイルの存在確認に使う。-d はディレクトリかどうかの判定なのでファイルには一致しない。-z は変数が空文字列かどうかで、ファイルの有無は見ていない。-x は実行権限の有無なので、読み込むだけの設定ファイルは通常これに当てはまらない。変数は空のときに構文が壊れないよう必ず引用符で囲む。",
    scores: [8, 7],
  },

  // ===========================================================================
  // Linux システム管理
  // ===========================================================================
  {
    id: "quiz-cert-lpic-admin-2",
    topic: "Linux システム管理",
    domains: ["infra"],
    prompt:
      "既存ユーザー app を、今の所属を保ったまま docker グループにも追加したい。正しいコマンドはどれ？",
    choices: [
      "usermod -G docker app",
      "useradd -G docker app",
      "groupadd docker app",
      "usermod -aG docker app",
    ],
    answerIndex: 3,
    explanation:
      "-G は補助グループの指定だが、-a（append）を付けないと指定したグループだけで置き換えられ、今までの所属が消える。sudo 権限用のグループが外れて作業不能になる事故の定番。useradd は新規ユーザーの作成用で既存ユーザーには使えず、groupadd はグループを作るコマンドでユーザーの追加はできない。反映は再ログイン後。",
    scores: [9, 9],
  },
  {
    id: "quiz-cert-lpic-admin-3",
    topic: "Linux システム管理",
    domains: ["infra"],
    prompt:
      "ユーザーのハッシュ化されたパスワードが保存されているファイルはどれ？",
    choices: ["/etc/passwd", "/etc/shadow", "/etc/group", "/etc/login.defs"],
    answerIndex: 1,
    explanation:
      "/etc/shadow にパスワードハッシュと有効期限などが入り、rootしか読めない権限になっている。/etc/passwd は全ユーザーが読める必要があるためパスワード欄は x となっており、ここにハッシュを置くのは古い方式で危険。/etc/group はグループ定義、/etc/login.defs はパスワード有効期限やUID範囲などの既定値を決める設定ファイル。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-lpic-admin-4",
    topic: "Linux システム管理",
    domains: ["infra"],
    prompt:
      "ログの時刻がずれていると相談された。systemd環境で時刻同期が有効かどうかを確認するコマンドはどれ？",
    choices: ["date", "timedatectl", "hwclock", "uptime"],
    answerIndex: 1,
    explanation:
      "timedatectl（引数なしまたは status）はタイムゾーン、システムクロック、NTP同期の有効/同期済みかまでまとめて表示する。有効化は timedatectl set-ntp true。date は現在時刻を表示するだけで、ずれていても同期設定の状態は分からない。hwclock はハードウェアクロックの読み書き、uptime は稼働時間とロードアベレージで目的が違う。",
    scores: [8, 8],
  },
  {
    id: "quiz-cert-lpic-admin-5",
    topic: "Linux システム管理",
    domains: ["infra"],
    prompt:
      "rsyslog が書き出す /var/log 配下のログが肥大化している。分割・圧縮・世代管理を任せる仕組みはどれ？",
    choices: [
      "logger",
      "dmesg",
      "logrotate",
      "毎日cronでsyslogサービスを再起動する",
    ],
    answerIndex: 2,
    explanation:
      "logrotate は /etc/logrotate.conf と /etc/logrotate.d/ の定義に従ってログの世代交代・圧縮・削除を行う標準的な仕組み。logger はコマンドラインからsyslogにメッセージを書き込む側のツール、dmesg はカーネルメッセージの表示で、どちらもローテーションはしない。サービスの再起動ではファイルは小さくならず、無駄な停止を生むだけ。なお journald 側の肥大化は journalctl --vacuum-size や設定ファイルで制御する。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-lpic-admin-6",
    topic: "Linux システム管理",
    domains: ["infra"],
    prompt:
      "サーバーからroot宛に届くシステム通知メールを、運用担当のメールアドレスへ転送したい。設定する場所はどれ？",
    choices: [
      "/etc/aliases に転送先を書き、newaliases を実行する",
      "/etc/hosts に転送先を追記する",
      "/etc/passwd の root 行のコメント欄に書く",
      "~/.bashrc に転送用のコマンドを書く",
    ],
    answerIndex: 0,
    explanation:
      "MTAのエイリアス定義 /etc/aliases に「root: ops@example.com」のように書き、newaliases（または sendmail -bi）でデータベースへ反映するのが定石。ユーザー個人の転送なら ~/.forward も使える。/etc/hosts は名前とIPの対応表、/etc/passwd のコメント欄（GECOS）は氏名などの情報欄でメール配送には関与しない。~/.bashrc は対話シェルの設定で、cronやサービスが出すメールには効かない。",
    scores: [7, 7],
  },

  // ===========================================================================
  // Linux ネットワーク設定
  // ===========================================================================
  {
    id: "quiz-cert-lpic-network-2",
    topic: "Linux ネットワーク設定",
    domains: ["infra"],
    prompt:
      "最近のディストリビューションで、インターフェースに割り当てられたIPアドレスを確認する標準的なコマンドはどれ？",
    choices: ["ip addr show", "ifconfig", "netstat -r", "ping -c 1 localhost"],
    answerIndex: 0,
    explanation:
      "iproute2 の ip コマンドが現在の標準で、ip addr show（ip a）でアドレスを確認する。ifconfig は古い net-tools 由来で非推奨、最小構成のサーバーには最初から入っていないことも多い。netstat -r はルーティングテーブルの表示（今は ip route）、ping は疎通確認であって自ホストのアドレスは分からない。",
    scores: [8, 7],
  },
  {
    id: "quiz-cert-lpic-network-3",
    topic: "Linux ネットワーク設定",
    domains: ["infra"],
    prompt:
      "IPアドレス指定ならAPIサーバーに疎通するが、ホスト名指定だと接続できない。次に確認すべきことはどれ？",
    choices: [
      "NICのリンクが上がっているか",
      "ルーティングテーブルにデフォルトゲートウェイがあるか",
      "名前解決（/etc/resolv.conf のDNS設定、/etc/hosts、dig や host での引き直し）",
      "サーバー側のアプリが起動しているか",
    ],
    answerIndex: 2,
    explanation:
      "IP直打ちで通る時点で、L2/L3の経路とサーバー側プロセスは生きている。差分はホスト名をIPに変換する部分だけなので、名前解決を疑うのが切り分けの筋。dig や host で引けるか、/etc/resolv.conf のネームサーバーが正しいか、/etc/hosts に古いエントリが残っていないか（参照順は /etc/nsswitch.conf）を見る。リンク・経路・プロセスはいずれもIP指定が通った時点で否定されている。",
    scores: [9, 9],
  },
  {
    id: "quiz-cert-lpic-network-4",
    topic: "Linux ネットワーク設定",
    domains: ["infra"],
    prompt:
      "同一LAN内の機器には ping が通るのに、インターネット上のIPアドレスにはまったく届かない。最初に確認すべきものはどれ？",
    choices: [
      "ip route でデフォルトゲートウェイが設定されているか",
      "ss -ltn で待ち受けポートがあるか",
      "ping 127.0.0.1 でループバックを確認する",
      "/etc/hostname のホスト名が正しいか",
    ],
    answerIndex: 0,
    explanation:
      "同一セグメントだけ通る＝サブネット外へ中継する経路が無い典型で、ip route の default 行（デフォルトゲートウェイ）の有無を見るのが第一歩。ss -ltn は自ホストが待ち受けているポートの話で外向き通信とは無関係、ループバックは同一LANに通っている時点で確認済み、ホスト名は名前解決にすら関係するかどうかで、IP指定の疎通には影響しない。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-network-5",
    topic: "Linux ネットワーク設定",
    domains: ["infra"],
    prompt:
      "全員の鍵認証への移行が終わったので、SSHのパスワード認証を無効にしたい。正しい対応はどれ？",
    choices: [
      "クライアントの ~/.ssh/config に PasswordAuthentication no を書く",
      "サーバーの /etc/ssh/sshd_config で PasswordAuthentication no にし、sshd を再読み込みする",
      "サーバーの /etc/ssh/sshd_config で PermitRootLogin no にする",
      "~/.ssh/authorized_keys のパーミッションを 600 にする",
    ],
    answerIndex: 1,
    explanation:
      "認証方式を決めるのはサーバー側のデーモン設定なので、sshd_config を変更して systemctl reload sshd で反映する（切断されても戻れるよう、別セッションを張ったまま作業するのが安全）。~/.ssh/config はクライアント側の接続設定で、サーバーの受け入れ方は変わらない。PermitRootLogin no は root ログインだけの制限で一般ユーザーのパスワード認証は残る。authorized_keys の 600 は鍵認証を機能させる前提条件であって、パスワード認証を止めるものではない。",
    scores: [9, 8],
  },
  {
    id: "quiz-cert-lpic-network-6",
    topic: "Linux ネットワーク設定",
    domains: ["infra"],
    prompt:
      "新しい運用メンバーに管理者コマンドの実行を許可したい。最も安全な方法はどれ？",
    choices: [
      "rootのパスワードを共有する",
      "/etc/sudoers を vi で直接開いて編集する",
      "visudo で編集する（または sudo/wheel グループに追加する）",
      "chmod u+s /bin/bash でシェルにSUIDを付ける",
    ],
    answerIndex: 2,
    explanation:
      "visudo は保存時に構文チェックを行い、書き間違いで誰も sudo を使えなくなる事故を防ぐ。ディストリ標準の sudo（Debian系）や wheel（Red Hat系）グループに追加するのも同じ仕組みの範囲。vi で直接編集すると構文エラーに気づけず締め出される危険がある。rootパスワードの共有は誰が何をしたか追えなくなり、シェルへのSUIDは全ユーザーがroot権限を取れる重大な穴になる。",
    scores: [9, 9],
  },
];
