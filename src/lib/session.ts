// セッション cookie 名（招待リンク認証）。
// middleware(edge) から参照するため、node依存(prisma/crypto)を持たない独立モジュールに置く。
export const SESSION_COOKIE = "en_session";
// ローカル開発用ログインの cookie 名（DEV_LOGIN_ENABLED のときのみ有効）
export const DEV_COOKIE = "dev-user";
// OAuthフローの state（CSRF対策）を一時保存する cookie 名
export const OAUTH_STATE_COOKIE = "en_oauth_state";

// middleware が付ける「表示中のパス」ヘッダ（ゲストの遮断イベントの帰属に使う）
export const PATHNAME_HEADER = "x-en-pathname";
