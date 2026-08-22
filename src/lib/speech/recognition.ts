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
// 呼び出し側は resolveEngineInfo()（または resolveEngine()）→ startDictation() だけを使う。
//
// どれも使えないとき（none）は、UIから音声入力を黙って消さずに「なぜ使えないか」を
// 出すこと。判定が none に倒れるとボタンごと消えるため、ユーザーからは
// 「音声入力が無くなった」に見えてしまう（実際にそう報告された）。

import { canRecord, serverSttEnabled, startRecording } from "./recorder";

export type SpeechEngine = "native" | "web" | "recorder" | "none";

/** 音声入力が使えない理由（ユーザーに出す文言の出し分けに使う） */
export type UnavailableReason =
  | "app-outdated" // アプリ版だが音声認識プラグインが無い（プラグイン導入前のビルド）
  | "browser"; // ブラウザが未対応で、サーバーSTTフォールバックも無効

export type EngineInfo = { engine: SpeechEngine; reason?: UnavailableReason };

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

/**
 * 環境の能力からエンジンを決める純関数（判定ロジックの本体。DOMに触らない）。
 * アプリ版で web にフォールバックしないのは、WKWebViewの Web Speech API が
 * 「存在するのに動かない」ため（AGENTS.md の決まりごと）。
 */
export function chooseEngine(caps: {
  /** アプリ版（Capacitor）で動いている */
  nativeApp: boolean;
  /** ネイティブ音声認識プラグインが注入されている */
  nativePlugin: boolean;
  /** Web Speech API が使える */
  web: boolean;
  /** 録音 + サーバーSTT が使える */
  recorder: boolean;
}): EngineInfo {
  if (caps.nativeApp) {
    if (caps.nativePlugin) return { engine: "native" };
    if (caps.recorder) return { engine: "recorder" };
    // アプリの殻が古い（Web側だけ更新されてもネイティブは更新されない）
    return { engine: "none", reason: "app-outdated" };
  }
  if (caps.web) return { engine: "web" };
  if (caps.recorder) return { engine: "recorder" };
  return { engine: "none", reason: "browser" };
}

/** 音声入力が使えない理由をユーザー向けの日本語にする */
export function unavailableMessage(reason?: UnavailableReason): string {
  switch (reason) {
    case "app-outdated":
      return "アプリを最新版に更新すると音声入力が使えます。それまではキーボードで入力してください";
    case "browser":
      return "このブラウザは音声入力に対応していません。Chrome / Safari かアプリ版でお試しください";
    default:
      return "この環境では音声入力を利用できません";
  }
}

let resolvedEngine: Promise<EngineInfo> | null = null;

/** 利用可能な音声入力エンジンと、使えない場合の理由を判定する（結果はセッション中キャッシュ） */
export function resolveEngineInfo(): Promise<EngineInfo> {
  resolvedEngine ??= (async () => {
    const local = detectLocalEngine();
    // ネイティブ/webが使えるならサーバー照会（/api/transcribe）は省く
    const recorder =
      local === "none" && canRecord() && (await serverSttEnabled());
    return chooseEngine({
      nativeApp: isNativeApp(),
      nativePlugin: local === "native",
      web: local === "web",
      recorder,
    });
  })();
  return resolvedEngine;
}

/** 利用可能な音声入力エンジンを判定する（理由が要らない呼び出し側向け） */
export function resolveEngine(): Promise<SpeechEngine> {
  return resolveEngineInfo().then((i) => i.engine);
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
      opts.onError?.(unavailableMessage());
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
    // Androidは端末に音声認識サービスが無い/無効だとここに来る
    return fail(
      "端末の音声認識が使えません。端末の設定で音声入力を有効にしてください"
    );
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
