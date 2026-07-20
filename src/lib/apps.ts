// 機能レジストリ（ナビ/ホームタイル/デスクトップ/スタートメニュー/ドックの単一ソース）。
// 機能を足すときはここに1件追加すれば、クラシックUIとデスクトップUIの両方に生える。
// アイコンは src/components/pixel-icon.tsx（id と同名の文字マップ）。

export type AppGroup = "kiroku" | "manabu" | "asobu" | "jibun";

export const APP_GROUPS: Record<AppGroup, string> = {
  kiroku: "きろく",
  manabu: "まなぶ",
  asobu: "あそぶ・つながる",
  jibun: "じぶん",
};

export type AppDef = {
  id: string;
  href: string;
  name: string;
  ext: string; // レトロOSの拡張子表示（.exe / .sav …）
  group: AppGroup;
  desc: string; // ホームタイル/ツールチップ用
  label?: string; // タイル上の英字ラベル（NEW QUEST等はページ側で動的に）
  roles?: string[]; // 表示権限（未指定=全員）
  dock?: boolean; // モバイルドックに載せるか（スタート/マイページ以外から2つまで）
};

export const APPS: AppDef[] = [
  { id: "report", href: "/report", name: "週報", ext: ".exe", group: "kiroku", desc: "今週の週報。5分で書けます", dock: true },
  { id: "skills", href: "/skills", name: "スキルマップ", ext: ".sav", group: "kiroku", desc: "承認ベースで育つスキルと成長ログ" },
  { id: "resume", href: "/resume", name: "経歴書", ext: ".doc", group: "kiroku", desc: "週報から自動組版。PDF出力" },
  { id: "mentor", href: "/mentor", name: "AIメンター", ext: ".exe", group: "manabu", desc: "資格・技術を現場目線で24時間相談" },
  { id: "plan", href: "/plan", name: "学習プラン", ext: ".sav", group: "manabu", desc: "試験日から逆算した週次カリキュラム" },
  { id: "quiz", href: "/quiz", name: "腕試し", ext: ".dat", group: "manabu", desc: "良問バンクの四択でスキルチェック" },
  { id: "roleplay", href: "/roleplay", name: "役割演習", ext: ".sim", group: "manabu", desc: "リーダーの難題をAIとロールプレイ" },
  { id: "dungeon", href: "/dungeon", name: "ダンジョン", ext: ".log", group: "asobu", desc: "育てたアバターがフルオートで探索", dock: true },
  { id: "yomoyama", href: "/yomoyama", name: "よもやま", ext: ".log", group: "asobu", desc: "現場の話をハンドル名で共有" },
  { id: "discover", href: "/discover", name: "発見", ext: ".net", group: "asobu", desc: "みんなの成長の道筋から学ぶ" },
  { id: "home", href: "/home", name: "マイホーム", ext: ".sav", group: "jibun", desc: "ペットが暮らし、戦利品を飾る部屋" },
  { id: "mypage", href: "/mypage", name: "マイページ", ext: ".sys", group: "jibun", desc: "きせかえ・継承・公開設定" },
  { id: "condition", href: "/condition", name: "コンディション", ext: ".mon", group: "jibun", desc: "エンジニアの週次コンディション見守り", roles: ["SALES", "ADMIN"] },
  { id: "admin", href: "/admin", name: "管理", ext: ".sys", group: "jibun", desc: "全ユーザー分析・招待・アカウント管理", roles: ["ADMIN"] },
];

export function appsForRole(role: string): AppDef[] {
  return APPS.filter((a) => !a.roles || a.roles.includes(role));
}
