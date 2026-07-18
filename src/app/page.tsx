import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf, formatWeek } from "@/lib/week";
import { getPlayerStats } from "@/lib/exp";
import { PixelTitle, PixelLabel, Window } from "@/components/retro";
import { PixelAvatar } from "@/components/pixel-avatar";

// ヒーロー内「つながりパイプライン」のチップ
function Chip(props: {
  children: React.ReactNode;
  tone?: "sun" | "hot";
}) {
  const tone =
    props.tone === "hot"
      ? "bg-pinkhot text-white"
      : props.tone === "sun"
        ? "bg-lemon text-ink"
        : "bg-win text-ink";
  return (
    <span
      className={`whitespace-nowrap rounded-md border-2 border-line8 px-2 py-0.5 font-pixel text-[11px] tracking-wide shadow-[2px_2px_0_rgba(0,0,0,0.35)] ${tone}`}
    >
      {props.children}
    </span>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="font-pixel text-[11px] text-lemon">
      ▶
    </span>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  const weekStart = mondayOf(new Date());

  const [report, pendingSuggestions, skillCount, expCount, player] =
    await Promise.all([
      prisma.weeklyReport.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart } },
      }),
      prisma.skillSuggestion.count({
        where: { userId: user.id, status: "PENDING" },
      }),
      prisma.engineerSkill.count({ where: { userId: user.id } }),
      prisma.skillSuggestion.count({
        where: { userId: user.id, status: "APPROVED", kind: "EXPERIENCE" },
      }),
      getPlayerStats(user.id),
    ]);

  const reportDone = report?.status === "SUBMITTED";
  const filledBlocks = Math.round(player.levelProgress * 10);

  return (
    <div className="space-y-7">
      {/* ヒーロー: 「がんばりは、ぜんぶ経験値になる。」＋プレイヤーカード */}
      <section className="rounded-xl border-[2.5px] border-line8 bg-royal p-5 text-white shadow-hard sm:p-6">
        <div className="flex flex-wrap items-stretch gap-5">
          <div className="min-w-[260px] flex-1">
            <p className="font-pixel text-[11px] tracking-[0.14em] text-peri">
              WEEKLY QUEST — {formatWeek(weekStart)}｜こんにちは、{user.name} さん
            </p>
            <PixelTitle as="h1" className="mt-1.5 text-[26px] leading-snug sm:text-3xl">
              がんばりは、<span className="text-lemon">ぜんぶ経験値</span>になる。
            </PixelTitle>
            <p className="mt-2 max-w-[56ch] text-[12.5px] leading-relaxed text-[#dbe8ff]">
              週報も、腕試しも、よもやまも。ここでの行動はすべてつながって、
              スキルと経歴書、そして<span className="text-lemon">きみのアバター</span>を育てます。
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip>週報</Chip>
                <Arrow />
                <Chip tone="sun">スキルLv</Chip>
                <Arrow />
                <Chip>経歴書</Chip>
                <Arrow />
                <Chip tone="hot">公開して学び合う</Chip>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip>作問・投稿・演習</Chip>
                <Arrow />
                <Chip tone="sun">EXP</Chip>
                <Arrow />
                <Chip tone="hot">アバター成長</Chip>
              </div>
            </div>
          </div>

          {/* プレイヤーカード */}
          <div className="w-full overflow-hidden rounded-lg border-[2.5px] border-line8 bg-win text-ink shadow-[3px_3px_0_rgba(0,0,0,0.4)] sm:w-[320px]">
            <div className="flex items-center justify-between bg-ink px-3 py-1.5 font-pixel text-[10.5px] tracking-[0.12em] text-white">
              <span>PLAYER_FILE.sav</span>
              <span aria-hidden="true">▮▮▮</span>
            </div>
            <div className="flex items-center gap-3.5 px-3.5 py-3">
              <div className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-lg border-[2.5px] border-line8 bg-surface">
                <PixelAvatar sprite={player.stage.sprite} px={7} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-pixel text-[14px] tracking-wide">
                  {user.handle ?? user.name}
                </p>
                <p className="font-pixel text-[11px] tracking-[0.1em] text-pinkhot">
                  Lv {player.level} — {player.stage.name}
                </p>
                <div className="mt-1.5 flex gap-[3px]" aria-label={`次のレベルまで ${player.expToNextLevel} EXP`}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <i
                      key={i}
                      className={`h-3 w-4 rounded-[3px] border-2 border-line8 ${
                        i < filledBlocks
                          ? i === filledBlocks - 1
                            ? "bg-pinkhot"
                            : "bg-lemon"
                          : "bg-win"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-inksoft">
                  つぎのLvまで {player.expToNextLevel} EXP
                  {player.nextStage &&
                    ` ／ Lv${player.nextStage.minLevel}で「${player.nextStage.name}」に進化`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t-2 border-dashed border-peri px-3.5 py-2.5">
              <span className="w-full font-pixel text-[10px] tracking-[0.1em] text-inksoft">
                今週のかつどう
              </span>
              {player.weekActivities.length === 0 ? (
                <span className="text-[11.5px] text-inksoft">
                  まだ活動なし。週報から始めよう（+50 EXP）
                </span>
              ) : (
                <>
                  {player.weekActivities.map((a) => (
                    <span
                      key={a.label}
                      className="rounded-md border-2 border-line8 bg-surface px-1.5 py-0.5 font-pixel text-[10.5px]"
                    >
                      {a.label} <span className="text-[var(--good)]">+{a.exp}</span>
                    </span>
                  ))}
                  <span className="ml-auto font-pixel text-[11px] text-pinkhot">
                    計 +{player.weekExp} EXP
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <Link href="/report" className="group">
          <Window
            title="週報"
            titleEm=".exe"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel className={reportDone ? "" : "!text-pinkhot"}>
              {reportDone ? "QUEST CLEAR!" : "NEW QUEST"}
            </PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">今週の週報</p>
            <p className="mt-1 text-[13px] text-inksoft">
              {reportDone
                ? "提出済み。おつかれさまでした"
                : "未提出です。5分で書けます"}
            </p>
          </Window>
        </Link>

        <Link href="/skills" className="group">
          <Window
            title="SKILL_MAP"
            titleEm=".sav"
            className="transition-transform group-hover:-translate-y-0.5"
            barClass={pendingSuggestions > 0 ? "!bg-pinkhot" : ""}
          >
            <PixelLabel className={pendingSuggestions > 0 ? "!text-pinkhot" : ""}>
              {pendingSuggestions > 0 ? "LEVEL UP READY!" : "SKILL MAP"}
            </PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">スキルマップ</p>
            <p className="mt-1 text-[13px] text-inksoft">
              {pendingSuggestions > 0
                ? `AIからの更新提案が ${pendingSuggestions} 件あります`
                : `登録スキル ${skillCount} 件`}
            </p>
          </Window>
        </Link>

        <Link href="/mentor" className="group">
          <Window
            title="MENTOR"
            titleEm=".exe"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>AI MENTOR</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">AIメンター</p>
            <p className="mt-1 text-[13px] text-inksoft">
              資格・技術を「現場でどう使うか」まで具体例つきで24時間相談
            </p>
          </Window>
        </Link>

        <Link href="/plan" className="group">
          <Window
            title="STUDY_PLAN"
            titleEm=".sav"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>STUDY PLAN</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">学習プラン</p>
            <p className="mt-1 text-[13px] text-inksoft">
              資格の試験日から逆算した週次カリキュラムをAIが作成
            </p>
          </Window>
        </Link>

        <Link href="/quiz" className="group">
          <Window
            title="QUIZ_BANK"
            titleEm=".dat"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>腕試し</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">良問バンク</p>
            <p className="mt-1 text-[13px] text-inksoft">
              四択でスキルチェック。良問はみんなで作って育てる
            </p>
          </Window>
        </Link>

        <Link href="/roleplay" className="group">
          <Window
            title="ROLEPLAY"
            titleEm=".sim"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>ROLE SIMULATOR</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">役割シミュレーター</p>
            <p className="mt-1 text-[13px] text-inksoft">
              顧客調整・障害対応などリーダーの難題をAIとロールプレイ→評価
            </p>
          </Window>
        </Link>

        <Link href="/yomoyama" className="group">
          <Window
            title="YOMOYAMA"
            titleEm=".log"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>よもやま</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">現場のよもやま話</p>
            <p className="mt-1 text-[13px] text-inksoft">
              悲喜こもごもをハンドル名で共有（AI門番つきで安心）
            </p>
          </Window>
        </Link>

        <Link href="/resume" className="group">
          <Window
            title="経歴書"
            titleEm=".doc"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>CAREER SHEET</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">経歴書</p>
            <p className="mt-1 text-[13px] text-inksoft">
              スキル {skillCount} 件・実績 {expCount} 件から自動組版。PDFで出力
            </p>
          </Window>
        </Link>

        <Link href="/discover" className="group">
          <Window
            title="DISCOVER"
            titleEm=".net"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>DISCOVER</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">発見</p>
            <p className="mt-1 text-[13px] text-inksoft">
              他の人の「成長の道筋」を見て、自分の学びに活かす
            </p>
          </Window>
        </Link>

        {(user.role === "SALES" || user.role === "ADMIN") && (
          <Link href="/condition" className="group">
            <Window
              title="CONDITION"
              titleEm=".mon"
              className="transition-transform group-hover:-translate-y-0.5"
            >
              <PixelLabel>CONDITION</PixelLabel>
              <p className="mt-1 text-[15px] font-extrabold">コンディション</p>
              <p className="mt-1 text-[13px] text-inksoft">
                エンジニアの週次コンディションとアラートを見守る（管理者向け）
              </p>
            </Window>
          </Link>
        )}

        {user.role === "ADMIN" && (
          <Link href="/admin" className="group">
            <Window
              title="ADMIN"
              titleEm=".sys"
              className="transition-transform group-hover:-translate-y-0.5"
            >
              <PixelLabel>ADMIN CONSOLE</PixelLabel>
              <p className="mt-1 text-[15px] font-extrabold">管理ダッシュボード</p>
              <p className="mt-1 text-[13px] text-inksoft">
                全ユーザー分析・招待リンク発行・アカウント管理
              </p>
            </Window>
          </Link>
        )}
      </div>

      <p className="text-center font-pixel text-[12px] tracking-[0.1em] text-royal2">
        週報を書く → スキルLvが上がる → 経歴書が育つ ▶ PRESS START
      </p>
    </div>
  );
}
