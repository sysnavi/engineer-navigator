"use client";

import { useEffect, useState } from "react";
import { GuardedLink } from "@/components/nav-guard";
import { TIPS, ONBOARDING_TIPS, type Tip } from "@/lib/tips";

// サイトTIPSトースト。ページを開いて数秒後に右下へさりげなく出す。状態はlocalStorage。
// - 通常: 1日1回まで・未読からランダム。
// - 新規期間（登録3日以内・newcomer prop）: 1日3回まで、まずオンボーディングキューを
//   優先度順に流し、消化しきったら通常のランダムに合流する（Issue #20）。
// 配置: 左下はレアキャラ来訪(Visitor)の指定席なので右下。タスクバー(desktopシェル)は
// 54px + safe-area の高さなので、bottom にも safe-area を足して重なりを避ける
// （Capacitorシェルは viewport-fit=cover でフッターがホームバー領域まで伸びる）。
// モーダル類(z-50〜60)より下の z-30。

const STORAGE_KEY = "en_tips";
const SHOW_DELAY_MS = 4000;
const AUTO_HIDE_MS = 25000;
const NEWCOMER_DAILY_CAP = 3;
const NORMAL_DAILY_CAP = 1;

// day: 集計中の日付 / count: その日の表示回数 / seen: 既読id。
// 旧形式（lastShown/seen）も読めるように吸収する。
type TipsState = { day: string; count: number; seen: string[] };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): TipsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<TipsState> & { lastShown?: string };
      return {
        // 旧形式 lastShown=今日 は「今日1回表示済み」とみなす
        day: o.day ?? o.lastShown ?? "",
        count: o.count ?? (o.lastShown === today() ? 1 : 0),
        seen: o.seen ?? [],
      };
    }
  } catch {
    // 壊れていたら初期化
  }
  return { day: "", count: 0, seen: [] };
}

type Pick = { tip: Tip; resetSeen?: boolean };

// 通常: 未読からランダム。全部読んだら既読をリセットして最初から巡回。
function pickRandom(pool: Tip[], seen: string[]): Pick | null {
  if (pool.length === 0) return null;
  const unseen = pool.filter((t) => !seen.includes(t.id));
  if (unseen.length > 0) {
    return { tip: unseen[Math.floor(Math.random() * unseen.length)] };
  }
  // 全部読んだ → リセットして全体から
  return { tip: pool[Math.floor(Math.random() * pool.length)], resetSeen: true };
}

// 新規期間: まずオンボーディングを優先度順に。消化しきったら通常ランダムへ合流。
function pickNewcomer(seen: string[]): Pick | null {
  const nextOnboarding = [...ONBOARDING_TIPS]
    .sort((a, b) => (a.onboarding ?? 99) - (b.onboarding ?? 99))
    .find((t) => !seen.includes(t.id));
  if (nextOnboarding) return { tip: nextOnboarding };
  return pickRandom(TIPS, seen);
}

export function TipsToast(props: { newcomer?: boolean }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const raw = loadState();
    // 日付が変わっていたらカウントをリセット
    const state: TipsState =
      raw.day === today() ? raw : { day: today(), count: 0, seen: raw.seen };

    const cap = props.newcomer ? NEWCOMER_DAILY_CAP : NORMAL_DAILY_CAP;
    if (state.count >= cap) return; // きょうの上限に達した

    const pick = props.newcomer
      ? pickNewcomer(state.seen)
      : pickRandom(TIPS, state.seen);
    if (!pick) return;

    const showTimer = setTimeout(() => {
      setTip(pick.tip);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            day: today(),
            count: state.count + 1,
            seen: pick.resetSeen ? [pick.tip.id] : [...state.seen, pick.tip.id],
          } satisfies TipsState)
        );
      } catch {
        // localStorage不可でも表示だけはする
      }
    }, SHOW_DELAY_MS);
    return () => clearTimeout(showTimer);
  }, [props.newcomer]);

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
      className={`no-print fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-3 z-30 w-[280px] transition-all duration-300 sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:w-[320px] ${
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
            <GuardedLink
              href={tip.href}
              onClick={() => setLeaving(true)}
              className="mt-1.5 inline-block font-pixel text-[10.5px] tracking-wide text-royal2 hover:text-pinkhot"
            >
              見にいく →
            </GuardedLink>
          )}
        </div>
      </div>
    </div>
  );
}
