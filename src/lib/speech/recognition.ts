"use client";

// 音声入力（Speech to Text）の統一レイヤー。環境ごとに3つのエンジンを切り替える:
//
//   native   … アプリ版（Capacitor）。ネイティブの音声認識
//              （iOS: SFSpeechRecognizer / Android: OS標準）をブリッジ経由で使う。
//              WKWebViewでは Web Speech API のコンストラクタが「存在するのに動かない」
//              ため、アプリ版では絶対に web へフォールバックしない。
//   web      … ブラウザ版。Web Speech API（Chrome / Safari）。
//   recorder … どちらも使えない環境（Firefox等）。MediaRecorderで録音して
//              サーバーSTT（/api/transcribe）で文字起こし（recorder.ts）。
//
// 呼び出し側は resolveEngine() → startDictation() だけを使う。

import { canRecord, serverSttEnabled, startRecording } from "./recorder";

export type SpeechEngine = "native" | "web" | "recorder" | "none";

export type RecognitionHandle = {
  /** 聞き取りを終了して結果を確定する（onFinal が呼ばれる） */
  stop(): void;
  /** 結果を捨てて終了する（onFinal は呼ばれない） */
  cancel(): void;
};

export type RecognitionOpts = {
  lang?: string;
  /** 発話後この時間だけ無音が続いたら自動確定（native/webの実装差を吸収） */
  silenceMs?: number;
  /** 一度も発話がないままこの時間経過したら空文字で確定 */
  noSpeechMs?: number;
  onPartial?: (text: string) => void;
  /** 終了時に1回だけ呼ばれる。聞き取れなかったら空文字 */
  onFinal: (text: string) => void;
  /** ユーザーに見せられる日本語メッセージ */
  onError?: (message: string) => void;
};

const DEFAULT_SILENCE_MS = 2500;
const DEFAULT_NO_SPEECH_MS = 8000;

export function isNativeApp(): boolean {
  return (
    typeof window !== "undefined" &&
    window.Capacitor?.isNativePlatform?.() === true
  );
}

function nativePlugin(): CapacitorSpeechRecognitionPlugin | undefined {
  if (typeof window === "undefined") return undefined;
  return window.Capacitor?.Plugins?.SpeechRecognition;
}

function webSR(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/** 同期で判定できる範囲のエンジン検出（recorderの可否はサーバー照会が要るため含まない） */
export function detectLocalEngine(): "native" | "web" | "none" {
  if (isNativeApp()) return nativePlugin() ? "native" : "none";
  return webSR() ? "web" : "none";
}

let resolvedEngine: Promise<SpeechEngine> | null = null;

/** 利用可能な音声入力エンジンを判定する（結果はセッション中キャッシュ） */
export function resolveEngine(): Promise<SpeechEngine> {
  resolvedEngine ??= (async () => {
    const local = detectLocalEngine();
    if (local !== "none") return local;
    if (canRecord() && (await serverSttEnabled())) return "recorder";
    return "none";
  })();
  return resolvedEngine;
}

/** 指定エンジンで聞き取りを開始する */
export async function startDictation(
  engine: SpeechEngine,
  opts: RecognitionOpts
): Promise<RecognitionHandle> {
  switch (engine) {
    case "native":
      return startNative(opts);
    case "web":
      return startWeb(opts);
    case "recorder":
      return startRecording(opts);
    default:
      opts.onError?.("この環境では音声入力を利用できません");
      return { stop() {}, cancel() {} };
  }
}

// ---- native（Capacitorプラグイン） ----------------------------------------

async function startNative(opts: RecognitionOpts): Promise<RecognitionHandle> {
  const plugin = nativePlugin()!;
  const fail = (message: string): RecognitionHandle => {
    opts.onError?.(message);
    return { stop() {}, cancel() {} };
  };

  const avail = await plugin.available().catch(() => ({ available: false }));
  if (!avail.available) {
    return fail("この端末では音声認識を利用できません");
  }

  // 権限（初回はOSのダイアログが出る）
  try {
    if (plugin.requestPermissions) {
      const res = await plugin.requestPermissions();
      if (res.speechRecognition === "denied") {
        return fail(
          "マイクが許可されていません。端末の設定アプリから許可してください"
        );
      }
    } else if (plugin.requestPermission) {
      await plugin.requestPermission();
    }
  } catch {
    return fail(
      "マイクが許可されていません。端末の設定アプリから許可してください"
    );
  }

  let last = "";
  let finished = false;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let noSpeechTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners: CapacitorListenerHandle[] = [];

  const cleanup = () => {
    clearTimeout(silenceTimer);
    clearTimeout(noSpeechTimer);
    noSpeechTimer = undefined;
    for (const l of listeners) void l.remove();
    listeners.length = 0;
    plugin.stop().catch(() => {});
  };

  const finish = (cancelled: boolean) => {
    if (finished) return;
    finished = true;
    cleanup();
    if (!cancelled) opts.onFinal(last.trim());
  };

  const silenceMs = opts.silenceMs ?? DEFAULT_SILENCE_MS;
  const armSilence = () => {
    clearTimeout(silenceTimer);
    if (silenceMs > 0) silenceTimer = setTimeout(() => finish(false), silenceMs);
  };
  noSpeechTimer = setTimeout(
    () => finish(false),
    opts.noSpeechMs ?? DEFAULT_NO_SPEECH_MS
  );

  const partial = await Promise.resolve(
    plugin.addListener("partialResults", (data) => {
      const t = data?.matches?.[0] ?? "";
      if (!t) return;
      last = t;
      clearTimeout(noSpeechTimer);
      opts.onPartial?.(t);
      armSilence();
    })
  );
  listeners.push(partial);

  // Androidは認識終了を listeningState(stopped) で通知してくる
  const state = await Promise.resolve(
    plugin.addListener("listeningState", (data) => {
      if (data?.status === "stopped" && last) finish(false);
    })
  );
  listeners.push(state);

  plugin
    .start({ language: opts.lang ?? "ja-JP", partialResults: true, popup: false })
    .then((r) => {
      // Androidの旧実装は最終結果をstartの戻り値で返す。iOSは即時resolveなので
      // matches が無いresolveは無視して聞き取りを続ける。
      if (r && Array.isArray(r.matches) && r.matches[0]) {
        last = r.matches[0];
        finish(false);
      }
    })
    .catch(() => {
      if (!finished) {
        finished = true;
        cleanup();
        opts.onError?.("音声認識を開始できませんでした");
      }
    });

  return {
    stop: () => finish(false),
    cancel: () => finish(true),
  };
}

// ---- web（Web Speech API） -------------------------------------------------

function startWeb(opts: RecognitionOpts): RecognitionHandle {
  const SR = webSR()!;
  const rec = new SR();
  rec.lang = opts.lang ?? "ja-JP";
  // interim も受け取る。確定(isFinal)前に onend してしまうケースでも
  // 拾えた暫定テキストを結果として使えるようにする。
  rec.interimResults = true;
  rec.continuous = false;

  let finalText = "";
  let interimText = "";
  let finished = false;
  let cancelled = false;
  let noSpeechTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(
    () => rec.stop(),
    opts.noSpeechMs ?? DEFAULT_NO_SPEECH_MS
  );

  rec.onresult = (e) => {
    clearTimeout(noSpeechTimer);
    noSpeechTimer = undefined;
    interimText = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t;
      else interimText += t;
    }
    opts.onPartial?.((finalText + interimText).trim());
  };
  rec.onend = () => {
    if (finished) return;
    finished = true;
    clearTimeout(noSpeechTimer);
    if (!cancelled) opts.onFinal((finalText + interimText).trim());
  };
  rec.onerror = (e) => {
    if (finished) return;
    // "no-speech"・"aborted" は onend 側で空文字として処理される通常系
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      opts.onError?.(
        "マイクが許可されていません。ブラウザの設定を確認してください"
      );
    } else if (e.error === "network") {
      opts.onError?.("音声認識サービスに接続できませんでした");
    }
  };
  try {
    rec.start();
  } catch {
    finished = true;
    clearTimeout(noSpeechTimer);
    opts.onError?.("音声認識を開始できませんでした");
  }

  return {
    stop: () => rec.stop(),
    cancel: () => {
      cancelled = true;
      rec.abort();
    },
  };
}
