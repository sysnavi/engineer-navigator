import type { ReactElement } from "react";

// PWA/ファビコン用の8bit風アイコン（next/og の ImageResponse で描画）。
// ロイヤルの正方形＋ピンク/レモンのドット＋「EN」。マスカブル安全域を考慮して中央寄せ。

export function iconElement(size: number): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#004aad",
        color: "#ffffff",
        fontWeight: 800,
        letterSpacing: -size * 0.02,
      }}
    >
      <div style={{ display: "flex", gap: size * 0.05, marginBottom: size * 0.04 }}>
        <div
          style={{
            width: size * 0.11,
            height: size * 0.11,
            borderRadius: "50%",
            background: "#F24E9C",
            border: `${size * 0.02}px solid #ffffff`,
          }}
        />
        <div
          style={{
            width: size * 0.11,
            height: size * 0.11,
            borderRadius: "50%",
            background: "#FCE94F",
            border: `${size * 0.02}px solid #ffffff`,
          }}
        />
      </div>
      <div style={{ fontSize: size * 0.42, lineHeight: 1 }}>EN</div>
    </div>
  );
}
