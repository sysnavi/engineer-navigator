import {
  test,
  expect,
  tour,
  closeTutorialIfShown,
  captureScreen,
} from "./helpers";

// 機能ツアー（docs/bug-triage.md）: テスト用アカウント（seedのデモユーザー）で全画面を一周する。
//
// 見ているのは「壊れていない」こと — エラー境界・未捕捉例外・5xx・見出しの欠落・主要導線の断絶。
// 見た目の崩れや文言の違和感は対象外（人の目で拾う）。
//
// 決まりごと:
//  - 実 Claude API は呼ばない（ANTHROPIC_API_KEY 空で起動）。AI を叩く操作は
//    「失敗しても画面が壊れない」ことを確認する形にする（AGENTS.md の仕様）
//  - 1本 = 1画面（または1導線）。id は画面名ベースで安定させる（Slack報告・ブランチ名になる）
//  - 第3引数は「そのツアーが訪問する画面」（src/app の page.tsx のルート表記）。
//    tests/tour/coverage.test.ts が全画面の網羅と、消えた画面の参照を npm run check で検査する
//  - DB は毎回リセット（seed直後）。テスト間で状態を引き継がない前提で書く
//  - 新しい画面を足したらここに1本足す

test.afterEach(async ({ page }, info) => {
  await captureScreen(page, info);
});

// 各ツアーの入口: ログイン → 画面へ → チュートリアルを閉じる
async function open(
  page: Parameters<typeof closeTutorialIfShown>[0],
  path: string
) {
  await page.goto(path);
  await closeTutorialIfShown(page);
}

// ---------------------------------------------------------------------------
// エンジニア（メイン導線）
// ---------------------------------------------------------------------------

tour("home", "ホーム: ヒーローとプレイヤーカード・初回チュートリアル @mobile", ["/"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await page.goto("/");
  // 初回はチュートリアルが出る（DBリセット直後なので必ず未完了）。閉じられることまで確認
  const dialog = page.getByRole("dialog", { name: "はじめかたガイド" });
  if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dialog.getByRole("button", { name: "閉じる" }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByRole("heading", { name: /ぜんぶ経験値になる/ })).toBeVisible();
  await expect(page.getByText("エンジニア デモ").first()).toBeVisible();
  await assertHealthy();
});

tour("welcome", "ウェルカム: 公開ページが表示される @mobile", ["/welcome"], async ({ page, assertHealthy }) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: /ぜんぶ経験値になる/ })).toBeVisible();
  await assertHealthy();
});

tour("contact", "お問い合わせ: 公開ページ・カテゴリ選択", ["/contact"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/contact");
  await expect(page.getByRole("heading", { name: "お問い合わせ" })).toBeVisible();
  const chip = page.getByRole("button", { name: "不具合の報告" });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await assertHealthy();
});

tour("report", "週報: 入力→自動保存→提出→リザルト（AI解析FAILEDでも提出成功が仕様） @mobile", ["/report"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/report");
  await expect(page.getByRole("heading", { name: "今週の週報" })).toBeVisible();
  await page.getByText("☀️ 好調").click();
  await page.getByText("ちょうどいい").click();
  await page.locator('textarea[name="didText"]').fill("機能ツアー: 日次トリアージの疎通確認をした");
  await expect(page.getByText("SAVED ✓（自動保存）")).toBeVisible();
  await page.getByRole("button", { name: /ていしゅつ/ }).click();
  await expect(page.getByRole("dialog", { name: "提出リザルト" })).toBeVisible({ timeout: 30_000 });
  await assertHealthy();
});

tour("report-interview", "週報インタビュー: 音声入力ボタンと最初の問いかけが出る @mobile", ["/report"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/report?mode=interview");
  await expect(page.getByRole("heading", { name: "今週の週報" })).toBeVisible();
  await expect(page.getByRole("button", { name: "音声入力" })).toBeVisible();
  await expect(page.getByText(/今週の週報、話すだけでまとめるよ/)).toBeVisible();
  await assertHealthy();
});

tour("skills", "スキルマップ: 表示される（seedのエンジニアは未登録の空状態） @mobile", ["/skills"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/skills");
  await expect(page.getByRole("heading", { name: "スキルマップ" })).toBeVisible();
  await assertHealthy();
});

tour("resume", "経歴書: 表示とPDF出力リンク", ["/resume"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/resume");
  await expect(page.getByRole("heading", { name: "経歴書" })).toBeVisible();
  await expect(page.getByRole("link", { name: /PDF出力/ })).toHaveAttribute("href", "/api/resume/pdf");
  // PDF生成APIそのものが生きているか（ダウンロードせずステータスだけ）
  const res = await page.request.get("/api/resume/pdf");
  expect(res.status(), "PDF出力APIのステータス").toBeLessThan(500);
  await assertHealthy();
});

tour("mentor", "AIメンター: 一覧と「詰まりから提案」（材料なしの案内が出る）", ["/mentor"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/mentor");
  await expect(page.getByRole("heading", { name: "AIメンター" })).toBeVisible();
  await page.getByRole("button", { name: /週報の詰まりから提案をもらう/ }).click();
  await expect(page.getByText(/詰まりごと.*まだありません/)).toBeVisible();
  await assertHealthy();
});

tour("mentor-session", "AIメンター: 相談開始→セッション画面（AI応答は失敗表示になるが画面は壊れない）", ["/mentor", "/mentor/[id]"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/mentor");
  await page.locator('input[name="topic"]').fill("機能ツアー: IAMの考え方");
  await page.locator('textarea[name="firstMessage"], input[name="firstMessage"]').fill("IAMロールとユーザーの使い分けを知りたい");
  await page.getByRole("button", { name: /そうだんを始める/ }).click();
  await expect(page).toHaveURL(/\/mentor\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "機能ツアー: IAMの考え方" })).toBeVisible();
  // キー未設定のため応答は失敗する。失敗が「画面内に表示される」のが仕様（黙って消えない）
  await expect(page.getByText(/メンターの応答に失敗しました/)).toBeVisible({ timeout: 30_000 });
  await assertHealthy();
});

tour("plan", "資格学習プラン: 一覧→作成→生成中/失敗の表示（AI生成は非同期・失敗しても画面は壊れない）", ["/plan", "/plan/[id]"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/plan");
  await expect(page.getByRole("heading", { name: "資格学習プラン" })).toBeVisible();
  await page.locator('input[name="certification"]').fill("AWS SAA");
  const exam = new Date();
  exam.setDate(exam.getDate() + 60);
  await page.locator('input[name="examDate"]').fill(exam.toISOString().slice(0, 10));
  await page.getByRole("button", { name: /プランを作成/ }).click();
  await expect(page).toHaveURL(/\/plan\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "AWS SAA" })).toBeVisible();
  await expect(page.getByText(/AIが作成中|生成に失敗/)).toBeVisible({ timeout: 30_000 });
  await assertHealthy();
});

tour("quiz", "良問バンク: 一覧→腕試しへ", ["/quiz", "/quiz/play"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/quiz");
  await expect(page.getByRole("heading", { name: "良問バンク" })).toBeVisible();
  await page.getByRole("link", { name: /腕試しを始める/ }).click();
  await expect(page.getByRole("heading", { name: "腕試し" })).toBeVisible();
  await assertHealthy();
});

tour("quiz-daily", "今日の一問: 選択肢を選ぶと正誤フィードバックが出る（1日1問なので desktop のみ）", ["/quiz/daily"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/quiz/daily");
  await expect(page.getByRole("heading", { name: "今日の一問" })).toBeVisible();
  const firstChoice = page.locator("button.w-full").first();
  await firstChoice.click();
  await expect(page.getByText(/◎ 正解！|✕ 不正解/)).toBeVisible();
  await assertHealthy();
});

tour("quiz-play", "腕試し: お題つきで出題→1問解答→次へ", ["/quiz/play"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/quiz/play?topic=AWS%20IAM");
  await expect(page.getByRole("heading", { name: "腕試し" })).toBeVisible();
  await page.locator("button.w-full").first().click();
  await expect(page.getByText(/◎ 正解！|✕ 不正解/)).toBeVisible();
  await page.getByRole("button", { name: /次の問題|結果を見る|RESULT/ }).first().click();
  await assertHealthy();
});

tour("quiz-review", "復習ボックス: 空状態が表示される", ["/quiz/review"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/quiz/review");
  await expect(page.getByRole("heading", { name: "復習ボックス" })).toBeVisible();
  await assertHealthy();
});

tour("quiz-new", "問題を作る: フォームが出て領域チップが押せる", ["/quiz/new"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/quiz/new");
  await expect(page.getByRole("heading", { name: "問題を作る" })).toBeVisible();
  await page.getByText(/WEB/).first().click();
  await assertHealthy();
});

tour("roleplay", "役割シミュレーター: シナリオ一覧とシャッフル", ["/roleplay"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/roleplay");
  await expect(page.getByRole("heading", { name: "役割シミュレーター" })).toBeVisible();
  await page.getByRole("button", { name: /シャッフル/ }).click();
  await expect(page.getByRole("button", { name: /START/ }).first()).toBeVisible();
  await assertHealthy();
});

tour("roleplay-session", "役割シミュレーター: START→演習画面（AIの導入セリフ生成に失敗しても開ける）", ["/roleplay", "/roleplay/[id]"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/roleplay");
  await page.getByRole("button", { name: /START/ }).first().click();
  await expect(page).toHaveURL(/\/roleplay\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /一覧/ })).toBeVisible();
  await expect(page.getByPlaceholder(/この場面での対応を入力/)).toBeVisible();
  await assertHealthy();
});

tour("genba", "げんば: 案件一覧→面接へ→辞退して戻る（AI不使用の決定的ロジック） @mobile", ["/genba"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/genba");
  await expect(page.getByRole("heading", { name: /GENBA/ })).toBeVisible();
  await page.getByRole("button", { name: /面接にすすむ/ }).first().click();
  await expect(page.getByRole("button", { name: /よろしくお願いします/ })).toBeVisible();
  await page.getByRole("button", { name: /辞退して戻る/ }).click();
  await expect(page.getByRole("button", { name: /面接にすすむ/ }).first()).toBeVisible();
  await assertHealthy();
});

tour("genba-album", "きおくのアルバム: 表示される", ["/genba/album"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/genba/album");
  await expect(page.getByRole("heading", { name: /ALBUM/ })).toBeVisible();
  await assertHealthy();
});

tour("shop", "おかいもの: 商品が並び、EN不足の商品は買えない @mobile", ["/shop"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/shop");
  await expect(page.getByRole("heading", { name: /SHOP/ })).toBeVisible();
  const buy = page.getByRole("button", { name: "かう" });
  expect(await buy.count(), "商品が1つも表示されていない").toBeGreaterThan(0);
  await expect(buy.first()).toBeDisabled();
  await assertHealthy();
});

tour("myhome", "マイホーム: 表示ともようがえ（壁紙の切替が保存される）", ["/home"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/home");
  await expect(page.getByRole("heading", { name: "マイホーム" })).toBeVisible();
  // 未選択かつ未ロックの壁紙/床を1つ選ぶ
  const candidate = page.locator('button[aria-pressed="false"]').filter({ hasNotText: "🔒" }).first();
  const label = (await candidate.textContent())?.trim() ?? "";
  await candidate.click();
  await expect(page.getByRole("button", { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toHaveAttribute("aria-pressed", "true");
  await assertHealthy();
});

tour("walk", "おさんぽ: 表示される（ペット未所持の案内）", ["/walk"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/walk");
  await expect(page.getByRole("heading", { name: /WALK/ })).toBeVisible();
  await assertHealthy();
});

tour("dungeon", "ダンジョン: 潜行が始まり、迷路を歩くと何かが起きる（潜行回数を消費するので desktop のみ）", ["/dungeon"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/dungeon");
  await expect(page.getByRole("heading", { name: "ダンジョン" })).toBeVisible();
  await page.getByRole("button", { name: /潜る/ }).click();
  await expect(page.getByText(/地下\d+階/).first()).toBeVisible();

  // メッセージはクリックで送る。十字キー（進む）が出るまで送り続ける（tests/e2e/smoke.spec.ts と同じ手順）
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
  await assertHealthy();
});

tour("yomoyama", "よもやま: 一覧と投稿フォームの開閉", ["/yomoyama"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/yomoyama");
  await expect(page.getByRole("heading", { name: "よもやま" })).toBeVisible();
  await page.getByRole("button", { name: /現場のできごとをつぶやく/ }).click();
  await expect(page.getByText(/投稿前にAIが確認し/)).toBeVisible();
  await page.getByRole("button", { name: /閉じる/ }).first().click();
  await assertHealthy();
});

tour("discover", "みんなの成長: 一覧→公開プロフィールへ", ["/discover", "/u/[handle]"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/discover");
  await expect(page.getByRole("heading", { name: "みんなの成長" })).toBeVisible();
  await page.getByRole("link", { name: /cloud-taro/ }).click();
  await expect(page).toHaveURL(/\/u\/cloud-taro$/);
  await expect(page.getByRole("heading", { name: "エンジニア デモ2" })).toBeVisible();
  await assertHealthy();
});

tour("public-profile", "公開プロフィール: /u/<handle> が表示される", ["/u/[handle]"], async ({ page, assertHealthy }) => {
  await page.goto("/u/engineer-demo");
  await expect(page.getByRole("heading", { name: "エンジニア デモ" })).toBeVisible();
  await assertHealthy();
});

tour("public-quiz", "良問の公開ページ: /q/<id> が表示される", ["/q/[id]"], async ({ page, assertHealthy }) => {
  await page.goto("/q/quiz-iam-1");
  await expect(page.getByRole("heading", { name: /IAM/ })).toBeVisible();
  await assertHealthy();
});

tour("mypage", "マイページ: 表示とパレット切替（設定の保存） @mobile", ["/mypage"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await open(page, "/mypage");
  await expect(page.getByRole("heading", { name: "マイページ" })).toBeVisible();
  const palette = page.getByRole("button", { name: "GAME BOY" });
  await palette.click();
  await expect(palette).toHaveAttribute("aria-pressed", "true");
  await assertHealthy();
});

tour("not-found", "存在しないURL: 404画面が出る（エラー画面ではなく）", [], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await assertHealthy();
});

// ---------------------------------------------------------------------------
// 管理者・営業
// ---------------------------------------------------------------------------

tour("admin", "管理ダッシュボード: 管理者で表示→コンテンツ一覧へ", ["/admin", "/admin/content"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("admin");
  await open(page, "/admin");
  await expect(page.getByRole("heading", { name: "管理ダッシュボード" })).toBeVisible();
  await page.getByRole("link", { name: /コンテンツ一覧/ }).click();
  await expect(page.getByRole("heading", { name: "コンテンツ一覧" })).toBeVisible();
  await assertHealthy();
});

tour("admin-inquiries", "問い合わせ管理: 表示とフィルタ切替", ["/admin/inquiries"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("admin");
  await open(page, "/admin/inquiries");
  await expect(page.getByRole("heading", { name: "問い合わせ" })).toBeVisible();
  await page.getByRole("link", { name: /すべて/ }).click();
  await expect(page).toHaveURL(/status=all/);
  await assertHealthy();
});

tour("admin-guard", "権限: エンジニアは /admin に入れない（404になる）", ["/admin"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("engineer");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "管理ダッシュボード" })).toHaveCount(0);
  await assertHealthy();
});

tour("sales-home", "営業: ホームと週報が開ける", ["/", "/report"], async ({ page, loginAs, assertHealthy }) => {
  await loginAs("sales");
  await open(page, "/");
  await expect(page.getByText("営業 デモ").first()).toBeVisible();
  await open(page, "/report");
  await expect(page.getByRole("heading", { name: "今週の週報" })).toBeVisible();
  await assertHealthy();
});
