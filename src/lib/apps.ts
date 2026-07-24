// 機能レジストリ（ナビ/ホームタイル/デスクトップ/スタートメニュー/ドックの単一ソース）。
// 機能を足すときはここに1件追加すれば、クラシックUIとデスクトップUIの両方に生える。
// アイコンは src/components/pixel-icon.tsx（id と同名の文字マップ）。

export type AppGroup = "kiroku" | "manabu" | "asobu" | "jibun";

// ゲストに解放するアプリ（Issue #18）。**このファイルはクライアントからも読まれる**ので、
// prisma等サーバー専用のモジュールに依存させないこと（定数はここに置く）。
// mypage は昇格（OAuth連携）の導線がそこにあるため必ず含める。
export const GUEST_ALLOWED_APPS = ["quiz", "dungeon", "home", "mypage"];

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
};

export const APPS: AppDef[] = [
  { id: "report", href: "/report", name: "週報", ext: ".exe", group: "kiroku", desc: "今週の週報。5分で書けます" },
  { id: "skills", href: "/skills", name: "スキルマップ", ext: ".sav", group: "kiroku", desc: "承認ベースで育つスキルと成長ログ" },
  { id: "resume", href: "/resume", name: "経歴書", ext: ".doc", group: "kiroku", desc: "週報から自動組版。PDF出力" },
  { id: "mentor", href: "/mentor", name: "AIメンター", ext: ".exe", group: "manabu", desc: "資格・技術を現場目線で24時間相談" },
  { id: "plan", href: "/plan", name: "学習プラン", ext: ".sav", group: "manabu", desc: "試験日から逆算した週次カリキュラム" },
  { id: "quiz", href: "/quiz", name: "腕試し", ext: ".dat", group: "manabu", desc: "良問バンクの四択でスキルチェック" },
  { id: "roleplay", href: "/roleplay", name: "役割演習", ext: ".sim", group: "manabu", desc: "リーダーの難題をAIとロールプレイ" },
  { id: "dungeon", href: "/dungeon", name: "ダンジョン", ext: ".log", group: "asobu", desc: "育てたアバターがフルオートで探索" },
  { id: "yomoyama", href: "/yomoyama", name: "よもやま", ext: ".log", group: "asobu", desc: "現場の話をハンドル名で共有" },
  { id: "discover", href: "/discover", name: "発見", ext: ".net", group: "asobu", desc: "みんなの成長の道筋から学ぶ" },
  { id: "home", href: "/home", name: "マイホーム", ext: ".sav", group: "jibun", desc: "ペットが暮らし、戦利品を飾る部屋" },
  { id: "mypage", href: "/mypage", name: "マイページ", ext: ".sys", group: "jibun", desc: "きせかえ・継承・公開設定" },
  // condition（営業・管理者向けダッシュボード）は個人サービス化で廃止（Issue #19 方針A）
  { id: "admin", href: "/admin", name: "管理", ext: ".sys", group: "jibun", desc: "全ユーザー分析・招待・アカウント管理", roles: ["ADMIN"] },
];

export function appsForRole(role: string): AppDef[] {
  // ゲストは許可リスト方式（Issue #18）。APPSに新しいアプリが増えても、
  // 明示的に GUEST_ALLOWED_APPS へ足さない限りゲストには出ない（安全側の既定）。
  if (role === "GUEST") {
    return APPS.filter((a) => GUEST_ALLOWED_APPS.includes(a.id));
  }
  return APPS.filter((a) => !a.roles || a.roles.includes(role));
}

// モバイルドックの自由枠（Issue #10）。▶スタートは固定で、残り3枠をユーザーが選べる。
export const DOCK_SLOTS = 3;
export const DOCK_DEFAULT = ["report", "dungeon", "mypage"];

/** ユーザー設定からドックの3枠を選択順に解決する。
 *  不正ID・権限外（ロール変更で候補から消えた等）は黙って除き、
 *  足りない分はデフォルト構成で補完する（常にちょうど3件返る）。 */
export function resolveDock(role: string, dockApps: string[]): AppDef[] {
  const byId = new Map(appsForRole(role).map((a) => [a.id, a]));
  const picked: AppDef[] = [];
  for (const id of [...dockApps, ...DOCK_DEFAULT]) {
    if (picked.length === DOCK_SLOTS) break;
    const app = byId.get(id);
    if (app && !picked.includes(app)) picked.push(app);
  }
  return picked;
}
