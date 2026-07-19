"use client";

// マイページから初回チュートリアルを再表示するボタン。
// layout にマウントされた Tutorial に window イベントで開くよう伝える。
export function ReplayTutorialButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("en:tutorial"))}
      className="btn8 px-3 py-1.5 text-[11px]"
    >
      ？ はじめかたガイド
    </button>
  );
}
