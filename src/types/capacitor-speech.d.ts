// Capacitorブリッジ（アプリ版WKWebView / Android WebView）の最小型宣言。
// アプリ本体はリモートURL方式なので npm パッケージは import せず、
// シェルが window に注入するグローバルブリッジを直接呼ぶ。使う範囲だけ宣言する。

interface CapacitorListenerHandle {
  remove(): void | Promise<void>;
}

/** @capacitor-community/speech-recognition のブリッジAPI */
interface CapacitorSpeechRecognitionPlugin {
  available(): Promise<{ available: boolean }>;
  /** v5+ */
  requestPermissions?(): Promise<{ speechRecognition: string }>;
  checkPermissions?(): Promise<{ speechRecognition: string }>;
  /** 旧API（残っている環境向けフォールバック） */
  requestPermission?(): Promise<void>;
  start(options: {
    language?: string;
    maxResults?: number;
    partialResults?: boolean;
    popup?: boolean;
  }): Promise<{ matches?: string[] } | void>;
  stop(): Promise<void>;
  addListener(
    eventName: "partialResults",
    cb: (data: { matches?: string[] }) => void
  ): Promise<CapacitorListenerHandle> | CapacitorListenerHandle;
  addListener(
    eventName: "listeningState",
    cb: (data: { status?: "started" | "stopped" }) => void
  ): Promise<CapacitorListenerHandle> | CapacitorListenerHandle;
  removeAllListeners?(): Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    SpeechRecognition?: CapacitorSpeechRecognitionPlugin;
    [name: string]: unknown;
  };
}

interface Window {
  Capacitor?: CapacitorGlobal;
}
