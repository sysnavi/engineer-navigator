import { describe, expect, it } from "vitest";
import { depthOrder } from "@/lib/stack/scene";
import { HOME_STAGE } from "./stage";

describe("ホームの舞台の並べ方", () => {
  const hero = { id: "player", ...HOME_STAGE.player };

  it("主役は島の上に立ち、小道具とぶつからない", () => {
    // 島は半径 24。足元の影が島からはみ出さない所
    expect(Math.hypot(hero.x, hero.y) + (hero.shadow ?? 0)).toBeLessThanOrEqual(24);
    for (const p of HOME_STAGE.props)
      expect(Math.hypot(p.x - hero.x, p.y - hero.y), p.id).toBeGreaterThanOrEqual(8);
  });

  it("最初の向きでは、主役が一番手前に立つ", () => {
    const order = depthOrder([...HOME_STAGE.props, hero], 0, { pitch: HOME_STAGE.pitch });
    expect(order.at(-1)?.id).toBe("player");
  });

  it("主役も島と一緒に回り、うしろ向きでは小道具より奥になる", () => {
    const order = depthOrder([...HOME_STAGE.props, hero], 4, { pitch: HOME_STAGE.pitch });
    expect(order[0].id).toBe("player");
  });
});
