import { describe, expect, it } from "vitest";
import { chooseEngine, unavailableMessage } from "./recognition";

// エンジン判定は「音声入力が黙って消える」事故が起きた箇所なので、
// 分岐（特に none になる条件と、その理由）を固定しておく。

describe("chooseEngine", () => {
  it("アプリ版でプラグインがあればネイティブ認識を使う", () => {
    expect(
      chooseEngine({
        nativeApp: true,
        nativePlugin: true,
        web: false,
        recorder: true,
      })
    ).toEqual({ engine: "native" });
  });

  it("アプリ版でプラグインが無ければサーバーSTTに落ちる", () => {
    expect(
      chooseEngine({
        nativeApp: true,
        nativePlugin: false,
        web: false,
        recorder: true,
      })
    ).toEqual({ engine: "recorder" });
  });

  it("アプリ版でプラグインもサーバーSTTも無ければ「アプリが古い」と伝える", () => {
    expect(
      chooseEngine({
        nativeApp: true,
        nativePlugin: false,
        web: false,
        recorder: false,
      })
    ).toEqual({ engine: "none", reason: "app-outdated" });
  });

  it("アプリ版ではWeb Speech APIが見えていてもwebへは落ちない", () => {
    // WKWebViewは存在するのに動かないため（AGENTS.mdの決まりごと）
    expect(
      chooseEngine({
        nativeApp: true,
        nativePlugin: false,
        web: true,
        recorder: false,
      })
    ).toEqual({ engine: "none", reason: "app-outdated" });
  });

  it("ブラウザではWeb Speech APIを優先する", () => {
    expect(
      chooseEngine({
        nativeApp: false,
        nativePlugin: false,
        web: true,
        recorder: true,
      })
    ).toEqual({ engine: "web" });
  });

  it("未対応ブラウザはサーバーSTTに落ちる", () => {
    expect(
      chooseEngine({
        nativeApp: false,
        nativePlugin: false,
        web: false,
        recorder: true,
      })
    ).toEqual({ engine: "recorder" });
  });

  it("どれも使えないブラウザは理由付きで none", () => {
    expect(
      chooseEngine({
        nativeApp: false,
        nativePlugin: false,
        web: false,
        recorder: false,
      })
    ).toEqual({ engine: "none", reason: "browser" });
  });
});

describe("unavailableMessage", () => {
  it("理由ごとに次の一手がわかる文言を返す", () => {
    expect(unavailableMessage("app-outdated")).toContain("アプリを最新版に更新");
    expect(unavailableMessage("browser")).toContain("Chrome");
  });

  it("理由不明でも空にはしない", () => {
    expect(unavailableMessage()).not.toBe("");
  });
});
