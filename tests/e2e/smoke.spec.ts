import { expect, test, type Page } from "@playwright/test";

// 初回訪問時の「はじめかたガイド」モーダルが出ていたら閉じる。
// 閉じるとサーバーに記録され以降は自動表示されないが、テストの実行順に
// 依存しないよう対話系テストは毎回これを通す。
async function closeTutorialIfShown(page: Page) {
  const dialog = page.getByRole("dialog", { name: "はじめかたガイド" });
  try {
    await dialog.waitFor({ state: "visible", timeout: 3000 });
    await dialog.getByRole("button", { name: "閉じる" }).click();
    await dialog.waitFor({ state: "hidden" });
  } catch {
    // 表示されなければ（記録済みなら）何もしない
  }
}

// リリース前スモーク: 主要導線が生きていることを最短で確認する。
// DBは global-setup が毎回リセットするので、各テストはseed直後の状態を前提にできる。
// （デモユーザーは過去8週の週報あり・今週は未提出、seedクイズあり）

test("ホーム: デモユーザーでヒーローとプレイヤーカードが出る @mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /ぜんぶ経験値になる/ })
  ).toBeVisible();
  await expect(page.getByText("エンジニア デモ").first()).toBeVisible();
});

test("週報: 入力→自動保存→提出でリザルトが出る（AI解析FAILEDでも提出成功が仕様）", async ({
  page,
}) => {
  await page.goto("/report");
  await closeTutorialIfShown(page);
  await page.getByText("☀️ 好調").click();
  await page.getByText("ちょうどいい").click();
  await page
    .locator('textarea[name="didText"]')
    .fill("E2Eスモーク: APIの結合テストを完了した");

  // 自動保存の表示を待つ = フォームがハイドレート済みであることの確認を兼ねる
  await expect(page.getByText("SAVED ✓（自動保存）")).toBeVisible();

  await page.getByRole("button", { name: /ていしゅつ/ }).click();
  await expect(page.getByRole("dialog", { name: "提出リザルト" })).toBeVisible({
    timeout: 30_000,
  });
});

// 音声入力の導線が環境判定で「黙って消える」事故の回帰テスト。
// エンジンが使えない環境でもボタンは残り、押すと理由が出るのが仕様。
test("週報インタビュー: 音声入力ボタンが必ず出る @mobile", async ({ page }) => {
  await page.goto("/report?mode=interview");
  await closeTutorialIfShown(page);
  await expect(page.getByRole("button", { name: "音声入力" })).toBeVisible();
});

test("今日の一問: 選択肢を選ぶと正誤フィードバックが出る", async ({
  page,
}) => {
  await page.goto("/quiz/daily");
  await closeTutorialIfShown(page);
  await expect(
    page.getByRole("heading", { name: "今日の一問" })
  ).toBeVisible();

  // 四択の先頭（A）を選択 → サーバー採点の結果表示を待つ
  const firstChoice = page.locator("button.w-full").first();
  await expect(firstChoice).toBeVisible();
  await firstChoice.click();
  await expect(page.getByText(/◎ 正解！|✕ 不正解/)).toBeVisible();
});

test("スキルマップ: ページが表示される @mobile", async ({ page }) => {
  await page.goto("/skills");
  await expect(
    page.getByRole("heading", { name: "スキルマップ" })
  ).toBeVisible();
});

test("ウェルカム: 公開ページが表示される @mobile", async ({ page }) => {
  await page.goto("/welcome");
  await expect(
    page.getByRole("heading", { name: /ぜんぶ経験値になる/ })
  ).toBeVisible();
});

// ダンジョン（一人称探索＋問いに答えて倒す）: 潜行が始まり、迷路を歩けることを確認する。
// 最初の一歩の先は抽選（初回は入口の隣が宝箱で確定）なので、数手進めたあとは
// 「十字キー か 問いのパス か つぎへ か とじる」のどれかが見えればよい、という緩い確認に留める。
test("ダンジョン: 潜行が始まり、迷路を歩くと何かが起きる", async ({ page }) => {
  await page.goto("/dungeon");
  await closeTutorialIfShown(page);
  await page.getByRole("button", { name: /潜る/ }).click();
  await expect(page.getByText(/地下\d+階/).first()).toBeVisible();

  // メッセージはクリックで送る。十字キー（進む）が出るまで送り続ける
  const forward = page.getByRole("button", { name: "進む" });
  const log = page.locator("div.max-h-\\[150px\\]");
  for (let i = 0; i < 8 && !(await forward.isVisible()); i++) {
    await log.click();
    await page.waitForTimeout(300);
  }
  await expect(forward).toBeVisible();
  await expect(page.getByLabel("迷宮の一人称ビュー")).toBeVisible();

  // 壁に当たっても進めるよう、向きを変えながら数手歩く
  const anyNext = page
    .getByRole("button", { name: /パス/ })
    .or(page.getByRole("button", { name: "▶ つぎへ" }))
    .or(page.getByRole("button", { name: "とじる" }))
    .or(forward);
  for (let i = 0; i < 6; i++) {
    if (!(await forward.isVisible())) break;
    await forward.click();
    await page.waitForTimeout(400);
    if (await forward.isVisible()) await page.getByRole("button", { name: "右を向く" }).click();
    else break;
  }
  for (let i = 0; i < 8 && !(await anyNext.first().isVisible()); i++) {
    await log.click();
    await page.waitForTimeout(300);
  }
  await expect(anyNext.first()).toBeVisible();
});
