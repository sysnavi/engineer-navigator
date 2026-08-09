import Capacitor

// アプリ内カスタムプラグインの登録口。Main.storyboard の customClass をこれに向けてある。
// （cap syncが生成するpackageClassListにはnpm配布のプラグインしか載らないため、
// アプリ内プラグインはここで明示的に登録する）
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpeechRecognitionPlugin())
    }
}
