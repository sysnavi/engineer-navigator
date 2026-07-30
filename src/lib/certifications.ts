// 資格シラバスのカタログ（学びの背骨）。
//
// 「学習プラン(/plan)」「腕試し(/quiz)」「AIメンター」の3機能を1本の軸で繋ぐための単一ソース。
//   - /plan  : 章立てをAIに渡して計画を作り、各週に chapter.topic を紐づける
//   - /quiz  : topic がそのまま出題の絞り込みキー（QuizQuestion.topic と突き合わせる）
//   - RAG    : content/knowledge/learning/<cert>.md の教材が chapter と同じ並びで書いてある
//
// ★topic は「唯一の正」。表記ゆれると quiz と繋がらなくなるので、
//   新しい問題を作る側（AI出題バッチ/フォーム）は必ずここの文字列を使うこと。
//
// カタログに無い資格を自由入力されても壊れないこと（findCert が null を返し、
// 従来どおり章なしのプランが作られる）を常に保つ。

export type CertChapter = {
  /** 章ID（安定値。並び替えても変えない） */
  id: string;
  /** 章名（UI表示） */
  title: string;
  /** 腕試しのお題 = QuizQuestion.topic。★この文字列が唯一の正 */
  topic: string;
  /** この章で押さえること。AIの計画生成・出題生成のヒントに使う */
  focus: string;
};

export type CertDef = {
  id: string;
  /** 表示名。StudyPlan.certification に保存される値でもある */
  label: string;
  /** 自由入力からカタログを引くための表記ゆれ（小文字・空白除去で比較） */
  aliases: string[];
  emoji: string;
  /** 関連する技術領域（src/lib/domains.ts のID）。マイページの目標領域から推すのに使う */
  domains: string[];
  /** 一言説明（選択UI用） */
  hint: string;
  chapters: CertChapter[];
};

export const CERTIFICATIONS: CertDef[] = [
  {
    id: "ip",
    label: "ITパスポート",
    aliases: ["ITパスポート", "iパス", "ipa ip", "itpassport", "ip"],
    emoji: "🔰",
    domains: ["web", "pm"],
    hint: "IT全般の入口。ストラテジ・マネジメント・テクノロジの3分野",
    chapters: [
      {
        id: "ip-strategy",
        title: "ストラテジ系（企業と法務・経営戦略）",
        topic: "IPA ストラテジ系",
        focus: "企業活動、経営戦略、システム戦略、知的財産権や労働関連法規などの法務",
      },
      {
        id: "ip-management",
        title: "マネジメント系（開発・PM・サービス）",
        topic: "IPA マネジメント系",
        focus: "システム開発の流れ、プロジェクトマネジメント、サービスマネジメント、システム監査",
      },
      {
        id: "ip-tech-base",
        title: "テクノロジ系・基礎理論とコンピュータ",
        topic: "IPA テクノロジ基礎",
        focus: "2進数・論理演算・確率統計、ハードウェア、OSとソフトウェア、データベースの基礎",
      },
      {
        id: "ip-network",
        title: "テクノロジ系・ネットワーク",
        topic: "ネットワーク基礎",
        focus: "LAN/WAN、TCP/IPとIPアドレス、プロトコル、無線とインターネットの仕組み",
      },
      {
        id: "ip-security",
        title: "テクノロジ系・セキュリティ",
        topic: "情報セキュリティ基礎",
        focus: "情報資産と脅威、リスクマネジメント、暗号と認証、情報セキュリティマネジメント",
      },
      {
        id: "ip-new-tech",
        title: "新しい技術とデータ活用",
        topic: "IT新技術トレンド",
        focus: "AI・機械学習、IoT、ビッグデータ、アジャイル、DXの考え方",
      },
    ],
  },
  {
    id: "fe",
    label: "基本情報技術者",
    aliases: ["基本情報", "基本情報技術者", "fe", "基本情報技術者試験"],
    emoji: "📗",
    domains: ["web", "fullstack", "infra", "embedded"],
    hint: "エンジニアの共通土台。科目A（知識）＋科目B（アルゴリズムとセキュリティ）",
    chapters: [
      {
        id: "fe-base-theory",
        title: "科目A・基礎理論",
        topic: "基礎理論（基本情報）",
        focus: "基数変換、論理演算、データ構造（スタック・キュー・木）、計算量の考え方",
      },
      {
        id: "fe-computer",
        title: "科目A・コンピュータシステム",
        topic: "コンピュータシステム",
        focus: "CPUとメモリ、キャッシュ、システム構成、稼働率・信頼性計算、OSの役割",
      },
      {
        id: "fe-database",
        title: "科目A・データベース",
        topic: "データベース基礎",
        focus: "関係モデル、正規化、SQL（結合・集約）、トランザクションとACID、排他制御",
      },
      {
        id: "fe-network",
        title: "科目A・ネットワーク",
        topic: "ネットワーク基礎",
        focus: "OSI参照モデルとTCP/IP、IPアドレスとサブネット、ルーティング、主要プロトコル",
      },
      {
        id: "fe-security",
        title: "科目A/B・情報セキュリティ",
        topic: "情報セキュリティ基礎",
        focus: "脅威と攻撃手法、暗号方式、認証とアクセス制御、セキュリティ管理。科目Bでも必出",
      },
      {
        id: "fe-dev-mgmt",
        title: "科目A・開発技術とマネジメント",
        topic: "開発プロセスとマネジメント",
        focus: "開発モデル、テスト工程、プロジェクト/サービスマネジメント、ストラテジ",
      },
      {
        id: "fe-algorithm",
        title: "科目B・アルゴリズムとプログラミング",
        topic: "アルゴリズムとプログラミング",
        focus: "擬似言語のトレース、探索・整列、再帰、配列とリスト操作。科目Bの配点の中心",
      },
    ],
  },
  {
    id: "ap",
    label: "応用情報技術者",
    aliases: ["応用情報", "応用情報技術者", "ap", "応用情報技術者試験"],
    emoji: "📘",
    domains: ["fullstack", "infra", "pm", "qa"],
    hint: "設計・管理まで含む上位区分。午後は記述式で選択問題",
    chapters: [
      {
        id: "ap-tech-core",
        title: "午前・テクノロジ系の広い知識",
        topic: "応用情報 テクノロジ",
        focus: "基礎理論、アルゴリズム、コンピュータ構成、ソフトウェア、ハードウェアの全域",
      },
      {
        id: "ap-database",
        title: "データベース設計",
        topic: "データベース設計",
        focus: "概念/論理/物理設計、E-R図、正規化、SQLチューニング、インデックス設計",
      },
      {
        id: "ap-network",
        title: "ネットワーク設計",
        topic: "ネットワーク設計",
        focus: "サブネット設計、ルーティング、負荷分散、DNS/HTTP/TLS、性能とボトルネック",
      },
      {
        id: "ap-security",
        title: "情報セキュリティ（午後必須）",
        topic: "情報セキュリティ設計",
        focus: "リスク分析、認証認可設計、暗号運用、インシデント対応。午後で唯一の必須問題",
      },
      {
        id: "ap-architecture",
        title: "システムアーキテクチャと可用性",
        topic: "システムアーキテクチャ",
        focus: "冗長化、キャパシティ計画、稼働率計算、キャッシュ、非機能要件の考え方",
      },
      {
        id: "ap-pm",
        title: "プロジェクトマネジメントとサービス",
        topic: "プロジェクトマネジメント",
        focus: "WBS、アローダイアグラムとクリティカルパス、EVM、SLA、ITサービス管理",
      },
      {
        id: "ap-strategy",
        title: "経営戦略・システム戦略・監査",
        topic: "経営戦略と監査",
        focus: "SWOT等の分析手法、投資対効果、調達、内部統制、システム監査",
      },
    ],
  },
  {
    id: "aws-saa",
    label: "AWS SAA",
    aliases: [
      "aws saa",
      "saa",
      "aws認定ソリューションアーキテクトアソシエイト",
      "ソリューションアーキテクトアソシエイト",
      "saa-c03",
      "aws solutions architect associate",
    ],
    emoji: "☁️",
    domains: ["infra", "fullstack"],
    hint: "AWSの設計力。セキュア/弾力性/高性能/コスト最適の4分野",
    chapters: [
      {
        id: "saa-iam",
        title: "セキュアなアクセス設計（IAM）",
        topic: "AWS IAM",
        focus: "ユーザーとロールの使い分け、ポリシー設計、最小権限、OIDC/STS、MFA",
      },
      {
        id: "saa-network",
        title: "ネットワークとVPC",
        topic: "AWS VPC・ネットワーク",
        focus: "サブネット、ルートテーブル、セキュリティグループとNACL、NAT、エンドポイント",
      },
      {
        id: "saa-compute",
        title: "コンピューティングとスケーリング",
        topic: "AWS コンピューティング",
        focus: "EC2の課金モデル、Auto Scaling、ELB、Lambda、コンテナ（ECS/EKS/Fargate）",
      },
      {
        id: "saa-storage",
        title: "ストレージとデータベース",
        topic: "AWS ストレージ・DB",
        focus: "S3のストレージクラス、EBS/EFS、RDSとAurora、DynamoDB、バックアップ",
      },
      {
        id: "saa-resilience",
        title: "弾力性・可用性の設計",
        topic: "AWS 可用性設計",
        focus: "マルチAZとマルチリージョン、疎結合（SQS/SNS）、RTO/RPO、災害復旧パターン",
      },
      {
        id: "saa-cost",
        title: "コスト最適化と運用監視",
        topic: "AWS コスト最適化",
        focus: "料金モデルの選択、S3ライフサイクル、CloudWatch、コスト配分タグ、右サイジング",
      },
    ],
  },
  {
    id: "jstqb-fl",
    label: "JSTQB FL",
    aliases: [
      "jstqb",
      "jstqb fl",
      "jstqb foundation",
      "jstqb foundation level",
      "istqb",
      "テスト技術者資格",
    ],
    emoji: "🧪",
    domains: ["qa"],
    hint: "テストの共通言語。シラバスの6章立てがそのまま出題範囲",
    chapters: [
      {
        id: "jstqb-fundamentals",
        title: "第1章 テストの基礎",
        topic: "テストの基礎",
        focus: "テストの目的、7原則、テストプロセス、欠陥と故障の区別、テストの心理学",
      },
      {
        id: "jstqb-lifecycle",
        title: "第2章 開発ライフサイクルとテスト",
        topic: "開発ライフサイクルとテスト",
        focus: "テストレベル（単体〜受入）、テストタイプ、シフトレフト、確認テストと回帰テスト",
      },
      {
        id: "jstqb-static",
        title: "第3章 静的テスト",
        topic: "静的テスト・レビュー",
        focus: "レビューの種類（ウォークスルー/インスペクション等）、静的解析、レビュープロセス",
      },
      {
        id: "jstqb-design",
        title: "第4章 テスト分析と設計",
        topic: "テスト設計技法",
        focus: "同値分割、境界値分析、デシジョンテーブル、状態遷移、経験ベース技法、カバレッジ",
      },
      {
        id: "jstqb-management",
        title: "第5章 テスト活動の管理",
        topic: "テストマネジメント",
        focus: "テスト計画、見積り、リスクベースドテスト、進捗のモニタリング、欠陥管理",
      },
      {
        id: "jstqb-tools",
        title: "第6章 テストをサポートするツール",
        topic: "テストツールと自動化",
        focus: "ツールの分類、自動化の利点とリスク、導入時のパイロット、CIとの組み合わせ",
      },
    ],
  },
  {
    id: "lpic1",
    label: "LPIC-1 / LinuC-1",
    aliases: ["lpic", "lpic1", "lpic-1", "linuc", "linuc1", "linuc-1", "linux技術者認定"],
    emoji: "🐧",
    domains: ["infra", "embedded"],
    hint: "Linux運用の基礎。101/102の2試験で構成",
    chapters: [
      {
        id: "lpic-arch",
        title: "システムアーキテクチャと起動",
        topic: "Linux システム起動",
        focus: "BIOS/UEFIからの起動順、systemdとターゲット、デバイスの認識、ログの確認",
      },
      {
        id: "lpic-package",
        title: "インストールとパッケージ管理",
        topic: "Linux パッケージ管理",
        focus: "dpkg/apt と rpm/dnf、依存関係、共有ライブラリ、パーティション設計",
      },
      {
        id: "lpic-command",
        title: "GNU/Unixコマンドとテキスト処理",
        topic: "Linux コマンド操作",
        focus: "パイプとリダイレクト、grep/sed/awk、正規表現、プロセス操作、アーカイブ",
      },
      {
        id: "lpic-filesystem",
        title: "ファイルシステムと権限",
        topic: "Linux ファイルシステム",
        focus: "FHS、マウント、パーミッションと特殊ビット、ハード/シンボリックリンク、クォータ",
      },
      {
        id: "lpic-shell",
        title: "シェルとスクリプト",
        topic: "シェルスクリプト",
        focus: "環境変数、エイリアス、条件分岐とループ、終了ステータス、cronによる定期実行",
      },
      {
        id: "lpic-admin",
        title: "ユーザー管理と必須システムサービス",
        topic: "Linux システム管理",
        focus: "ユーザー/グループ管理、時刻同期、ログ管理（journald/rsyslog）、メール転送の基礎",
      },
      {
        id: "lpic-network",
        title: "ネットワークとセキュリティ",
        topic: "Linux ネットワーク設定",
        focus: "IP設定と疎通確認、名前解決、ポート確認、SSH鍵認証、sudo、ファイル権限の防御",
      },
    ],
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s　・（）()]/g, "");

const BY_ID = new Map(CERTIFICATIONS.map((c) => [c.id, c]));

/**
 * 自由入力（"基本情報" "AWS SAA" 等）からカタログを引く。
 * 表記ゆれは aliases と部分一致で吸収する。見つからなければ null
 * （＝カタログ外の資格。章なしのプランを作る従来動作にフォールバック）。
 */
export function findCert(input: string | null | undefined): CertDef | null {
  if (!input) return null;
  const q = norm(input);
  if (!q) return null;
  if (BY_ID.has(q)) return BY_ID.get(q)!;

  for (const c of CERTIFICATIONS) {
    const keys = [c.id, c.label, ...c.aliases].map(norm);
    if (keys.some((k) => k === q)) return c;
  }
  // 完全一致がなければ部分一致（"基本情報技術者試験" → "基本情報" など）。
  // 誤爆を避けるため2文字以上のキーだけを見る。
  for (const c of CERTIFICATIONS) {
    const keys = [c.label, ...c.aliases].map(norm).filter((k) => k.length >= 2);
    if (keys.some((k) => q.includes(k) || k.includes(q))) return c;
  }
  return null;
}

/** カタログ全体で使われているお題の一覧（重複排除・出題バッチの対象） */
export function allCertTopics(): string[] {
  const set = new Set<string>();
  for (const c of CERTIFICATIONS) for (const ch of c.chapters) set.add(ch.topic);
  return [...set];
}

/** お題からその章を持つ資格を引く（腕試し画面で「どの資格の範囲か」を出す用） */
export function certsByTopic(topic: string): CertDef[] {
  return CERTIFICATIONS.filter((c) => c.chapters.some((ch) => ch.topic === topic));
}

/** AIに渡す章立てブロック。topic をそのまま選ばせるための一覧 */
export function chapterCatalogBlock(cert: CertDef): string {
  const lines = cert.chapters
    .map((ch) => `- ${ch.title}｜topic="${ch.topic}"｜${ch.focus}`)
    .join("\n");
  return `\n\n## この資格の章立て（公式シラバスに沿った当サービスの標準構成）\n${lines}`;
}
