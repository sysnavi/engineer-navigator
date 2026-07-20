// UIシェルの解決（デスクトップOS風 / クラシック表示）。
//
// ロールバック戦略: 旧UIはgitで戻すのではなく「クラシックモード」として共存させる。
// - 環境デフォルト: UI_SHELL_DEFAULT（未設定なら "classic"。全ユーザー一括の切替はここ）
// - ユーザー上書き: User.uiShell（マイページのUIモードきせかえ。null=環境デフォルトに従う）
// ユーザーの声で戻したくなったら env を戻すだけ（deploy不要のユーザー単位切替も可能）。

export type UiShell = "desktop" | "classic";

export function isUiShell(v: unknown): v is UiShell {
  return v === "desktop" || v === "classic";
}

export function envDefaultShell(): UiShell {
  const v = process.env.UI_SHELL_DEFAULT;
  return isUiShell(v) ? v : "classic";
}

export function resolveShell(user: { uiShell: string | null } | null): UiShell {
  if (user && isUiShell(user.uiShell)) return user.uiShell;
  return envDefaultShell();
}
