"use client";

import { useFormStatus } from "react-dom";

// フォーム送信中に「処理中…」を出す汎用ボタン（AI待ちの体感を減らす）。
// server action のフォーム内で <SubmitButton>ラベル</SubmitButton> として使う。

export function SubmitButton(props: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={props.className ?? "btn8 btn8-start text-[13px]"}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (props.pendingLabel ?? "処理中…") : props.children}
    </button>
  );
}
