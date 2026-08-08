// モバイルアプリ（Capacitor WebView）のOAuthアプリ内完結ブリッジ。
//
// なぜReactコンポーネントでなくインラインスクリプトか:
// Next.js 16はクライアントコンポーネントをビューポート到達時に遅延ハイドレートする。
// ハイドレート前にログインボタンを押すと素の<a>遷移が走り、WebView内で
// GoogleにブロックされるかSafariに逃げてstate検証で死ぬ（TestFlight初回配布の不具合）。
// インラインスクリプトのcaptureリスナーならHTMLパース直後から確実に捕捉できる。
//
// 対象は a[data-oauth-start]（welcomeのログイン・mypageの連携）。
// 通常のブラウザでは何もしない（isNativePlatformがfalse）。
// フロー全体の解説は src/lib/mobile-login.ts。

const SCRIPT = `(function () {
  if (window.__enMobileOAuth) return;
  window.__enMobileOAuth = true;

  function cap() { return window.Capacitor; }
  function isNative() {
    var c = cap();
    return !!(c && c.isNativePlatform && c.isNativePlatform());
  }
  function toHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  var VERIFIER_KEY = "en_mobile_login_verifier";

  function start(provider) {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    var verifier = toHex(bytes.buffer);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (d) {
      cap().Plugins.Browser.open({
        url: location.origin + "/api/auth/" + provider + "/start?client=mobile&vh=" + toHex(d)
      });
    });
  }

  function handleDeepLink(url) {
    if (url.indexOf("jp.engnavi.app://auth") !== 0) return;
    var params = new URLSearchParams(url.split("?")[1] || "");
    try {
      var browser = cap().Plugins.Browser;
      if (browser && browser.close) browser.close().catch(function () {});
    } catch (e) { /* Android等、close非対応でも先へ進む */ }

    var error = params.get("error");
    if (error) {
      location.href = "/welcome?oauth_error=" + encodeURIComponent(error);
      return;
    }
    var token = params.get("token");
    var verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    if (!token || !verifier) {
      location.href = "/welcome?oauth_error=state";
      return;
    }
    fetch("/api/auth/mobile/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token, verifier: verifier })
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        location.href = res.ok
          ? ((data && data.redirectTo) || "/")
          : ((data && data.redirectTo) || "/welcome?oauth_error=exchange");
      });
    }, function () {
      location.href = "/welcome?oauth_error=exchange";
    });
  }

  // captureフェーズ: Reactのハイドレート状態に関係なく最初に捕まえる
  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest("a[data-oauth-start]") : null;
    if (!a || !isNative()) return;
    e.preventDefault();
    e.stopPropagation();
    start(a.getAttribute("data-oauth-start"));
  }, true);

  // ディープリンク待受（Capacitorブリッジはページスクリプトより先に注入されている）
  if (isNative()) {
    var app = cap().Plugins.App;
    if (app && app.addListener) {
      app.addListener("appUrlOpen", function (data) { handleDeepLink(data.url); });
    }
  }
})();`;

export function MobileOAuthBridge() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
