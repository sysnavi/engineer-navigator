"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TIPS, type Tip } from "@/lib/tips";

// サイトTIPSトースト。1日1回まで、ページを開いて数秒後に右下へさりげなく出す。
// 未読のTIPSを優先し、全部読んだら最初から巡回。状態はlocalStorage（サーバー状態なし）。
// 配置: 左下はレアキャラ来訪(Visitor)の指定席なので右下。タスクバー(desktopシェル)を
// 避けるため bottom-16。モーダル類(z-50〜60)より下の z-30。

const STORAGE_KEY = "en_tips";
const SHOW_DELAY_MS = 4000;
const AUTO_HIDE_MS = 25000;

type TipsState = { lastShown: string; seen: string[] };

function loadState(): TipsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TipsState;
  } catch {
    // 壊れていたら初期化
  }
  return { lastShown: "", seen: [] };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TipsToast() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const state = loadState();
    if (state.lastShown === today()) return; // きょうはもう表示済み

    // 未読を優先。全部読んだらリセットして最初から
    const unseen = TIPS.filter((t) => !state.seen.includes(t.id));
    const pool = unseen.length > 0 ? unseen : TIPS;
    const seen = unseen.length > 0 ? state.seen : [];
    const pick = pool[Math.floor(Math.random() * pool.length)];

    const showTimer = setTimeout(() => {
      setTip(pick);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lastShown: today(),
            seen: [...seen, pick.id],
          } satisfies TipsState)
        );
      } catch {
        // localStorage不可でも表示だけはする
      }
    }, SHOW_DELAY_MS);
    return () => clearTimeout(showTimer);
  }, []);

  // 表示後は一定時間で自動フェードアウト
  useEffect(() => {
    if (!tip) return;
    const hideTimer = setTimeout(() => setLeaving(true), AUTO_HIDE_MS);
    return () => clearTimeout(hideTimer);
  }, [tip]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setTip(null), 300);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!tip) return null;

  return (
    <div
      role="status"
      className={`no-print fixed bottom-16 right-3 z-30 w-[280px] transition-all duration-300 sm:bottom-20 sm:w-[320px] ${
        leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="overflow-hidden rounded-lg border-[2.5px] border-line8 bg-win shadow-hard-sm">
        <div className="flex items-center gap-1.5 bg-royal px-2.5 py-1 font-pixel text-[10px] tracking-[0.12em] text-white">
          <span aria-hidden="true">💡</span>
          TIPS.txt
          <button
            onClick={() => setLeaving(true)}
            className="ml-auto rounded border-2 border-white px-1 text-[9px] leading-tight"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[12px] leading-relaxed text-ink">
            <span className="mr-1" aria-hidden="true">
              {tip.emoji}
            </span>
            {tip.text}
          </p>
          {tip.href && (
            <Link
              href={tip.href}
              onClick={() => setLeaving(true)}
              className="mt-1.5 inline-block font-pixel text-[10.5px] tracking-wide text-royal2 hover:text-pinkhot"
            >
              見にいく →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
