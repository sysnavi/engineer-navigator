import { describe, expect, it } from "vitest";
import { HOME_STAGE } from "./stage";

describe("ホームの舞台の並べ方", () => {
  it("小道具は主役より中心寄りに置く（どの向きに回しても主役の前に出ない）", () => {
    const hero = Math.hypot(HOME_STAGE.player.x, HOME_STAGE.player.y);
    for (const p of HOME_STAGE.props) expect(Math.hypot(p.x, p.y), p.id).toBeLessThan(hero);
  });
});
