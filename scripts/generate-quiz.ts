import "dotenv/config";
import { prisma } from "@/lib/db";
import { generateQuizQuestions, isDuplicate } from "@/lib/ai/genquiz";
import {
  CERTIFICATIONS,
  allCertTopics,
  findCert,
  type CertChapter,
  type CertDef,
} from "@/lib/certifications";

// 腕試しの問題を作り置きするバッチ（npm run gen:quiz -- --fill 5）。
//
// 良問バンクはユーザー投稿が前提だったので、投稿が無いお題は空のままだった
// （＝学習プランから「この章の腕試し」へ飛んでも問題が無い）。ここで先に埋める。
//
// ★運営が手で回すもので、アプリからは呼ばない。ユーザーのレート制限は通さないが、
//   AiUsage には記録するので、管理画面のコスト集計にはバッチ分も出る。
//   全体の日次上限（AI_GLOBAL_PER_DAY）も共有なので、大量生成は夜間に。
//
// 使い方:
//   npm run gen:quiz -- --list                     お題ごとの問題数を見る
//   npm run gen:quiz -- --topic "AWS IAM" -n 5     お題を指定して5問
//   npm run gen:quiz -- --cert aws-saa -n 3        資格の全章に3問ずつ
//   npm run gen:quiz -- --topics "SQL,Git" -n 10   複数お題をまとめて（カタログ外でもOK）
//   npm run gen:quiz -- --fill 5                   カタログの全章＋DBに既にあるお題を5問まで補充
//   npm run gen:quiz -- --fill 10 --catalog-only   カタログの章だけに絞る
//   （--dry を付けると生成だけしてDBに入れない）
//
// ★1回のAI呼び出しは5問まで（多すぎると品質が落ちる）。それ以上の数を頼まれたら
//   5問ずつ何回かに分けて、採用済みの問題文を「避けるリスト」に足しながら目標数まで埋める。

// 出題者になるシステムユーザー。QuizQuestion.authorId が必須なので必要。
// 自作問題は本人に出題されない仕様なので、実在ユーザーを作者にすると
// その人だけAI問題を解けなくなる。専用ユーザーを立てるのはそのため。
const AI_AUTHOR_ID = "user-ai-quizmaster";
const AI_AUTHOR_NAME = "AI出題くん";

type Args = {
  topic?: string;
  topics?: string[];
  cert?: string;
  count: number;
  fill?: number;
  catalogOnly: boolean;
  dry: boolean;
  list: boolean;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { count: 3, catalogOnly: false, dry: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--topic") a.topic = argv[++i];
    else if (v === "--topics")
      a.topics = (argv[++i] ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    else if (v === "--catalog-only") a.catalogOnly = true;
    else if (v === "--cert") a.cert = argv[++i];
    else if (v === "--count" || v === "-n") a.count = Number(argv[++i]);
    else if (v === "--fill") a.fill = Number(argv[++i] ?? 5);
    else if (v === "--dry") a.dry = true;
    else if (v === "--list") a.list = true;
  }
  if (!Number.isFinite(a.count) || a.count < 1) a.count = 3;
  return a;
}

async function ensureAuthor(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { id: AI_AUTHOR_ID },
    update: {},
    create: {
      id: AI_AUTHOR_ID,
      name: AI_AUTHOR_NAME,
      // 公開プロフィールには出さない（isPublic の既定 false のまま）。
      // 招待もOAuth連携も持たないので、このIDでログインする経路は存在しない。
      role: "ENGINEER",
    },
  });
  return user.id;
}

/** お題ごとの現在の問題数 */
async function countsByTopic(topics: string[]): Promise<Map<string, number>> {
  const rows = await prisma.quizQuestion.groupBy({
    by: ["topic"],
    where: { topic: { in: topics } },
    _count: { _all: true },
  });
  const m = new Map(topics.map((t) => [t, 0]));
  for (const r of rows) m.set(r.topic, r._count._all);
  return m;
}

/** DBに既に問題があるお題（ユーザー投稿・初期シード分）。カタログ外でも補充対象にする */
async function existingTopics(): Promise<string[]> {
  const rows = await prisma.quizQuestion.findMany({
    distinct: ["topic"],
    select: { topic: true },
  });
  return rows.map((r) => r.topic);
}

type Job = { topic: string; focus: string | null; cert: CertDef | null; count: number };

/** 1回のAI呼び出しで頼む上限。多すぎると後半の問題の質が落ちる */
const PER_CALL = 5;

function chapterOf(topic: string): { cert: CertDef; chapter: CertChapter } | null {
  for (const c of CERTIFICATIONS) {
    const ch = c.chapters.find((x) => x.topic === topic);
    if (ch) return { cert: c, chapter: ch };
  }
  return null;
}

async function runJob(job: Job, authorId: string, dry: boolean): Promise<number> {
  const existing = await prisma.quizQuestion.findMany({
    where: { topic: job.topic },
    select: { prompt: true },
    take: 60,
    orderBy: { createdAt: "desc" },
  });
  // 採用した問題文をここに足していき、次の呼び出しで「避けるリスト」として渡す
  const avoid = existing.map((e) => e.prompt);

  let total = 0;
  // 重複で落ちる分を見込んで、目標回数+1回まで粘る（0問の回が出たら打ち切り）
  const maxRounds = Math.ceil(job.count / PER_CALL) + 1;
  for (let round = 1; round <= maxRounds && total < job.count; round++) {
    const want = Math.min(PER_CALL, job.count - total);
    const { questions, usage } = await generateQuizQuestions({
      topic: job.topic,
      focus: job.focus,
      certLabel: job.cert?.label ?? null,
      count: want,
      existingPrompts: avoid,
    });

    // 生成内でも重複しうるので、採用済みも突き合わせながら1問ずつ見る
    const accepted: typeof questions = [];
    for (const q of questions) {
      if (isDuplicate(q.prompt, avoid)) {
        console.log(`    ・重複でスキップ: ${q.prompt.slice(0, 40)}…`);
        continue;
      }
      accepted.push(q);
      avoid.push(q.prompt);
    }

    const roundLabel = maxRounds > 2 ? `(${round}回目) ` : "";
    console.log(
      `    ${roundLabel}生成${questions.length}問 → 採用${accepted.length}問` +
        `（in ${usage.inputTokens} / out ${usage.outputTokens} tok）`
    );
    if (dry) {
      for (const q of accepted) {
        console.log(`      Q. ${q.prompt}`);
        q.choices.forEach((c, i) => console.log(`        ${i === q.answerIndex ? "★" : " "} ${c}`));
      }
    } else {
      // 回ごとに書き込む（長いバッチが途中で落ちても、そこまでの分は残る）
      for (const q of accepted) {
        await prisma.quizQuestion.create({
          data: {
            authorId,
            topic: job.topic,
            domains: job.cert?.domains ?? [],
            prompt: q.prompt,
            choices: q.choices,
            answerIndex: q.answerIndex,
            explanation: q.explanation,
          },
        });
      }
      await prisma.aiUsage.create({ data: { userId: authorId, kind: "quiz-gen-batch" } });
    }
    total += accepted.length;
    if (accepted.length === 0) break;
  }
  if (total < job.count) {
    console.log(`    △ 目標${job.count}問に対して${total}問で打ち切り（重複が多い or 生成が細い）`);
  }
  return dry ? 0 : total;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    const topics = allCertTopics();
    const counts = await countsByTopic(topics);
    console.log("お題ごとの問題数（カタログの章）:\n");
    for (const c of CERTIFICATIONS) {
      console.log(`${c.emoji} ${c.label}`);
      for (const ch of c.chapters) {
        const n = counts.get(ch.topic) ?? 0;
        console.log(`  ${n === 0 ? "✗" : n < 3 ? "△" : "✓"} ${String(n).padStart(2)}問  ${ch.topic}`);
      }
    }
    const catalog = new Set(topics);
    const others = (await existingTopics()).filter((t) => !catalog.has(t)).sort();
    if (others.length) {
      const otherCounts = await countsByTopic(others);
      console.log("\n📚 カタログ外のお題（DBにあるもの。--fill はこれも補充する）");
      for (const t of others) {
        const n = otherCounts.get(t) ?? 0;
        console.log(`  ${n < 3 ? "△" : "✓"} ${String(n).padStart(2)}問  ${t}`);
      }
    }
    await prisma.$disconnect();
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY が未設定です。");
    process.exit(1);
  }

  // 何を作るかを決める
  const jobs: Job[] = [];
  const topicJob = (topic: string, count: number): Job => {
    const hit = chapterOf(topic);
    return { topic, focus: hit?.chapter.focus ?? null, cert: hit?.cert ?? null, count };
  };
  if (args.topic) {
    jobs.push(topicJob(args.topic, args.count));
  } else if (args.topics?.length) {
    for (const t of args.topics) jobs.push(topicJob(t, args.count));
  } else if (args.cert) {
    const cert = findCert(args.cert);
    if (!cert) {
      console.error(`資格「${args.cert}」がカタログにありません。--list で確認してください。`);
      process.exit(1);
    }
    for (const ch of cert.chapters) {
      jobs.push({ topic: ch.topic, focus: ch.focus, cert, count: args.count });
    }
  } else if (args.fill != null) {
    const target = Number.isFinite(args.fill) && args.fill > 0 ? args.fill : 5;
    // カタログの章＋（指定がなければ）DBに既にあるお題。順序はカタログ→その他で安定させる
    const topics = [...allCertTopics()];
    if (!args.catalogOnly) {
      const seen = new Set(topics);
      for (const t of (await existingTopics()).sort()) {
        if (!seen.has(t)) topics.push(t);
      }
    }
    const counts = await countsByTopic(topics);
    for (const t of topics) {
      const lack = target - (counts.get(t) ?? 0);
      if (lack <= 0) continue;
      jobs.push(topicJob(t, lack));
    }
    if (jobs.length === 0) {
      console.log(`すべてのお題が ${target} 問以上あります。やることなし。`);
      await prisma.$disconnect();
      return;
    }
  } else {
    console.error("--topic / --topics / --cert / --fill / --list のいずれかを指定してください。");
    process.exit(1);
  }

  const authorId = await ensureAuthor();
  console.log(`${jobs.length} お題を生成します${args.dry ? "（--dry: DBに入れません）" : ""}\n`);

  let total = 0;
  for (const [i, job] of jobs.entries()) {
    console.log(`[${i + 1}/${jobs.length}] ${job.topic}（${job.count}問）`);
    try {
      total += await runJob(job, authorId, args.dry);
    } catch (e) {
      // 1お題こけても残りは進める（長いバッチが最初の失敗で全滅しないように）
      console.error(`    × 失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n完了。${total}問を追加しました。`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
