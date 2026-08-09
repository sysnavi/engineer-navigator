"use client";

// 質問読み上げ（Web Speech Synthesis）。
// WKWebView（アプリ版）・iOS Safari・デスクトップの主要ブラウザで動く。
// 非対応環境では canSpeak() が false になり、呼び出し側は読み上げをスキップする。

let unlocked = false;

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * iOS系は「ユーザー操作起点でない発話」をブロックするため、
 * タップハンドラの同期処理内でこれを一度呼んで発話を解禁しておく。
 */
export function unlockSpeech(): void {
  if (!canSpeak() || unlocked) return;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  unlocked = true;
}

function pickJaVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith("ja")) ?? null;
}

// 進行中の speak() を stopSpeaking() から即座に resolve させるためのフック。
// （synth.cancel() の onend/onerror 発火はブラウザ差があるため頼らない）
let resolveCurrent: (() => void) | null = null;

/**
 * テキストを読み上げ、終了（またはキャンセル・エラー）で resolve する。
 * 呼び出し側は事前に sanitizeForSpeech で整形しておくこと。
 */
export function speak(
  text: string,
  opts?: { rate?: number }
): Promise<void> {
  if (!canSpeak() || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel(); // 前の発話が残っていたら破棄
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    const voice = pickJaVoice();
    if (voice) u.voice = voice;
    u.rate = opts?.rate ?? 1.05;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (resolveCurrent === done) resolveCurrent = null;
      resolve();
    };
    resolveCurrent = done;
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
    // TTSエンジンが黙って発話を捨てる環境の検知: 少し待っても発話が
    // 始まっていなければ諦めて先へ進む（読めない環境で会話を止めない）
    setTimeout(() => {
      if (!synth.speaking && !synth.pending) done();
    }, 1200);
    // 一部環境で onend が発火しないことがある保険（長文でも詰まらない上限）
    const estimateMs = Math.min(60_000, 1500 + text.length * 220);
    setTimeout(done, estimateMs);
  });
}

/** 読み上げを打ち切る。進行中の speak() はすぐ resolve される */
export function stopSpeaking(): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  resolveCurrent?.();
}
