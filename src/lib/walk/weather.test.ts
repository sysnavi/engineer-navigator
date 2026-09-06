import { describe, expect, it } from "vitest";
import { weatherFailMessage, type WeatherFailReason } from "./weather";

describe("weatherFailMessage", () => {
  it("理由ごとに違う一言を返し、未知の理由でも空にならない", () => {
    const reasons: WeatherFailReason[] = [
      "unsupported",
      "denied",
      "unavailable",
      "timeout",
      "network",
    ];
    const msgs = reasons.map((r) => weatherFailMessage(r));
    expect(new Set(msgs).size).toBe(reasons.length);
    for (const m of msgs) expect(m.length).toBeGreaterThan(0);
    expect(weatherFailMessage(undefined)).toBe(weatherFailMessage("unavailable"));
  });

  it("許可なしのときは設定で許可する案内になる", () => {
    expect(weatherFailMessage("denied")).toContain("許可");
  });
});
