import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 機能ツアーの網羅ガード（docs/bug-triage.md）。npm run check で走る（DB・ブラウザ不要）。
//  1. src/app/**/page.tsx の全ルートに、それを訪問すると宣言したツアーがある
//     → 画面を足してツアーを足し忘れるとここで止まる
//  2. ツアーが宣言したルートはすべて実在する
//     → 画面を消した/動かしたのにツアーが古いままだとここで止まる
// 宣言は tests/tour/tour.spec.ts の tour("<id>", "<title>", ["<route>", ...], fn) の第3引数。

const APP_DIR = join(__dirname, "../../src/app");
const SPEC = join(__dirname, "tour.spec.ts");

function listRoutes(dir = APP_DIR, prefix = ""): string[] {
  const routes: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("_")) continue; // private folder
      const seg = name.startsWith("(") ? "" : `/${name}`; // route group はURLに出ない
      routes.push(...listRoutes(full, prefix + seg));
    } else if (name === "page.tsx") {
      routes.push(prefix || "/");
    }
  }
  return routes.sort();
}

/** spec ソースから tour() の宣言を抜き出す（id → routes） */
function declaredTours(src: string): Map<string, string[]> {
  const tours = new Map<string, string[]>();
  // 第3引数の配列。要素に "[id]" が含まれるので「引用符つき文字列の並び」として読む
  const re = /tour\(\s*"([a-z0-9-]+)",\s*"[^"]*",\s*\[((?:\s*"[^"]*"\s*,?)*)\]/g;
  for (const m of src.matchAll(re)) {
    const routes = [...m[2].matchAll(/"([^"]+)"/g)].map((r) => r[1]);
    tours.set(m[1], routes);
  }
  return tours;
}

describe("機能ツアーの網羅（tests/tour/tour.spec.ts）", () => {
  const routes = listRoutes();
  const tours = declaredTours(readFileSync(SPEC, "utf8"));
  const covered = new Set([...tours.values()].flat());

  it("ツアーの宣言を読めている", () => {
    expect(routes.length).toBeGreaterThan(10);
    expect(tours.size).toBeGreaterThan(10);
  });

  it.each(routes)("画面 %s を訪問するツアーがある", (route) => {
    expect(
      covered.has(route),
      `画面 ${route} を訪問するツアーがありません。tests/tour/tour.spec.ts に ` +
        `tour("<画面名>", "<説明>", ["${route}"], async ({ page, loginAs, assertHealthy }) => { ... }) を足すか、` +
        `既存ツアーの第3引数に "${route}" を加えてください`
    ).toBe(true);
  });

  it.each([...tours])("ツアー %s が参照する画面は実在する", (id, declared) => {
    const missing = declared.filter((r) => !routes.includes(r));
    expect(
      missing,
      `ツアー ${id} が存在しない画面 ${missing.join(", ")} を参照しています（画面が消えた/移動した）。ツアーを追従させてください`
    ).toEqual([]);
  });
});
