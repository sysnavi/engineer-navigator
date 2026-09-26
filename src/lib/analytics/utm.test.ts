import { describe, it, expect } from "vitest";
import { pickUtm } from "./utm";

describe("pickUtm", () => {
  it("utm_* だけを残し、それ以外は落とす", () => {
    const out = pickUtm(new URLSearchParams("utm_source=x&utm_medium=social&guest=needsaccount&q=1"));
    expect(out.toString()).toBe("utm_source=x&utm_medium=social");
  });
  it("空値は残さない・何も無ければ空", () => {
    expect(pickUtm(new URLSearchParams("utm_source=")).toString()).toBe("");
    expect(pickUtm(new URLSearchParams("")).toString()).toBe("");
  });
});
