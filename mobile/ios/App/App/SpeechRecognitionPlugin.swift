import Capacitor
import Speech
import AVFoundation

// ボイスインタビュー用の音声認識プラグイン（SFSpeechRecognizer）。
//
// なぜ自前実装か: @capacitor-community/speech-recognition のiOS実装は
// CocoaPodsレイアウト（Swift+ObjC混在）でSPMに取り込めないため、
// iOSだけ同じJSインターフェースをアプリ内プラグインとして提供する。
// AndroidはコミュニティプラグインをGradle経由でそのまま使う。
// JS側の呼び出し口は window.Capacitor.Plugins.SpeechRecognition（web側:
// src/lib/speech/recognition.ts）で、両OS共通。
//
// イベント:
//   partialResults { matches: [String] } … 認識途中経過（確定前も送る）
//   listeningState { status: "started" | "stopped" }
@objc(SpeechRecognitionPlugin)
public class SpeechRecognitionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechRecognitionPlugin"
    public let jsName = "SpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    @objc func available(_ call: CAPPluginCall) {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ja-JP"))
        call.resolve(["available": recognizer?.isAvailable ?? false])
    }

    private func permissionStatusString() -> String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return "granted"
        case .denied, .restricted: return "denied"
        default: return "prompt"
        }
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["speechRecognition": permissionStatusString()])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                call.resolve(["speechRecognition": "denied"])
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                call.resolve(["speechRecognition": granted ? "granted" : "denied"])
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        let language = call.getString("language") ?? "ja-JP"
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.teardown(deactivateSession: false)

            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)),
                  recognizer.isAvailable else {
                call.reject("speech recognizer unavailable")
                return
            }

            let session = AVAudioSession.sharedInstance()
            do {
                // TTS（読み上げ）と交互に使うため playAndRecord。
                // defaultToSpeaker が無いと停止後の読み上げが受話口から鳴る
                try session.setCategory(
                    .playAndRecord,
                    mode: .measurement,
                    options: [.duckOthers, .defaultToSpeaker, .allowBluetoothHFP]
                )
                try session.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                call.reject("audio session failed: \(error.localizedDescription)")
                return
            }

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            self.request = request

            let inputNode = self.audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.removeTap(onBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }

            self.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self = self else { return }
                if let result = result {
                    self.notifyListeners(
                        "partialResults",
                        data: ["matches": [result.bestTranscription.formattedString]]
                    )
                    if result.isFinal {
                        self.teardown(deactivateSession: true)
                        self.notifyListeners("listeningState", data: ["status": "stopped"])
                    }
                    return
                }
                if error != nil {
                    self.teardown(deactivateSession: true)
                    self.notifyListeners("listeningState", data: ["status": "stopped"])
                }
            }

            self.audioEngine.prepare()
            do {
                try self.audioEngine.start()
            } catch {
                self.teardown(deactivateSession: true)
                call.reject("audio engine failed: \(error.localizedDescription)")
                return
            }
            self.notifyListeners("listeningState", data: ["status": "started"])
            // 認識はstop()まで続く。JS側はpartialResultsを購読する（iOSは即時resolve）
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.teardown(deactivateSession: true)
            call.resolve()
        }
    }

    private func teardown(deactivateSession: Bool) {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        request = nil
        task?.cancel()
        task = nil
        if deactivateSession {
            // 解放しないと読み上げ（speechSynthesis）が小音量のままになる
            try? AVAudioSession.sharedInstance().setActive(
                false, options: .notifyOthersOnDeactivation
            )
        }
    }
}
