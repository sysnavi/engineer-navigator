import { ImageResponse } from "next/og";

// SNSでシェアされたときのカード画像（Issue #15）。
// 画像ファイルを置かずに動的生成する — コピーを変えたらカードも自動で追従する。
// next/og は satori なので、使えるCSSは限定的（flex中心・grid不可）。

export const runtime = "edge";
export const alt = "Engineer Navigator — がんばりは、ぜんぶ経験値になる。";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 8bitの世界観に合わせた最小限のドット絵（ひよこ）。
// PixelAvatar はCSS変数に依存していて satori では解決できないため、
// ここでは色を直値で持った軽量版を描く。
const CHICK = [
  "..kkkk..",
  ".kyyyyk.",
  "kybyybyk",
  "kyyyyyyk",
  "kpyyyypk",
  "kyyooyyk",
  ".kyyyyk.",
  "..k..k..",
];
const COLORS: Record<string, string> = {
  k: "#0b1533",
  y: "#ffd43b",
  o: "#f59f00",
  p: "#ff4d8d",
  b: "#004aad",
};

export default function Image() {
  const px = 26;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#dbe6f6",
          // 方眼紙の質感（アプリの背景と揃える）
          backgroundImage:
            "linear-gradient(#c7d7ef 1px, transparent 1px), linear-gradient(90deg, #c7d7ef 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {CHICK.map((row, y) => (
              <div key={y} style={{ display: "flex" }}>
                {row.split("").map((c, x) => (
                  <div
                    key={x}
                    style={{
                      width: px,
                      height: px,
                      backgroundColor: COLORS[c] ?? "transparent",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 68,
                fontWeight: 800,
                color: "#004aad",
                lineHeight: 1.25,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>がんばりは、</span>
              <span>ぜんぶ経験値になる。</span>
            </div>
            <div style={{ marginTop: 22, fontSize: 28, color: "#3c4a63" }}>
              週報・腕試し・ダンジョン — エンジニアの成長OS
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            fontSize: 24,
            color: "#3c4a63",
            display: "flex",
          }}
        >
          Engineer Navigator ／ 登録なしで試せます
        </div>
      </div>
    ),
    size
  );
}
