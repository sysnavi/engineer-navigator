"use client";

// 保存/送信結果のトースト（右上・数秒で自動で消える）。
// - notify(kind, text): クライアントコンポーネントからどこでも発火
// - <ActionForm action={サーバーアクション} ok="...">: <form>の置き換え。
//   アクション成功でokをトースト、throwされたらエラートースト（エラーページに落とさない）
// 配置の住み分け: 右下=TIPS.txt、左下=レアキャラ来訪。結果表示は右上が指定席。
// ストアはモジュールレベル + useSyncExternalStore（Provider不要・SSR安全）

import { useSyncExternalStore } from "react";

type Toast = { id: number; kind: "ok" | "error"; text: string; leaving: boolean };

const SHOW_MS = 2600;
const FADE_MS = 300;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function notify(kind: "ok" | "error", text: string) {
  const id = nextId++;
  toasts = [...toasts, { id, kind, text, leaving: false }];
  emit();
  // エラーは読む時間を少し長めに
  const shown = kind === "error" ? SHOW_MS + 1600 : SHOW_MS;
  setTimeout(() => {
    toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    emit();
  }, shown);
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, shown + FADE_MS);
}

/** layout に1つだけ置く表示側 */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  if (list.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print pointer-events-none fixed right-3 top-3 z-[1400] flex w-[min(280px,calc(100vw-24px))] flex-col gap-2 sm:top-4"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-lg border-[2.5px] border-line8 bg-win px-3 py-2 shadow-hard-sm transition-all duration-300 ${
            t.leaving ? "-translate-y-1.5 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <span
            aria-hidden="true"
            className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 border-line8 font-pixel text-[11px] text-white ${
              t.kind === "ok" ? "bg-[var(--good)]" : "bg-[var(--crit)]"
            }`}
          >
            {t.kind === "ok" ? "✓" : "!"}
          </span>
          <p className="min-w-0 font-pixel text-[11px] leading-relaxed tracking-wide text-ink">
            {t.text}
          </p>
        </div>
      ))}
    </div>
  );
}

/** 結果トーストつき<form>。actionはサーバーアクション（propsで渡せる） */
export function ActionForm(props: {
  action: (formData: FormData) => Promise<unknown>;
  ok: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      className={props.className}
      action={async (formData: FormData) => {
        try {
          await props.action(formData);
          notify("ok", props.ok);
        } catch (e) {
          notify(
            "error",
            e instanceof Error && e.message ? e.message : "保存に失敗しました"
          );
        }
      }}
    >
      {props.children}
    </form>
  );
}
