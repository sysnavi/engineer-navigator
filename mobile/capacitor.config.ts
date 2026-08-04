import type { CapacitorConfig } from "@capacitor/cli";

// ============================================================
// Engineer Navigator モバイルシェル（Capacitor / remote URL方式）
//
// アプリ本体はサーバー（Next.js SSR）にあり、この殻は本番ドメインを
// WebViewで読み込むだけ。Server Actions・cookieセッションはそのまま動く。
//
// 接続先の切り替え:
//   本番:        npx cap sync                            → PROD_URL
//   ローカル検証: CAP_SERVER_URL=http://localhost:3000 npx cap sync   (iOSシミュレータ)
//               CAP_SERVER_URL=http://10.0.2.2:3000 npx cap sync     (Androidエミュレータ)
// sync のたびにネイティブ側へ焼き込まれるので、切り替えたら必ず sync し直すこと。
// ============================================================

// apex（engineer-navigator.jp）は www へリダイレクトされるため、正規URLを直接指定
// （server.url のオリジンが「アプリのオリジン」になるので、リダイレクトを挟まない）
const PROD_URL = "https://www.engineer-navigator.jp";

const serverUrl = process.env.CAP_SERVER_URL ?? PROD_URL;

const config: CapacitorConfig = {
  // 逆DNS形式（ドメイン engineer-navigator.jp はハイフンを含みAndroidのパッケージ名に
  // 使えないため、短縮形 engnavi を採用）
  appId: "jp.engnavi.app",
  appName: "Engineer Navigator",
  webDir: "www",
  server: {
    url: serverUrl,
    // ローカル検証（http）のときだけ平文通信を許可。本番httpsでは無効
    cleartext: serverUrl.startsWith("http://"),
  },
  ios: {
    // サイト側が safe-area (viewport-fit) を扱うため、ネイティブ側では余白を入れない
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#d7e7f4", // manifest.ts の background_color と揃える
      showSpinner: false,
    },
    StatusBar: {
      // DARK = 暗い背景向け（白文字）。帯（body::before）が royal なので白文字にする
      style: "DARK",
      backgroundColor: "#004aad", // manifest.ts の theme_color と揃える
    },
  },
};

export default config;
