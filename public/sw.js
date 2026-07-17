// Engineer Navigator の最小サービスワーカー（PWAインストール可能化）。
// 方針: 不変な静的アセットだけキャッシュし、ページ/APIは常にネットワーク（古い内容を
// 出さないための保守的な設計）。fetchハンドラを持つことでインストール要件を満たす。

const CACHE = "engnavi-static-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 不変アセット（ビルド出力・アイコン）だけ cache-first
  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon");
  if (!cacheable) return; // それ以外は既定のネットワーク処理に任せる

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })()
  );
});
