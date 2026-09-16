import { describe, expect, it } from "vitest";
import { GUEST_TUTORIAL_STEPS, TUTORIAL_STEPS, trialStepIndex } from "./tutorial";

describe("trialStepIndex", () => {
  it("ゲスト版・フル版ともに『げんばを体験』の位置を返す", () => {
    expect(GUEST_TUTORIAL_STEPS[trialStepIndex(GUEST_TUTORIAL_STEPS, "genba")].trial).toBe("genba");
    expect(TUTORIAL_STEPS[trialStepIndex(TUTORIAL_STEPS, "genba")].trial).toBe("genba");
  });
  it("見つからなければ先頭", () => {
    expect(trialStepIndex([{ sprite: "egg", title: "a", body: "b" }], "genba")).toBe(0);
  });
});
