"use client";

export function PrintButton() {
  return (
    <button
      className="btn8 btn8-start no-print"
      onClick={() => window.print()}
    >
      ▶ いんさつ / PDF
    </button>
  );
}
