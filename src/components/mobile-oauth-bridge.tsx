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

  // localStorage採用: WebViewのプロセスがOAuth中に再起動しても生き残るように
  // （認証完了後すぐ消す。端末外には出ない値）
  var VERIFIER_KEY = "en_mobile_login_verifier";

  function start(provider) {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    var verifier = toHex(bytes.buffer);
    localStorage.setItem(VERIFIER_KEY, verifier);
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (d) {
      cap().Plugins.Browser.open({
        url: location.origin + "/api/auth/" + provider + "/start?client=mobile&vh=" + toHex(d)
      });
    });
  }

  // silent=true はgetLaunchUrl経路（古い起動URLを拾い直す可能性がある）用:
  // 失敗しても画面を汚さず、verifierも残す（本物のappUrlOpenが後から処理できる）
  function handleDeepLink(url, silent) {
    if (url.indexOf("jp.engnavi.app://auth") !== 0) return;
    // 二重着火ガード（同一ページ内でイベントが重複しても最初の1回だけ処理する）
    if (window.__enMobileOAuthHandling) return;
    window.__enMobileOAuthHandling = true;
    var params = new URLSearchParams(url.split("?")[1] || "");
    try {
      var browser = cap().Plugins.Browser;
      if (browser && browser.close) browser.close().catch(function () {});
    } catch (e) { /* Android等、close非対応でも先へ進む */ }

    function bail(dest) {
      if (silent) {
        window.__enMobileOAuthHandling = false; // 本物の着信のために解放
        return;
      }
      localStorage.removeItem(VERIFIER_KEY);
      location.href = dest;
    }

    var error = params.get("error");
    if (error) {
      bail("/welcome?oauth_error=" + encodeURIComponent(error));
      return;
    }
    var token = params.get("token");
    var verifier = localStorage.getItem(VERIFIER_KEY);
    if (!token || !verifier) {
      bail("/welcome?oauth_error=verifier");
      return;
    }
    fetch("/api/auth/mobile/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token, verifier: verifier })
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (res.ok) {
          localStorage.removeItem(VERIFIER_KEY);
          location.href = (data && data.redirectTo) || "/";
        } else {
          bail((data && data.redirectTo) || "/welcome?oauth_error=exchange");
        }
      });
    }, function () {
      bail("/welcome?oauth_error=exchange");
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
      app.addListener("appUrlOpen", function (data) { handleDeepLink(data.url, false); });
    }
    // コールドスタート対応: 認証中にOSがアプリを落としていた場合、ディープリンクは
    // リスナー登録前に発火済みでappUrlOpenでは受け取れない。ログイン途中の印
    // （verifier）が残っている時だけ起動URLを拾い直す。silent=trueなので、
    // 拾ったURLが古くて失敗しても画面は汚れず、本物の着信処理も妨げない
    if (app && app.getLaunchUrl && localStorage.getItem(VERIFIER_KEY)) {
      app.getLaunchUrl().then(function (r) {
        if (r && r.url) handleDeepLink(r.url, true);
      }).catch(function () {});
    }
  }
})();`;

export function MobileOAuthBridge() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
