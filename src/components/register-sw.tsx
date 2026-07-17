"use client";

import { useEffect } from "react";

// サービスワーカーを登録する（PWAとしてホーム画面に追加できるように）。
// 本番のみ登録し、開発時はキャッシュの混乱を避けて無効化。

export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 登録失敗は致命的ではないので握りつぶす
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
