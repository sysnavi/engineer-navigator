// ツアー結果（Playwright JSON レポート）を集計し、不備1件につき1投稿を Slack に送る。
// 併せて tour-results/failures.json を書き出す（自動修正フェーズ = /bug-triage の入力）。
//
// 「1件」の単位はツアーの id（tests/tour/helpers.ts の tour() の第1引数）。
// desktop / mobile の両方で落ちても同じ不備として1投稿にまとめる。
// 同じ id の修正PR（triage/<id> ブランチ）が open なら「既知」として扱い、修正対象から外す。

import { execSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { postText, postWithFile } from "./slack";

const RESULTS_DIR = "tour-results";
const REPORT = `${RESULTS_DIR}/report.json`;
const RUN_URL = process.env.RUN_URL ?? "";

type PwAttachment = { name: string; path?: string; contentType: string };
type PwResult = {
  status: string;
  error?: { message?: string };
  errors?: { message?: string }[];
  attachments?: PwAttachment[];
};
type PwTest = { projectName: string; status: string; results: PwResult[] };
type PwSpec = { title: string; ok: boolean; tests: PwTest[] };
type PwSuite = { title: string; specs?: PwSpec[]; suites?: PwSuite[] };
type PwReport = { suites: PwSuite[] };

export type Failure = {
  id: string;
  title: string;
  projects: string[];
  error: string;
  screenshot?: string;
  slackTs?: string;
  knownPr?: { number: number; url: string };
};

const stripAnsi = (s: string) => s.replace(/\[[0-9;]*m/g, "");

function* walk(suites: PwSuite[]): Generator<PwSpec> {
  for (const s of suites) {
    for (const spec of s.specs ?? []) yield spec;
    if (s.suites) yield* walk(s.suites);
  }
}

function splitTitle(title: string): { id: string; title: string } {
  const m = title.match(/^([a-z0-9-]+) \| (.*)$/);
  return m
    ? { id: m[1], title: m[2] }
    : { id: title.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), title };
}

function collect(report: PwReport): { failures: Failure[]; total: number } {
  const byId = new Map<string, Failure>();
  const ids = new Set<string>();
  for (const spec of walk(report.suites)) {
    const { id, title } = splitTitle(spec.title);
    ids.add(id);
    for (const t of spec.tests) {
      // retries 込みの最終判定。expected=成功、flaky=リトライで成功
      if (["expected", "flaky", "skipped"].includes(t.status)) continue;
      const last = t.results[t.results.length - 1];
      const msg =
        last?.error?.message ??
        last?.errors?.[0]?.message ??
        `status=${last?.status}`;
      const shot = last?.attachments?.find(
        (a) => a.contentType === "image/png" && a.path
      )?.path;
      const f = byId.get(id) ?? {
        id,
        title,
        projects: [],
        error: stripAnsi(msg).split("\n").slice(0, 6).join("\n"),
      };
      f.projects.push(t.projectName);
      if (!f.screenshot && shot) f.screenshot = shot;
      byId.set(id, f);
    }
  }
  return { failures: [...byId.values()], total: ids.size };
}

function openTriagePrs(): Map<string, { number: number; url: string }> {
  const map = new Map<string, { number: number; url: string }>();
  try {
    const out = execSync(
      "gh pr list --state open --limit 100 --json number,url,headRefName",
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    for (const pr of JSON.parse(out) as {
      number: number;
      url: string;
      headRefName: string;
    }[]) {
      const m = pr.headRefName.match(/^triage\/(.+)$/);
      if (m) map.set(m[1], { number: pr.number, url: pr.url });
    }
  } catch {
    // gh が無い / 認証なし（ローカル dry-run）は既知判定をスキップ
  }
  return map;
}

async function main() {
  if (!existsSync(REPORT)) {
    throw new Error(
      `${REPORT} がありません。先に npm run test:tour を実行してください`
    );
  }
  const report = JSON.parse(readFileSync(REPORT, "utf8")) as PwReport;
  const { failures, total } = collect(report);
  const known = openTriagePrs();
  const today = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
  const runLine = RUN_URL ? `\n実行ログ: ${RUN_URL}` : "";

  if (failures.length === 0) {
    await postText(
      `✅ 日次トリアージ ${today}: ${total}画面のツアーすべて正常${runLine}`
    );
  } else {
    await postText(
      `🚨 日次トリアージ ${today}: ${total}画面中 ${failures.length}件の不備を検出。1件ずつ続けて投稿します${runLine}`
    );
    for (const f of failures) {
      f.knownPr = known.get(f.id);
      const knownLine = f.knownPr
        ? `\n既知: 修正PR #${f.knownPr.number} が未マージ ${f.knownPr.url}`
        : "";
      const text =
        `🐞 [${f.id}] ${f.title}\n` +
        `表示: ${f.projects.join(" / ")}\n` +
        "```\n" +
        f.error +
        "\n```" +
        knownLine +
        runLine;
      const r =
        f.screenshot && existsSync(f.screenshot)
          ? await postWithFile(text, f.screenshot)
          : await postText(text + "\n（キャプチャなし: 画面到達前に失敗）");
      f.slackTs = r.ts;
    }
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    `${RESULTS_DIR}/failures.json`,
    JSON.stringify(failures, null, 2)
  );
  const fixable = failures.filter((f) => !f.knownPr).length;
  console.log(`failures=${failures.length} fixable=${fixable} total=${total}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `failures=${failures.length}\nfixable=${fixable}\n`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
