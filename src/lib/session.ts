// セッション cookie 名（招待リンク認証）。
// middleware(edge) から参照するため、node依存(prisma/crypto)を持たない独立モジュールに置く。
export const SESSION_COOKIE = "en_session";
// ローカル開発用ログインの cookie 名（DEV_LOGIN_ENABLED のときのみ有効）
export const DEV_COOKIE = "dev-user";
