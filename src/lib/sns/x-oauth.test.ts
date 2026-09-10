import { describe, expect, it } from "vitest";
import { buildAuthorizationHeader, rfc3986, signatureBaseString, hmacSha1Signature } from "./x-oauth";

// X Developer Docs「Creating a signature」の公式サンプル値。
// 署名アルゴリズムの回帰テスト（キーは公開されたダミー）。
const CREDS = {
  consumerKey: "xvz1evFS4wEEPTGEFPHBog",
  consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
  accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
  accessSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
};
const NONCE = "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg";
const TS = "1318622958";
const URL = "https://api.twitter.com/1.1/statuses/update.json";
const PARAMS = {
  include_entities: "true",
  status: "Hello Ladies + Gentlemen, a signed OAuth request!",
};

describe("x-oauth", () => {
  it("rfc3986 は !'()* もエンコードする", () => {
    expect(rfc3986("Ladies + Gentlemen")).toBe("Ladies%20%2B%20Gentlemen");
    expect(rfc3986("a!b'c(d)e*f")).toBe("a%21b%27c%28d%29e%2Af");
  });

  it("署名ベース文字列が公式サンプルと一致する", () => {
    const base = signatureBaseString("post", URL, {
      ...PARAMS,
      oauth_consumer_key: CREDS.consumerKey,
      oauth_nonce: NONCE,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: TS,
      oauth_token: CREDS.accessToken,
      oauth_version: "1.0",
    });
    expect(base).toBe(
      "POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Gentlemen%252C%2520a%2520signed%2520OAuth%2520request%2521"
    );
    expect(hmacSha1Signature(base, CREDS.consumerSecret, CREDS.accessSecret)).toBe(
      "hCtSmYh+iHYCEqBWrE7C7hYmtUk="
    );
  });

  it("Authorization ヘッダに署名と全 oauth_* が入る", () => {
    const h = buildAuthorizationHeader(CREDS, "POST", URL, PARAMS, { nonce: NONCE, timestamp: TS });
    expect(h.startsWith("OAuth ")).toBe(true);
    expect(h).toContain('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"');
    expect(h).toContain(`oauth_nonce="${NONCE}"`);
    expect(h).toContain('oauth_version="1.0"');
    // リクエストパラメータ自体はヘッダに含めない
    expect(h).not.toContain("status=");
  });
});
