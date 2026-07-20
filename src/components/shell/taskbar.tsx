"use client";

// デスクトップシェルの下部バー（松UI・Issue #6想定の刷新）。
// PC: タスクバー（▶スタート + 現在地チップ + トレイ）
// モバイル: ドック（▶スタート固定が左端 + ユーザーが選んだ3枠・Issue #10）+ 全画面ドロワー
// スタートメニュー/ドロワーの中身は APPS レジストリから生成（単一ソース）。

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_GROUPS, type AppDef } from "@/lib/apps";
import { PixelIcon } from "@/components/pixel-icon";
import { PixelAvatar } from "@/components/pixel-avatar";

export type ShellPlayer = {
  displayName: string;
  sprite: string;
  accent?: string;
  level: number;
  stageName: string;
  generation: number;
  geneTitle: string | null;
};

export function Taskbar(props: {
  apps: AppDef[];
  dock: AppDef[]; // 解決済みの3枠（layout.tsx で resolveDock 済み）
  player: ShellPlayer;
  dungeonOk: boolean;
  streak: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState("--:--");
  const pathname = usePathname();
  const current = props.apps.find(
    (a) => pathname === a.href || pathname.startsWith(a.href + "/")
  );

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    };
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* ===== スタートメニュー（PC）/ ドロワー（モバイル） ===== */}
      {menuOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-ink/35 sm:bg-transparent"
          onClick={() => setMenuOpen(false)}
        >
          <nav
            aria-label="スタートメニュー"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-[54px] max-h-[calc(100dvh-70px)] overflow-y-auto rounded-t-2xl border-t-[2.5px] border-line8 bg-win shadow-hard sm:inset-x-auto sm:bottom-[58px] sm:left-2.5 sm:w-[300px] sm:rounded-xl sm:border-[2.5px]"
          >
            <div className="flex items-center gap-3 bg-royal px-4 py-3 text-white">
              <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-lg border-[2.5px] border-line8 bg-surface">
                <PixelAvatar sprite={props.player.sprite} px={4} accent={props.player.accent} />
              </span>
              <span className="min-w-0">
                <b className="block truncate font-pixel text-[13px] tracking-wide">
                  {props.player.displayName}
                </b>
                <small className="block font-pixel text-[10px] tracking-wide text-peri">
                  Lv {props.player.level} — {props.player.stageName} ｜ 第
                  {props.player.generation}世代
                </small>
                {props.player.geneTitle && (
                  <small className="block font-pixel text-[10px] tracking-wide text-lemon">
                    ◆ {props.player.geneTitle}
                  </small>
                )}
              </span>
            </div>
            <div className="px-2.5 py-2">
              <Link
                href="/"
                onClick={closeMenu}
                className="mb-1 flex items-center gap-2.5 rounded-lg border-2 border-dashed border-peri px-2 py-1.5 text-[13.5px] font-bold hover:bg-surface"
              >
                <span className="inline-flex gap-1" aria-hidden="true">
                  <i className="h-2.5 w-2.5 rounded-full border-2 border-line8 bg-pinkhot" />
                  <i className="h-2.5 w-2.5 rounded-full border-2 border-line8 bg-lemon" />
                </span>
                デスクトップにもどる
                <i className="ml-auto font-pixel text-[9.5px] not-italic tracking-wide text-inksoft">HOME</i>
              </Link>
              {(Object.keys(APP_GROUPS) as (keyof typeof APP_GROUPS)[]).map((gid) => {
                const apps = props.apps.filter((a) => a.group === gid);
                if (apps.length === 0) return null;
                return (
                  <div key={gid} className="mb-1.5">
                    <b className="block px-2 py-1 font-pixel text-[10px] tracking-[0.16em] text-inksoft">
                      {APP_GROUPS[gid]}/
                    </b>
                    {apps.map((a) => (
                      <Link
                        key={a.id}
                        href={a.href}
                        onClick={closeMenu}
                        className="flex items-center gap-2.5 rounded-lg border-2 border-transparent px-2 py-1.5 text-[13.5px] font-bold hover:border-peri hover:bg-surface"
                      >
                        <PixelIcon id={a.id} px={2} />
                        {a.name}
                        <i className="ml-auto font-pixel text-[9.5px] not-italic tracking-wide text-inksoft">
                          {a.id.toUpperCase()}
                          {a.ext}
                        </i>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* ===== タスクバー（PC）/ ドック（モバイル） ===== */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 flex h-[54px] items-center gap-2 border-t-[2.5px] border-line8 bg-royal px-2.5 pb-[env(safe-area-inset-bottom)] sm:px-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className="flex flex-col items-center gap-0.5 rounded-lg border-[2.5px] border-line8 bg-pinkhot px-3 py-1 font-pixel text-[12px] tracking-wide text-white shadow-[2px_2px_0_rgba(0,0,0,0.4)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:flex-row sm:gap-1.5 sm:px-4 sm:py-1.5"
        >
          ▶ <span className="text-[10px] sm:text-[12px]">スタート</span>
        </button>

        {/* モバイル: ドック（▶スタートの右に選択順で3枠） */}
        <div className="flex flex-1 items-center justify-around sm:hidden">
          {props.dock.map((a) => (
            <Link key={a.id} href={a.href} className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white active:bg-royal2">
              <PixelIcon id={a.id} px={2} />
              {a.name}
            </Link>
          ))}
        </div>

        {/* PC: ブランド + 現在地チップ + トレイ */}
        <div className="hidden flex-1 items-center gap-3 sm:flex">
          <Link
            href="/"
            className="whitespace-nowrap font-pixel text-[12.5px] tracking-wide text-white hover:text-lemon"
          >
            EngineerNavigator<span className="text-peri">.exe</span>
          </Link>
          {current && (
            <span className="rounded-md border-2 border-line8 bg-win px-2.5 py-1 font-pixel text-[11px] tracking-wide text-ink">
              {current.name}
              {current.ext}
            </span>
          )}
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {props.dungeonOk && (
            <Link
              href="/dungeon"
              className="rounded-md border-2 border-peri bg-royal2 px-2 py-0.5 text-[11px] font-bold text-white hover:border-white"
            >
              ⛏ 潜行OK
            </Link>
          )}
          {props.streak >= 2 && (
            <span className="rounded-md border-2 border-peri bg-royal2 px-2 py-0.5 text-[11px] font-bold text-white">
              🔥 {props.streak}日連続
            </span>
          )}
          <span className="font-pixel text-[12px] tracking-[0.1em] text-peri" suppressHydrationWarning>
            {clock}
          </span>
        </div>
      </div>
    </>
  );
}
