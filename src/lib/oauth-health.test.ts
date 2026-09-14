import { describe, expect, it } from "vitest";
import {
  checkEnabled,
  checkEvents,
  classifyAuthorize,
  classifyToken,
  formatHealthSlack,
  googleAuthError,
  isHealthy,
  summarizeEvents,
} from "./oauth-health";

// 実応答（2026-09 に curl で採取）
const GOOGLE_OK_LOCATION =
  "https://accounts.google.com/v3/signin/identifier?client_id=x&prompt=select_account&flowName=GeneralOAuthFlow";
const GOOGLE_INVALID_CLIENT_LOCATION =
  "https://accounts.google.com/signin/oauth/error?authError=Cg5pbnZhbGlkX2NsaWVudBIfVGhlIE9BdXRoIGNsaWVudCB3YXMgbm90IGZvdW5kLiCRAw&flowName=GeneralOAuthFlow&client_id=fake";
const redirectMismatchError = Buffer.concat([
  Buffer.from([0x0a, "redirect_uri_mismatch".length]),
  Buffer.from("redirect_uri_mismatch"),
  Buffer.from([0x12, 0x05]),
  Buffer.from("hello"),
]).toString("base64url");

const res = (status: number, body = "", location: string | null = null) => ({ status, body, location });

describe("googleAuthError", () => {
  it("エラー画面の authError から理由コードを取り出す", () => {
    expect(googleAuthError(GOOGLE_INVALID_CLIENT_LOCATION)).toBe("invalid_client");
    expect(
      googleAuthError(`https://accounts.google.com/signin/oauth/error?authError=${redirectMismatchError}`)
    ).toBe("redirect_uri_mismatch");
  });

  it("正常な遷移先なら null", () => {
    expect(googleAuthError(GOOGLE_OK_LOCATION)).toBeNull();
    expect(googleAuthError("not a url")).toBeNull();
  });
});

describe("classifyAuthorize", () => {
  it("Google: ログイン画面への302は ok、エラー画面への302は fail", () => {
    expect(classifyAuthorize("google", res(302, "", GOOGLE_OK_LOCATION)).status).toBe("ok");
    const bad = classifyAuthorize("google", res(302, "", GOOGLE_INVALID_CLIENT_LOCATION));
    expect(bad.status).toBe("fail");
    expect(bad.message).toContain("client_id");
  });

  it("Google: リダイレクトでなければ warn", () => {
    expect(classifyAuthorize("google", res(500)).status).toBe("warn");
  });

  it("GitHub は判定不能なので常に ok（token 側で見る）", () => {
    expect(classifyAuthorize("github", res(302, "", "https://github.com/login")).status).toBe("ok");
  });
});

describe("classifyToken", () => {
  it("Google: invalid_grant（code不正）は正常、invalid_client は Secret 不良", () => {
    expect(classifyToken("google", res(400, '{"error":"invalid_grant"}')).status).toBe("ok");
    expect(classifyToken("google", res(401, '{"error":"invalid_client"}')).status).toBe("fail");
  });

  it("GitHub: bad_verification_code は正常、資格情報・redirect不一致・404 は fail", () => {
    expect(classifyToken("github", res(200, '{"error":"bad_verification_code"}')).status).toBe("ok");
    expect(classifyToken("github", res(200, '{"error":"incorrect_client_credentials"}')).status).toBe("fail");
    expect(classifyToken("github", res(200, '{"error":"redirect_uri_mismatch"}')).status).toBe("fail");
    expect(classifyToken("github", res(404, '{"error":"Not Found"}')).status).toBe("fail");
  });

  it("想定外の応答は warn（JSONでない本文も）", () => {
    expect(classifyToken("google", res(503, "<html>")).status).toBe("warn");
    expect(classifyToken("github", res(200, '{"access_token":"x"}')).status).toBe("warn");
  });
});

describe("checkEnabled", () => {
  it("env が無いプロバイダは fail", () => {
    expect(checkEnabled("google", ["google", "github"]).status).toBe("ok");
    expect(checkEnabled("github", ["google"]).status).toBe("fail");
  });
});

describe("summarizeEvents / checkEvents", () => {
  const start = (provider: string) => ({ name: "oauth_start", props: { provider } });
  const result = (provider: string, outcome: string, reason?: string) => ({
    name: "oauth_result",
    props: { provider, outcome, ...(reason ? { reason } : {}) },
  });

  it("キャンセル（denied）は失敗に数えず、成功は new/login/linked/promoted", () => {
    const s = summarizeEvents([
      start("google"),
      result("google", "new"),
      result("google", "promoted"),
      result("google", "already-linked"),
      result("github", "fail", "denied"),
      { name: "oauth_result", props: null },
    ]);
    expect(s.successes).toEqual({ google: 2, github: 0 });
    expect(s.fails).toEqual({});
  });

  it("開始3件以上で成功0件のプロバイダは fail", () => {
    const s = summarizeEvents([start("github"), start("github"), start("github"), start("google"), result("google", "login")]);
    const checks = checkEvents(s);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ provider: "github", status: "fail" });
  });

  it("開始2件・成功0件は少なすぎて判定しない", () => {
    expect(checkEvents(summarizeEvents([start("google"), start("google")]))).toEqual([]);
  });

  it("exchange は1件で fail、state は3件から warn", () => {
    const one = checkEvents(summarizeEvents([result("google", "fail", "exchange"), result("google", "fail", "state")]));
    expect(one).toHaveLength(1);
    expect(one[0].status).toBe("fail");

    const states = [1, 2, 3].map(() => result("google", "fail", "state"));
    expect(checkEvents(summarizeEvents(states))[0].status).toBe("warn");
  });
});

describe("formatHealthSlack", () => {
  const summary = summarizeEvents([]);

  it("全部 ok なら異常なしの1行", () => {
    const checks = [checkEnabled("google", ["google"])];
    expect(isHealthy(checks)).toBe(true);
    expect(formatHealthSlack({ checks, summary, appUrl: "https://x" })).toContain("異常なし");
  });

  it("異常があれば ok 以外だけを並べ、分析画面へのリンクを付ける", () => {
    const checks = [checkEnabled("google", ["google"]), checkEnabled("github", ["google"])];
    const text = formatHealthSlack({ checks, summary, appUrl: "https://x/" });
    expect(isHealthy(checks)).toBe(false);
    expect(text).toContain("🟥 GitHub [enabled]");
    expect(text).not.toContain("Google [enabled]");
    expect(text).toContain("https://x/admin/analytics");
  });
});
