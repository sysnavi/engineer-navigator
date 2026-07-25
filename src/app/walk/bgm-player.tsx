"use client";

// おさんぽのBGMプレイヤー。全曲を1周してから引き直すランダム再生で、曲間は5秒あける。
//
// ON状態は復元しない: ブラウザは操作なしの自動再生を必ず止めるので、復元しても
// 音は出ず「ONなのに鳴らない」状態になるだけ。毎回ボタンから始めてもらう。
// 音量だけは覚えておき、ONにした時点で反映する。

import { useCallback, useEffect, useRef, useState } from "react";
import { BGM_TRACKS, BGM_GAP_MS, BGM_KEY, shuffledOrder } from "@/lib/walk/bgm";

function savedVolume(): number | null {
  try {
    const v = localStorage.getItem(BGM_KEY.vol);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
  } catch {
    return null; // プライベートモード等でlocalStorageが使えなくても動かす
  }
}

export function BgmPlayer() {
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(0.5);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const orderRef = useRef<number[]>([]);
  const posRef = useRef(0);
  const gapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 次の曲へ。1周したら順番を引き直す */
  const nextTrack = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (posRef.current >= orderRef.current.length) {
      const last = orderRef.current.at(-1);
      orderRef.current = shuffledOrder(BGM_TRACKS.length, last);
      posRef.current = 0;
    }
    el.src = BGM_TRACKS[orderRef.current[posRef.current]];
    posRef.current++;
    el.play().catch(() => setOn(false)); // 拒否されたら黙って止める
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (on) {
      setOn(false);
      el?.pause();
      if (gapRef.current) {
        clearTimeout(gapRef.current);
        gapRef.current = null;
      }
      return;
    }
    // ONにするのはユーザー操作の中なので、ここで再生を始めれば自動再生制限に引っかからない
    const v = savedVolume();
    if (v != null) {
      setVol(v);
      if (el) el.volume = v;
    }
    setOn(true);
    if (orderRef.current.length === 0) {
      orderRef.current = shuffledOrder(BGM_TRACKS.length);
      posRef.current = 0;
    }
    if (el?.src) el.play().catch(() => setOn(false));
    else nextTrack();
  };

  // 音量をaudio要素へ反映し、端末に覚えておく
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol;
    try {
      localStorage.setItem(BGM_KEY.vol, String(vol));
    } catch {
      /* 保存できなくても再生には影響しない */
    }
  }, [vol]);

  // 曲が終わったら5秒あけて次の曲へ
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      gapRef.current = setTimeout(() => {
        gapRef.current = null;
        nextTrack();
      }, BGM_GAP_MS);
    };
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("ended", onEnded);
      if (gapRef.current) clearTimeout(gapRef.current);
    };
  }, [nextTrack]);

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <button
        onClick={toggle}
        aria-pressed={on}
        className={`rounded-md border-2 border-line8 px-2 py-1 font-pixel text-[10.5px] tracking-wide ${
          on ? "bg-royal text-white" : "bg-win text-ink"
        }`}
      >
        {on ? "♪ BGM" : "🔇 BGM"}
      </button>
      {on && (
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(vol * 100)}
          onChange={(e) => setVol(Number(e.target.value) / 100)}
          aria-label="BGMの音量"
          className="w-[76px] accent-[var(--pink-hot)]"
        />
      )}
    </>
  );
}
