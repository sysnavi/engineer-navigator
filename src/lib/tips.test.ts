import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ONBOARDING_TIPS, TIPS, type Tip } from "./tips";

// TIPS集の陳腐化ガード（npm run check で走る・DB不要）。
//  - href が指す画面は実在する（画面を消した/動かしたのにTIPSが古いままだと止まる）
//  - id は全体で一意（既読管理キーなので重複すると片方が永久に出ない）
//  - オンボーディングの順番は 1..N で欠番・重複がない
// 文言の正しさ（EXP値・日数）までは機械で見られないので、tips.ts の先頭コメントに従う。

const APP_DIR = join(__dirname, "../app");

function listRoutes(dir = APP_DIR, prefix = ""): string[] {
  const routes: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("_")) continue;
      const seg = name.startsWith("(") ? "" : `/${name}`;
      routes.push(...listRoutes(full, prefix + seg));
    } else if (name === "page.tsx") {
      routes.push(prefix || "/");
    }
  }
  return routes;
}

const ALL: Tip[] = [...ONBOARDING_TIPS, ...TIPS];
const withHref = ALL.filter((t): t is Tip & { href: string } => !!t.href);

describe("TIPS集（src/lib/tips.ts）", () => {
  const routes = listRoutes();

  it("読めている", () => {
    expect(routes.length).toBeGreaterThan(10);
    expect(TIPS.length).toBeGreaterThan(10);
  });

  it.each(withHref.map((t) => [t.id, t.href] as const))(
    "TIP %s のリンク先 %s は実在する画面",
    (_id, href) => {
      const path = href.split("?")[0];
      expect(
        routes.includes(path),
        `画面 ${path} が存在しません（消えた/移動した）。tips.ts の href を追従させてください`
      ).toBe(true);
    }
  );

  it("id は一意", () => {
    const ids = ALL.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("オンボーディングの順番は 1..N で連番", () => {
    const order = ONBOARDING_TIPS.map((t) => t.onboarding).sort(
      (a, b) => (a ?? 0) - (b ?? 0)
    );
    expect(order).toEqual(ONBOARDING_TIPS.map((_, i) => i + 1));
  });

  it("通常TIPSに onboarding は付けない（付けても巡回に効かないため）", () => {
    expect(TIPS.filter((t) => t.onboarding !== undefined)).toEqual([]);
  });
});
