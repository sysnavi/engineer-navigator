// 良問バンクのシードデータを構造チェックする（npm run check:quizzes）。
//
// 人力・AI問わず問題を足したときに、機能から引けない・壊れて出るデータが
// 混ざるのを止めるのが目的。中身の正しさ（四択の答えが合っているか）は
// 人の目でしか見られないので、ここでは「機械で分かる不備」だけを見る。

import { allCertTopics } from "../src/lib/certifications";
import { isDomainId } from "../src/lib/domains";
import { SEED_QUIZZES } from "../prisma/seed-quizzes";
import { SEED_CERT_QUIZZES } from "../prisma/seed-cert-quizzes";
import { CERT_QUIZZES_EXTRA } from "../prisma/quizzes";

// 資格カタログ向けの問題だけは topic がカタログに一致する必要がある。
// SEED_QUIZZES は "SQL" "エクセル関数" のような自由なお題でよい。
const all = [
  ...SEED_QUIZZES.map((q) => ({ q, mustMatchCatalog: false })),
  ...SEED_CERT_QUIZZES.map((q) => ({ q, mustMatchCatalog: true })),
  ...CERT_QUIZZES_EXTRA.map((q) => ({ q, mustMatchCatalog: true })),
];
const catalog = new Set(allCertTopics());
const errors: string[] = [];
const warns: string[] = [];

const seenId = new Map<string, number>();
const seenPrompt = new Map<string, string>();

for (const { q, mustMatchCatalog } of all) {
  const at = `${q.id}`;

  if (seenId.has(q.id)) errors.push(`${at}: idが重複`);
  seenId.set(q.id, (seenId.get(q.id) ?? 0) + 1);

  const norm = q.prompt.replace(/\s/g, "");
  const dup = seenPrompt.get(norm);
  if (dup) errors.push(`${at}: 設問文が ${dup} と同一`);
  else seenPrompt.set(norm, q.id);

  if (q.choices.length !== 4) errors.push(`${at}: 選択肢が${q.choices.length}個（4個であること）`);
  if (new Set(q.choices).size !== q.choices.length) errors.push(`${at}: 選択肢に重複がある`);
  if (q.choices.some((c) => !c.trim())) errors.push(`${at}: 空の選択肢がある`);

  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.choices.length) {
    errors.push(`${at}: answerIndex=${q.answerIndex} が選択肢の範囲外`);
  }

  if (!q.prompt.trim()) errors.push(`${at}: promptが空`);
  if (!q.explanation.trim()) errors.push(`${at}: explanationが空`);
  if (q.explanation.length < 30) warns.push(`${at}: explanationが短い（${q.explanation.length}字）`);

  for (const d of q.domains) {
    if (!isDomainId(d)) errors.push(`${at}: 不明なdomain "${d}"`);
  }

  if (!q.scores.length) errors.push(`${at}: scoresが空`);
  for (const s of q.scores) {
    if (!Number.isInteger(s) || s < 0 || s > 10) errors.push(`${at}: score=${s} が0-10の範囲外`);
  }

  // カタログのtopicに「似ているが一致しない」のが一番怖い（永久に引けなくなる）。
  if (mustMatchCatalog && !catalog.has(q.topic)) {
    errors.push(`${at}: topic "${q.topic}" がカタログに無い（表記ゆれの疑い）`);
  }
}

// 資格カタログの章ごとの在庫。seed.ts / seed-launch.ts に直書きされている分は
// ここからは見えないので、0問でもエラーにはせず警告に留める。
const perTopic = new Map<string, number>();
for (const { q } of all) perTopic.set(q.topic, (perTopic.get(q.topic) ?? 0) + 1);
const empty = [...catalog].filter((t) => !perTopic.get(t));
for (const t of empty) warns.push(`章 "${t}" がこのファイル群に0問`);

// 正解の位置が偏ると「迷ったら1番」で当たるようになる
const dist = [0, 0, 0, 0];
for (const { q } of all) if (q.answerIndex < 4) dist[q.answerIndex]++;
const maxShare = Math.max(...dist) / all.length;

console.log(`問題数: ${all.length}（うち資格カタログの章: ${all.filter(({ q }) => catalog.has(q.topic)).length}）`);
console.log(`正解位置の分布: ${dist.join(" / ")}（最多 ${Math.round(maxShare * 100)}%）`);
if (maxShare > 0.4) warns.push(`正解位置が偏っている（最多 ${Math.round(maxShare * 100)}%）`);

for (const w of warns) console.log(`  warn: ${w}`);
for (const e of errors) console.error(`  ERROR: ${e}`);

if (errors.length) {
  console.error(`\n${errors.length}件のエラー`);
  process.exit(1);
}
console.log(`\nOK（warn ${warns.length}件）`);
