import { expect, test as base, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";

// 機能ツアーの共通部品（docs/bug-triage.md）。
//
// tour("<id>", "<タイトル>", fn) でテストを書く。id は
//  - Slack 報告の単位（desktop/mobile で両方落ちても1件）
//  - 修正ブランチ名 triage/<id>
//  - TOUR_ONLY=<id> での単体再実行
//  - 改善後キャプチャ tour-results/screens/<id>-<project>.png
// に使うので、英小文字・数字・ハイフンだけで安定した名前を付ける（画面名ベース）。

export const SCREEN_DIR = "tour-results/screens";

// seed のデモユーザー（prisma/seed.ts）。DEV_LOGIN_ENABLED=true のとき
// cookie "dev-user" のメールでそのユーザーとして入れる（src/lib/auth.ts）
export const USERS = {
  engineer: "engineer@sysnavi.co.jp",
  sales: "sales@sysnavi.co.jp",
  admin: "admin@sysnavi.co.jp",
} as const;
export type RoleKey = keyof typeof USERS;

type Fixtures = {
  /** 指定ロールのデモユーザーとしてログイン済みにする */
  loginAs: (role: RoleKey) => Promise<void>;
  /** 画面が「壊れていない」ことの共通確認（エラー境界・未捕捉例外・5xx） */
  assertHealthy: () => Promise<void>;
};

export const test = base.extend<Fixtures>({
  // 第2引数は Playwright の `use`。React フックと誤認する lint を避けるため provide と呼ぶ
  loginAs: async ({ context, baseURL }, provide) => {
    await provide(async (role) => {
      await context.addCookies([
        { name: "dev-user", value: USERS[role], url: baseURL! },
      ]);
    });
  },

  assertHealthy: async ({ page }, provide) => {
    const pageErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("response", (res) => {
      // 同一オリジンの 5xx だけ（外部やプリフェッチ失敗で騒がない）
      if (res.status() >= 500 && res.url().startsWith(page.url().split("/").slice(0, 3).join("/"))) {
        serverErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });
    await provide(async () => {
      // src/app/error.tsx / global-error.tsx の文言（アプリ内の全ルート共通）
      await expect(
        page.getByText("うまく読み込めませんでした"),
        "エラー境界（error.tsx）が表示されている"
      ).toHaveCount(0);
      await expect(
        page.getByText("読み込みに失敗しました"),
        "global-error.tsx が表示されている"
      ).toHaveCount(0);
      expect(serverErrors, "5xx レスポンスがあった").toEqual([]);
      expect(pageErrors, "未捕捉の例外が発生した").toEqual([]);
    });
  },
});

export { expect };

/** 初回訪問の「はじめかたガイド」モーダルが出ていたら閉じる（tests/e2e/smoke.spec.ts と同じ） */
export async function closeTutorialIfShown(page: Page) {
  const dialog = page.getByRole("dialog", { name: "はじめかたガイド" });
  try {
    await dialog.waitFor({ state: "visible", timeout: 3000 });
    await dialog.getByRole("button", { name: "閉じる" }).click();
    await dialog.waitFor({ state: "hidden" });
  } catch {
    // 表示されなければ（記録済みなら）何もしない
  }
}

/** 常時キャプチャ（成功時も）。修正後の「改善キャプチャ」はここで撮ったものを使う */
export async function captureScreen(page: Page, info: TestInfo) {
  const id = info.title.split(" | ")[0];
  mkdirSync(SCREEN_DIR, { recursive: true });
  const path = `${SCREEN_DIR}/${id}-${info.project.name}.png`;
  try {
    await page.screenshot({ path, fullPage: true });
    await info.attach("tour-screenshot", { path, contentType: "image/png" });
  } catch {
    // ページが既に閉じている等。失敗時は Playwright 側の screenshot: only-on-failure が残す
  }
}

/**
 * ツアー1本を定義する。TOUR_ONLY=<id> が指定されていれば他は skip。
 * - タイトルは "<id> | <説明>" の形式で、report.ts がこの形を前提に id を取り出す
 * - routes はこのツアーが訪問する画面（src/app の page.tsx のルート表記。例 "/mentor/[id]"）。
 *   tests/tour/coverage.test.ts が「全画面に対応するツアーがあるか」「存在しない画面を
 *   参照していないか」を npm run check で検査する。実行時は注釈としてレポートに残すだけ
 */
type TourBody = Parameters<typeof test>[2];

export function tour(id: string, title: string, routes: string[], fn: TourBody) {
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`tour id は英小文字・数字・ハイフンのみ: ${id}`);
  }
  const only = process.env.TOUR_ONLY;
  const t = only && only !== id ? test.skip : test;
  t(
    `${id} | ${title}`,
    { annotation: [{ type: "routes", description: routes.join(" ") || "(none)" }] },
    fn!
  );
}
