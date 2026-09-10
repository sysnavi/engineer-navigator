"use client";

// ダンジョンのBGM（潜行中ループ）。
//
// 【自動再生のルール】ブラウザはユーザー操作なしの再生を止める。
//  - 「▶ 潜る」はクリックなので、その中で play() を呼べば鳴る（start）
//  - 潜行中にページを開き直したとき（再開）は操作が無いので鳴らせない。
//    play() が拒否されたら次の pointerdown / keydown で再挑戦する（arm）
// 【ON/OFF】おさんぽと違い ON を既定にして端末に覚える。潜るたびに押させると
//  「BGMがある」こと自体に気づかれないため。OFF にした人には二度と鳴らさない。
// 【効果音との住み分け】効果音は WebAudio（blip）、BGMは <audio>。音量は
//  DUNGEON_BGM_DEFAULT_VOL で控えめにし、効果音が埋もれないようにしている。

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  DUNGEON_BGM_DEFAULT_VOL,
  DUNGEON_BGM_FADE_MS,
  DUNGEON_BGM_KEY,
  DUNGEON_BGM_SRC,
  parseVolume,
} from "@/lib/dungeon/bgm";

// 設定（ON/OFF・音量）はモジュールストア + useSyncExternalStore。
// effect 内の setState を避け、SSR ではサーバー用スナップショットを返す（player.tsx の SE と同じ作り）
type Prefs = { on: boolean; vol: number };
const SERVER_PREFS: Prefs = { on: true, vol: DUNGEON_BGM_DEFAULT_VOL };
let prefs: Prefs | null = null;
const listeners = new Set<() => void>();
function snapshot(): Prefs {
  if (!prefs) {
    try {
      prefs = {
        on: localStorage.getItem(DUNGEON_BGM_KEY.on) !== "0",
        vol: parseVolume(localStorage.getItem(DUNGEON_BGM_KEY.vol)) ?? DUNGEON_BGM_DEFAULT_VOL,
      };
    } catch {
      prefs = { ...SERVER_PREFS }; // localStorage が使えなくても鳴らす
    }
  }
  return prefs;
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...snapshot(), ...patch };
  try {
    localStorage.setItem(DUNGEON_BGM_KEY.on, prefs.on ? "1" : "0");
    localStorage.setItem(DUNGEON_BGM_KEY.vol, String(prefs.vol));
  } catch {
    /* 保存できなくても再生には影響しない */
  }
  listeners.forEach((l) => l());
}
const subscribeNoop = () => () => {};

/**
 * @param active 曲を流す状態か（潜行中で、決着していない）
 */
export function useDungeonBgm(active: boolean) {
  const { on, vol } = useSyncExternalStore(subscribe, snapshot, () => SERVER_PREFS);
  // ハイドレーション直後の1回目（サーバー値のまま）では鳴らさない。設定が読めてから判断する
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const armedRef = useRef<(() => void) | null>(null);

  const el = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio(DUNGEON_BGM_SRC);
      a.loop = true;
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  const stopFade = () => {
    if (fadeRef.current) clearInterval(fadeRef.current);
    fadeRef.current = null;
  };
  const disarm = () => {
    armedRef.current?.();
    armedRef.current = null;
  };

  /** 再生を試みる。拒否されたら次のユーザー操作で再挑戦する */
  const play = useCallback(() => {
    const a = el();
    stopFade();
    a.volume = snapshot().vol;
    a.play().then(disarm).catch(() => {
      if (armedRef.current) return;
      const retry = () => {
        disarm();
        a.play().catch(() => {
          /* まだ駄目なら次の操作で */
        });
      };
      addEventListener("pointerdown", retry, { once: true });
      addEventListener("keydown", retry, { once: true });
      armedRef.current = () => {
        removeEventListener("pointerdown", retry);
        removeEventListener("keydown", retry);
      };
    });
  }, [el]);

  const stop = useCallback((fade: boolean) => {
    disarm();
    const a = audioRef.current;
    if (!a || a.paused) return;
    stopFade();
    if (!fade) {
      a.pause();
      return;
    }
    const step = 50;
    const dv = a.volume / (DUNGEON_BGM_FADE_MS / step);
    fadeRef.current = setInterval(() => {
      if (a.volume > dv) {
        a.volume -= dv;
        return;
      }
      stopFade();
      a.pause();
    }, step);
  }, []);

  // ON なら先に読み込みを始めておく（「潜る」で待たせない）。load() は曲を頭に戻すので一度きり
  const preloadedRef = useRef(false);
  useEffect(() => {
    if (!isClient || !on || preloadedRef.current) return;
    preloadedRef.current = true;
    el().load();
  }, [isClient, on, el]);

  // 音量を反映（フェード中は触らない）
  useEffect(() => {
    if (audioRef.current && !fadeRef.current) audioRef.current.volume = vol;
  }, [vol]);

  // 状態に合わせて鳴らす / 止める。決着（active→false）時はフェードで消える
  useEffect(() => {
    if (!isClient) return;
    if (active && on) play();
    else stop(!active && on);
  }, [isClient, active, on, play, stop]);

  // 画面を離れたら止める
  useEffect(
    () => () => {
      disarm();
      stopFade();
      audioRef.current?.pause();
    },
    []
  );

  /** ON/OFF を切り替えて端末に覚える。ON にするのはクリックの中なので即鳴らせる */
  const toggle = () => {
    const next = !on;
    setPrefs({ on: next });
    if (next && active) play();
    else stop(false);
  };

  /**
   * 「▶ 潜る」のクリック内で呼ぶ。サーバー往復（非同期）の後で play() すると
   * ユーザー操作の外と見なされる環境（Safari）があるので、押した瞬間に鳴らし始める
   */
  const start = () => {
    if (snapshot().on) play();
  };

  return { on, vol, setVol: (v: number) => setPrefs({ vol: v }), toggle, start };
}

export function DungeonBgmToggle(props: {
  on: boolean;
  vol: number;
  onToggle: () => void;
  onVol: (v: number) => void;
}) {
  return (
    <span className="ml-auto flex items-center gap-1.5">
      <button
        type="button"
        onClick={props.onToggle}
        aria-pressed={props.on}
        aria-label={props.on ? "BGMを止める" : "BGMを鳴らす"}
        className={`rounded-md border-2 border-line8 px-2 py-0.5 font-pixel text-[10px] tracking-wide ${
          props.on ? "bg-royal text-white" : "bg-win text-ink"
        }`}
      >
        {props.on ? "♪ BGM" : "🔇 BGM"}
      </button>
      {props.on && (
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(props.vol * 100)}
          onChange={(e) => props.onVol(Number(e.target.value) / 100)}
          aria-label="BGMの音量"
          className="w-[64px] accent-[var(--pink-hot)]"
        />
      )}
    </span>
  );
}
