"use client";

// モバイルドックのカスタマイズ（Issue #10）。
// 候補から3つ選ぶと、左端固定の▶スタートの右に選択順（バッジの 1・2・3）で並ぶ。

import { useState, useTransition } from "react";
import { setDockApps } from "@/app/actions";
import { DOCK_SLOTS, type AppDef } from "@/lib/apps";
import { PixelIcon } from "@/components/pixel-icon";

export function DockEditor(props: { apps: AppDef[]; initial: string[] }) {
  const [picked, setPicked] = useState<string[]>(props.initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setSaved(false);
    setError(null);
    setPicked((cur) =>
      cur.includes(id)
        ? cur.filter((v) => v !== id)
        : cur.length < DOCK_SLOTS
          ? [...cur, id]
          : cur
    );
  }

  function save() {
    start(async () => {
      try {
        await setDockApps(picked);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {props.apps.map((a) => {
          const order = picked.indexOf(a.id);
          const on = order >= 0;
          const full = !on && picked.length >= DOCK_SLOTS;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              disabled={full}
              aria-pressed={on}
              className={`relative flex items-center gap-2 rounded-lg border-[2.5px] border-line8 px-2.5 py-2 text-left text-[12.5px] font-bold shadow-hard-sm transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                on
                  ? "bg-royal text-white"
                  : full
                    ? "bg-win text-inksoft opacity-50"
                    : "bg-surface text-ink"
              }`}
            >
              <PixelIcon id={a.id} px={2} />
              <span className="truncate">{a.name}</span>
              {on && (
                <span
                  aria-label={`${order + 1}番目`}
                  className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded border-2 border-line8 bg-lemon font-pixel text-[11px] text-ink"
                >
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || picked.length !== DOCK_SLOTS}
          className="btn8 btn8-start px-4 py-1.5 text-[12px] disabled:opacity-50"
        >
          ▶ 保存（{picked.length}/{DOCK_SLOTS}）
        </button>
        {saved && (
          <span className="font-pixel text-[11px] tracking-wide text-royal">
            ✓ 保存しました
          </span>
        )}
        {error && <span className="text-[12px] text-pinkhot">{error}</span>}
      </div>
    </div>
  );
}
