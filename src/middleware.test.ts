import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, middleware } from "./middleware";

// 未ログインのゲート（middleware）の振り分け。
// - public/ の絵と音は、未ログインでもゲートを通らずに届く（本番で .vox が /welcome に飛ばされていた）
// - 画面・API の守りは弱めない（ログインが要る画面は、どれも今までどおりゲートを通る）

const ROOT = process.cwd();
const gated = (path: string) =>
  unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` });

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const toUrl = (p: string, base: string) => "/" + relative(base, p).split(sep).join("/");

describe("public/ の静的ファイル", () => {
  // README などの説明書きは画面で使わないので対象外
  const assets = walk(join(ROOT, "public"))
    .filter((p) => !p.endsWith(".md"))
    .map((p) => toUrl(p, join(ROOT, "public")));

  it("public/ に絵と音がある（テストの前提）", () => {
    expect(assets.some((u) => u.endsWith(".vox"))).toBe(true);
    expect(assets.some((u) => u.endsWith(".png"))).toBe(true);
  });

  it("どのファイルも未ログインのゲートを通らない（フォルダや拡張子を足したら matcher に足す）", () => {
    expect(assets.filter(gated)).toEqual([]);
  });

  it("3D の原本は未ログインでも届く", () => {
    for (const u of [
      "/stack/stage/house.vox",
      "/stack/avatar/egg.vox",
      "/stack/npc/chicken.vox",
      "/aliens/vox/alien-01.vox",
      "/aliens/alien-01-normal.png",
      "/pets/kiwi-slime/normal.png",
      "/dungeon/cat-kb.png",
      "/bgm/walk-001.mp3",
    ]) {
      expect(gated(u), u).toBe(false);
    }
  });
});

describe("画面の守りは弱めない", () => {
  // 未ログインでも見られる画面（ページ側で公開分だけ返す）
  const PUBLIC = ["/welcome", "/contact", "/u/", "/q/", "/join/"];

  // src/app の画面を全部拾い、動的な部分は普通の値と拡張子つきの値の両方で試す
  const pages = walk(join(ROOT, "src", "app"))
    .filter((p) => p.endsWith(`${sep}page.tsx`))
    .map((p) => toUrl(p, join(ROOT, "src", "app")).replace(/\/?page\.tsx$/, "") || "/");

  it("src/app の画面が拾えている（テストの前提）", () => {
    expect(pages).toContain("/");
    expect(pages).toContain("/mypage");
    expect(pages).toContain("/roleplay/[id]");
  });

  it("公開の画面以外は、どれもゲートを通る", () => {
    const missed = pages
      .filter((p) => !PUBLIC.some((pub) => p === pub || p.startsWith(pub)))
      .flatMap((p) => ["x", "x.png", "x.vox", "x.svg"].map((v) => p.replace(/\[[^\]]+\]/g, v)))
      .filter((u) => !gated(u));
    expect(missed).toEqual([]);
  });

  it("public/ と同じ名前の画面や、それらしい名前でも、ファイル以外はゲートを通る", () => {
    for (const u of [
      "/dungeon",
      "/dungeon/x",
      "/pets",
      "/stack/avatar/egg.vox.html",
      "/aliens/vox/alien-01.vox/x",
      "/roleplay/x.png",
      "/plan/a.vox",
      "/api/../mypage",
    ]) {
      expect(gated(u), u).toBe(true);
    }
  });

  it("未ログインで画面を開くと /welcome に送られる", () => {
    const res = middleware(new NextRequest("http://localhost/mypage"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/welcome");
  });
});
