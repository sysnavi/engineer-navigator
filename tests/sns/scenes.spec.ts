import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, closeTutorialIfShown, type RoleKey } from "../tour/helpers";
import type { Page } from "@playwright/test";

// SNS 投稿用の「今日の1枚」を撮る（docs/sns-bot.md）。
// 言葉で説明せず、遊んでいる画面そのものを見せるのが狙いなので、
//  - スマホの画面そのまま（フルページではなくビューポート）を 3 倍解像度で撮る
//  - 1日1シーン。日付（JST）で SCENES を巡回する。SNS_SCENE=<id> で固定できる
//  - 撮った画像と本文を sns-results/post.json に書き、投稿は scripts/sns/post.ts に任せる
// シーンは「seed + prepare-showcase の状態で必ず成立する」操作だけにする（AIは呼ばない）。

export const OUT_DIR = "sns-results";

type Scene = {
  id: string;
  /** 画像に添える一言（短く。説明はしない） */
  caption: string;
  role?: RoleKey;
  run: (page: Page) => Promise<void>;
};

// 画面が落ち着くまで待つ（画像・フォント・入場アニメーション）
async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await closeTutorialIfShown(page);
}

export const SCENES: Scene[] = [
  {
    id: "quiz-play",
    caption: "腕試し中。",
    run: async (page) => {
      await open(page, "/quiz/play?topic=SQL");
      await expect(page.getByRole("heading", { name: "腕試し" })).toBeVisible();
      await settle(page, 500);
      await page.locator("button.w-full").first().click();
      await expect(page.getByText(/◎ 正解！|✕ 不正解/)).toBeVisible();
      await settle(page, 600);
    },
  },
  {
    id: "dungeon",
    caption: "きょうも地下へ。",
    run: async (page) => {
      await open(page, "/dungeon");
      await expect(page.getByRole("heading", { name: "ダンジョン" })).toBeVisible();
      await page.getByRole("button", { name: /潜る/ }).click();
      await expect(page.getByText(/地下\d+階/).first()).toBeVisible();
      // メッセージ送り→十字キーが出るまで（tests/tour/tour.spec.ts の dungeon と同じ手順）
      const forward = page.getByRole("button", { name: "進む" });
      const log = page.locator("div.max-h-\\[150px\\]");
      for (let i = 0; i < 8 && !(await forward.isVisible()); i++) {
        await log.click();
        await page.waitForTimeout(300);
      }
      const view = page.getByLabel("迷宮の一人称ビュー");
      await expect(view).toBeVisible();
      for (let i = 0; i < 3 && (await forward.isVisible()); i++) {
        await forward.click();
        await page.waitForTimeout(400);
      }
      // ステータス（階層・HP）と一人称ビューが画面に収まるようスクロール位置を合わせる
      // （ログの自動スクロールに引っ張られてビューが切れないように）
      await page.getByText(/地下\d+階/).first().evaluate((el) => {
        window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 40, behavior: "instant" });
      });
      await settle(page, 600);
    },
  },
  {
    id: "walk",
    caption: "うちの子とおさんぽ。",
    run: async (page) => {
      await open(page, "/walk");
      await expect(page.getByRole("heading", { name: /WALK/ })).toBeVisible();
      await settle(page, 2500);
    },
  },
  {
    id: "myhome",
    caption: "マイホーム、もようがえ中。",
    run: async (page) => {
      await open(page, "/home");
      await expect(page.getByRole("heading", { name: "マイホーム" })).toBeVisible();
      await settle(page, 1500);
    },
  },
  {
    id: "genba",
    caption: "きょうの案件。",
    run: async (page) => {
      await open(page, "/genba");
      await settle(page, 1200);
    },
  },
  {
    id: "shop",
    caption: "おかいもの。",
    run: async (page) => {
      await open(page, "/shop");
      await expect(page.getByRole("heading", { name: /SHOP/ })).toBeVisible();
      await settle(page, 1200);
    },
  },
  {
    id: "quiz-daily",
    caption: "今日の一問。",
    run: async (page) => {
      await open(page, "/quiz/daily");
      await expect(page.getByRole("heading", { name: "今日の一問" })).toBeVisible();
      await settle(page, 500);
      await page.locator("button.w-full").first().click();
      await expect(page.getByText(/◎ 正解！|✕ 不正解/)).toBeVisible();
      await settle(page, 600);
    },
  },
  {
    id: "home",
    caption: "きょうのステータス。",
    run: async (page) => {
      await open(page, "/");
      await settle(page, 1500);
    },
  },
];

/** 日付（JST）で巡回。SNS_SCENE があればそれ */
export function pickScene(now = new Date()): Scene {
  const forced = process.env.SNS_SCENE;
  if (forced) {
    const s = SCENES.find((x) => x.id === forced);
    if (!s) throw new Error(`SNS_SCENE が不明: ${forced}（${SCENES.map((x) => x.id).join(", ")}）`);
    return s;
  }
  const jst = new Date(now.getTime() + 9 * 3600_000);
  const day = Math.floor(jst.getTime() / 86400_000);
  return SCENES[day % SCENES.length];
}

// 本文の末尾（ハッシュタグ・URL）。添付画像の投稿に合わせて説明文は付けない
const TAIL = process.env.SNS_TAIL || "#engineer\nhttps://engineer-navigator.jp";

test("今日の1枚を撮る", async ({ page, loginAs }) => {
  const scene = pickScene();
  test.info().annotations.push({ type: "scene", description: scene.id });
  await loginAs(scene.role ?? "engineer");
  // 右下の TIPS トーストが写らないよう「今日はもう出した」状態にしておく（src/components/tips-toast.tsx）
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "en_tips",
        JSON.stringify({ day: new Date().toISOString().slice(0, 10), count: 99, seen: [] })
      );
    } catch {
      /* noop */
    }
  });
  await scene.run(page);

  mkdirSync(OUT_DIR, { recursive: true });
  const file = `${OUT_DIR}/${scene.id}.png`;
  await page.screenshot({ path: file, fullPage: false });
  await test.info().attach("sns-screenshot", { path: file, contentType: "image/png" });

  const text = `${scene.caption}\n\n${TAIL}`;
  writeFileSync(
    `${OUT_DIR}/post.json`,
    JSON.stringify({ scene: scene.id, caption: scene.caption, text, file, takenAt: new Date().toISOString() }, null, 2)
  );
});
