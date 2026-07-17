"use client";

// root layout 自体が壊れたときの最終フォールバック（独自の html/body を持つ必要がある）。
// レイアウトに依存せず最小限の見た目で表示する。

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#e8f0ff",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ color: "#2340a0", fontSize: 22 }}>
            読み込みに失敗しました
          </h1>
          <p style={{ color: "#5566a0", fontSize: 14 }}>
            時間をおいてもう一度お試しください。
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 20px",
              border: "2px solid #12235f",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            もう一度
          </button>
        </div>
      </body>
    </html>
  );
}
