"use client";

import { useEffect } from "react";

// 全 textarea.field8 を「書くほど伸びる」ようにするグローバルリスナー。
// 個々のフォームを触らずに一括適用するため、documentでinput/focusinを委譲監視する。
// （CSSのfield-sizing:contentはiOS Safari未対応のためJSで統一）

const MAX = () => Math.round(window.innerHeight * 0.5); // max-height: 50vh と揃える

// rows属性ぶんの最低高さ（空欄をフォーカスしても縮めない・placeholderが見切れない）
function minHeight(t: HTMLTextAreaElement, style: CSSStyleDeclaration): number {
  const lh =
    parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5 || 20;
  const extra =
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) * 2;
  return (t.rows || 2) * lh + extra;
}

function resize(t: HTMLTextAreaElement) {
  const style = getComputedStyle(t);
  const min = minHeight(t, style);
  t.style.height = "auto";
  t.style.height = `${Math.min(Math.max(t.scrollHeight + 2, min), MAX())}px`;
}

export function AutosizeTextareas() {
  useEffect(() => {
    const onEvent = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLTextAreaElement && t.classList.contains("field8")) {
        resize(t);
      }
    };
    // focusin: 自動保存の下書き等、初期値が入った状態で開いたときにも合わせる
    document.addEventListener("input", onEvent);
    document.addEventListener("focusin", onEvent);
    return () => {
      document.removeEventListener("input", onEvent);
      document.removeEventListener("focusin", onEvent);
    };
  }, []);

  return null;
}
