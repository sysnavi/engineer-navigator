import { describe, expect, it } from "vitest";
import { parseVolume, DUNGEON_BGM_DEFAULT_VOL } from "./bgm";

describe("parseVolume", () => {
  it("0..1 に収める", () => {
    expect(parseVolume("0.5")).toBe(0.5);
    expect(parseVolume("2")).toBe(1);
    expect(parseVolume("-1")).toBe(0);
  });
  it("壊れた値は null", () => {
    expect(parseVolume(null)).toBeNull();
    expect(parseVolume("abc")).toBeNull();
  });
  it("初期音量は効果音より控えめ", () => {
    expect(DUNGEON_BGM_DEFAULT_VOL).toBeLessThanOrEqual(0.5);
  });
});
