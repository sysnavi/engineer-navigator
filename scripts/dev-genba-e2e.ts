import { prisma } from "@/lib/db";
import { eventForDay } from "@/lib/genba/logic";
import { GENBA, OFFER_TEMPLATES, type GenbaTheme } from "@/lib/genba/content";

// げんばE2E用のDB直操作（dev専用）。
//   npx tsx --env-file=.env scripts/dev-genba-e2e.ts <mode>
// mode:
//   almost-done  … 進行中契約を「最終日前夜」にする（昨日日付で day=totalDays-1 消化済みに）
//   failing      … 途中退場検証用の契約を作る（strikes=2・たいりょく極小・初日に−たいりょく選択肢がある seed を探す）
//   era [theme]  … きおくの現場の契約を作る（既定: punchcard）。アルバム解放の検証用
//   trust <n>    … えいぎょう信頼を n にする（妙な案件の混入検証用。60+で解放）
//   revisit-ready <templateId> [trust=80] … 基礎案件を満了扱いにする（再訪案件の解禁検証用。trust 69 で非解禁も確認可）
//   status       … Wallet / WalletLog / GenbaSales / 契約一覧を表示

const TARGET = process.env.DEV_GENBA_USER ?? "engineer@sysnavi.co.jp";

function yesterdayStr(): string {
  const d = new Date(Date.now() - 86400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  const mode = process.argv[2] ?? "status";
  const user = await prisma.user.findUniqueOrThrow({ where: { email: TARGET } });

  if (mode === "almost-done") {
    const c = await prisma.genbaContract.findFirstOrThrow({
      where: { userId: user.id, status: "ACTIVE" },
    });
    const t = yesterdayStr();
    const day = c.totalDays - 1;
    const log = Array.from({ length: day }, (_, i) => ({
      d: i + 1,
      t,
      ev: "e2e",
      c: 0,
      ok: true,
      trust: 70,
      stamina: 90,
    }));
    await prisma.genbaContract.update({
      where: { id: c.id },
      data: { day, trust: 70, stamina: 90, strikes: 0, log },
    });
    console.log(`almost-done: ${c.title} day=${day}/${c.totalDays} trust=70`);
  } else if (mode === "failing") {
    await prisma.genbaContract.deleteMany({
      where: { userId: user.id, status: "ACTIVE" },
    });
    // 初日のイベントに「たいりょくを削る選択肢」があるseedを探す（強制しくじりの決定的検証用）
    const theme: GenbaTheme = "web";
    let seed = 1;
    for (; seed < 5000; seed++) {
      const ev = eventForDay(seed, theme, 1);
      if (ev.choices.some((ch) => (ch.stamina ?? 0) <= -9) && !ev.peaceful) break;
    }
    const ev = eventForDay(seed, theme, 1);
    await prisma.genbaContract.create({
      data: {
        userId: user.id,
        offerId: `web-saas:e2e:0`,
        seed,
        title: "【E2E】途中退場検証現場",
        theme,
        rate: 70,
        totalDays: 15,
        trust: 20,
        stamina: 1, // 朝+8→9。−9以上削る選択肢で0＝強制しくじり
        strikes: 2, // 次のしくじりで3＝途中退場
      },
    });
    console.log(
      `failing: seed=${seed} day1="${ev.text.slice(0, 30)}…" choices=${ev.choices
        .map((c) => `${c.label.slice(0, 12)}(${c.stamina ?? 0})`)
        .join(" / ")}`
    );
  } else if (mode === "era") {
    const themeId = (process.argv[3] ?? "punchcard") as GenbaTheme;
    const tpl = OFFER_TEMPLATES.find((t) => t.theme === themeId && t.era);
    if (!tpl) throw new Error(`era template not found for theme: ${themeId}`);
    await prisma.genbaContract.deleteMany({
      where: { userId: user.id, status: "ACTIVE" },
    });
    const c = await prisma.genbaContract.create({
      data: {
        userId: user.id,
        offerId: `${tpl.id}:e2e:era`,
        seed: 42,
        title: tpl.title,
        theme: tpl.theme,
        rate: tpl.rate,
        totalDays: tpl.days,
      },
    });
    console.log(`era: ${c.title}（${tpl.era!.period}） rate=${c.rate} days=${c.totalDays}`);
  } else if (mode === "revisit-ready") {
    const templateId = process.argv[3] ?? "web-saas";
    const trust = Number(process.argv[4] ?? 80);
    const tpl = OFFER_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl || tpl.era || tpl.revisitOf) {
      throw new Error(`基礎テンプレ（非era・非再訪）を指定してください: ${templateId}`);
    }
    await prisma.genbaContract.create({
      data: {
        userId: user.id,
        offerId: `${tpl.id}:e2e:0`,
        seed: 1,
        title: tpl.title,
        theme: tpl.theme,
        rate: tpl.rate,
        totalDays: tpl.days,
        day: tpl.days,
        trust,
        status: "COMPLETED",
        payout: 0,
        endedAt: new Date(),
      },
    });
    const rv = OFFER_TEMPLATES.find((t) => t.revisitOf === tpl.id);
    console.log(
      `revisit-ready: ${tpl.id} を trust=${trust} で満了扱いに。` +
        (trust >= GENBA.REVISIT_TRUST
          ? `解禁される再訪: ${rv?.id ?? "(なし)"}`
          : `trust<${GENBA.REVISIT_TRUST} のため再訪は解禁されない（${tpl.id} は消えるだけ）`)
    );
  } else if (mode === "trust") {
    const n = Number(process.argv[3] ?? 60);
    await prisma.genbaSales.upsert({
      where: { userId: user.id },
      update: { trust: n },
      create: { userId: user.id, trust: n },
    });
    console.log(`trust: ${n}`);
  } else {
    const [wallet, logs, sales, contracts] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: user.id } }),
      prisma.walletLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.genbaSales.findUnique({ where: { userId: user.id } }),
      prisma.genbaContract.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { title: true, status: true, day: true, totalDays: true, trust: true, strikes: true, payout: true },
      }),
    ]);
    console.log("wallet:", wallet?.balance ?? "(none)");
    console.log("walletLog:", logs.map((l) => `${l.reason} ${l.delta >= 0 ? "+" : ""}${l.delta}`));
    console.log("sales:", sales && { trust: sales.trust, ok: sales.completedCount, ng: sales.failedCount });
    console.log("contracts:", contracts);
  }
}

main().finally(() => prisma.$disconnect());
