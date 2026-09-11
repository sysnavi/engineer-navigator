import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, closeTutorialIfShown } from "../tour/helpers";
import type { BrowserContext, Locator, Page } from "@playwright/test";
import { SEED_QUIZZES } from "../../prisma/seed-quizzes";
import { PET_SPECIES } from "../../src/lib/pets/species";
import { BIOME_JA } from "../../src/lib/walk/world";
import {
  SNS_SCENE_IDS,
  WALK_HOURS,
  WEATHER_CODE,
  WEATHER_JA,
  describePlan,
  jstDateKey,
  planDay,
  rngFor,
  type SnsPlan,
  type SnsSceneId,
} from "../../src/lib/sns/plan";

// SNS 投稿用の「今日の1枚」を撮る（docs/sns-bot.md）。
// 言葉で説明せず、遊んでいる画面そのものを見せるのが狙いなので、
//  - スマホの画面そのまま（フルページではなくビューポート）を 3 倍解像度で撮る
//  - 1日1シーン。シーンも中身も src/lib/sns/plan.ts の planDay(seed) で日替わり
//    （seed 既定 = JST の日付。SNS_SEED で任意、SNS_SCENE でシーン固定）
//  - DB に置くもの（仲間・家具…）は scripts/sns/prepare-showcase.ts が同じ planDay で用意済み。
//    ここでは画面側で決まるもの（天気・時間帯・行き先・どの選択肢を押すか…）を再現する
//  - 撮った画像と本文を sns-results/post.json に書き、投稿は scripts/sns/post.ts に任せる
// シーンは「seed + prepare-showcase の状態で必ず成立する」操作だけにする（AIは呼ばない）。

export const OUT_DIR = "sns-results";

const SEED = process.env.SNS_SEED || jstDateKey();
const PLAN = planDay(SEED, process.env.SNS_SCENE);
const rng = (stream: string) => rngFor(SEED, `spec:${stream}`);

type Ctx = { page: Page; context: BrowserContext; plan: SnsPlan };
type Scene = {
  /** 画像に添える一言の候補（短く。説明はしない）。日替わりで1つ選ぶ */
  captions: (plan: SnsPlan) => string[];
  run: (c: Ctx) => Promise<void>;
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

/** 要素が画面の上のほうに来るようスクロールする（固定ヘッダぶんの余白つき） */
async function scrollToTop(target: Locator, margin = 72) {
  await target.first().evaluate((el, m) => {
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - m, behavior: "instant" });
  }, margin);
}

/** 四択の選択肢のどれかを押す（日替わり。正解の日も不正解の日もある） */
async function answerSomething(page: Page, stream: string) {
  const choices = page.locator("button.w-full");
  await expect(choices.first()).toBeVisible();
  const n = await choices.count();
  await choices.nth(rng(stream).int(0, Math.max(0, Math.min(n, 4) - 1))).click();
  await expect(page.getByText(/◎ 正解！|✕ 不正解/)).toBeVisible();
}

// 3問以上ある topic（腕試しで「10問セット」の見た目が成立する）
const QUIZ_TOPICS = [...new Set(SEED_QUIZZES.map((q) => q.topic))].filter(
  (t) => SEED_QUIZZES.filter((q) => q.topic === t).length >= 3
);

const SCENES: Record<SnsSceneId, Scene> = {
  "quiz-play": {
    captions: () => ["腕試し中。", "スキマ時間に腕試し。", "これ、わかる？"],
    run: async ({ page }) => {
      const topic = rng("quiz:topic").pick(QUIZ_TOPICS);
      await open(page, `/quiz/play?topic=${encodeURIComponent(topic)}`);
      await expect(page.getByRole("heading", { name: "腕試し" })).toBeVisible();
      await settle(page, 500);
      await answerSomething(page, "quiz:choice");
      await settle(page, 600);
    },
  },

  walk: {
    captions: (p) => [
      `${BIOME_JA[p.walk.biome]}まで おさんぽ。`,
      "うちの子とおさんぽ。",
      `${WEATHER_JA[p.walk.weather]}の日の おさんぽ。`,
    ],
    run: async ({ page, context, plan }) => {
      // 時間帯: ブラウザの時計だけを今日のその時刻に止める（タイマーは動くのでアニメは止まらない）
      const now = new Date();
      const jst = new Date(now.getTime() + 9 * 3600_000);
      const at = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), WALK_HOURS[plan.walk.time] - 9, rng("walk:min").int(0, 50));
      await page.clock.setFixedTime(new Date(at));
      // 天気: 位置情報を許可し、Open-Meteo の応答をきょうの天気に差し替える（外部には出ない）
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({ latitude: 35.68, longitude: 139.76 });
      await page.route("https://api.open-meteo.com/**", (route) =>
        route.fulfill({
          json: { current: { weather_code: WEATHER_CODE[plan.walk.weather], temperature_2m: rng("walk:temp").int(4, 31) } },
        })
      );
      await open(page, `/walk?biome=${plan.walk.biome}`);
      await expect(page.getByRole("heading", { name: /WALK/ })).toBeVisible();
      // 仲間が歩いてひとこと話すまで（つぶやきは数秒おき）。何秒で撮るかも日替わり
      await settle(page, rng("walk:wait").int(2500, 6000));
    },
  },

  dungeon: {
    captions: () => ["きょうも地下へ。", "ダンジョン、潜行中。", "この先に なにかいる。"],
    run: async ({ page }) => {
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
      // 何歩あるくか・どこで曲がるかは日替わり。途中でイベント（戦闘・宝箱）が起きたらそこで撮る
      const r = rng("dungeon:steps");
      const steps = r.int(2, 9);
      for (let i = 0; i < steps; i++) {
        if (!(await forward.isVisible())) break;
        if (r.chance(0.3)) await page.getByRole("button", { name: r.chance(0.5) ? "右を向く" : "左を向く" }).click();
        else await forward.click();
        await page.waitForTimeout(400);
      }
      // イベントが起きていれば、文章を少し送った状態で撮る
      if (!(await forward.isVisible())) {
        for (let i = 0; i < r.int(0, 2); i++) {
          await log.click().catch(() => {});
          await page.waitForTimeout(500);
        }
      }
      // ステータス（階層・HP）から十字キーまでが1画面に収まる位置へ
      await scrollToTop(view, 150);
      await settle(page, 700);
    },
  },

  visitor: {
    captions: (p) => {
      const name = PET_SPECIES.find((s) => s.id === p.visitorSpeciesId)?.name ?? "だれか";
      return [`${name}が あそびにきた。`, "マイホームに おきゃくさん。", `きょうのおきゃくさんは ${name}。`];
    },
    run: async ({ page, plan }) => {
      const species = PET_SPECIES.find((s) => s.id === plan.visitorSpeciesId);
      if (!species) throw new Error("visitor シーンなのに来訪キャラがいない（prepare-showcase を確認）");
      await open(page, "/home");
      await expect(page.getByRole("heading", { name: "マイホーム" })).toBeVisible();
      const knock = page.getByRole("button", { name: `${species.name}が遊びに来ています。話しかける` });
      await expect(knock).toBeVisible();
      // 話しかけて会話ウィンドウを出す（隅で待っている姿は部屋に被って絵にならない）
      await knock.click();
      await expect(page.getByText(`VISITOR.sys — ${species.name}`)).toBeVisible();
      await settle(page, 1200);
    },
  },

  myhome: {
    captions: () => ["マイホーム、もようがえ中。", "戦利品をかざる。", "うちの部屋。"],
    run: async ({ page }) => {
      await open(page, "/home");
      await expect(page.getByRole("heading", { name: "マイホーム" })).toBeVisible();
      await settle(page, 800);
      // 机（DESKTOP.sav）から撮る日と、家具の並ぶリビング（LIVING.sav）から撮る日
      if (rng("myhome:living").chance(0.5)) {
        await scrollToTop(page.getByText("LIVING ROOM"), 150).catch(() => {});
      }
      await settle(page, 1200);
    },
  },

  genba: {
    captions: () => ["きょうの案件。", "どの現場にしよう。", "案件、入りました。"],
    run: async ({ page }) => {
      await open(page, "/genba");
      await settle(page, 1200);
    },
  },

  "quiz-daily": {
    captions: () => ["今日の一問。", "1日1問だけ。", "きょうの一問、解けた？"],
    run: async ({ page }) => {
      await open(page, "/quiz/daily");
      await expect(page.getByRole("heading", { name: "今日の一問" })).toBeVisible();
      await settle(page, 500);
      await answerSomething(page, "daily:choice");
      await settle(page, 600);
    },
  },

  shop: {
    captions: () => ["おかいもの。", "ENで家具をそろえる。", "今週の入荷。"],
    run: async ({ page }) => {
      await open(page, "/shop");
      await expect(page.getByRole("heading", { name: /SHOP/ })).toBeVisible();
      // 先頭（所持ENと最初の棚）を撮る。中身は週替わり入荷・買った家具・所持ENで日によって変わる
      await settle(page, 1500);
    },
  },

  home: {
    captions: () => ["きょうのステータス。", "今日もログイン。", "コツコツ育つ。"],
    run: async ({ page }) => {
      await open(page, "/");
      await settle(page, 1500);
    },
  },
};

// 本文の末尾（ハッシュタグ・URL）。添付画像の投稿に合わせて説明文は付けない
const TAIL = process.env.SNS_TAIL || "#engineer\nhttps://engineer-navigator.jp";

test("今日の1枚を撮る", async ({ page, context, loginAs }) => {
  // 全シーンに撮り方があること（plan.ts にシーンを足して、ここを忘れたら気づけるように）
  for (const id of SNS_SCENE_IDS) expect(SCENES[id], `scenes.spec.ts に ${id} の撮り方がない`).toBeTruthy();

  const scene = SCENES[PLAN.scene];
  test.info().annotations.push({ type: "scene", description: `${PLAN.scene} (seed=${SEED})` });
  await loginAs("engineer");
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
  await scene.run({ page, context, plan: PLAN });

  mkdirSync(OUT_DIR, { recursive: true });
  const file = `${OUT_DIR}/${PLAN.scene}.png`;
  await page.screenshot({ path: file, fullPage: false });
  await test.info().attach("sns-screenshot", { path: file, contentType: "image/png" });

  const caption = rng("caption").pick(scene.captions(PLAN));
  const text = `${caption}\n\n${TAIL}`;
  writeFileSync(
    `${OUT_DIR}/post.json`,
    JSON.stringify(
      { scene: PLAN.scene, seed: SEED, caption, text, file, details: describePlan(PLAN), takenAt: new Date().toISOString() },
      null,
      2
    )
  );
});
