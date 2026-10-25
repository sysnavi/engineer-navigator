import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf, formatWeek } from "@/lib/week";
import { getPlayerStats } from "@/lib/exp";
import { getOrCreateDaily } from "@/lib/quiz/daily";
import { reviewSummary } from "@/lib/quiz/review";
import { resolveShell } from "@/lib/shell";
import { appsForRole, APP_GROUPS, type AppGroup } from "@/lib/apps";
import { OpenGenbaTrialTile } from "@/components/open-trial-tile";
import { PixelTitle, PixelLabel, Window } from "@/components/retro";
import { PixelIcon } from "@/components/pixel-icon";
import { PlayerCard } from "@/components/player-card";
import { TodaySys } from "@/components/shell/today-sys";

export default async function Home() {
  const user = await getCurrentUser();
  const weekStart = mondayOf(new Date());

  const [report, pendingSuggestions, skillCount, expCount, player, daily, review] =
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
      getOrCreateDaily(user.id),
      reviewSummary(user.id),
    ]);

  const reportDone = report?.status === "SUBMITTED";

  // ===== ゲスト: 遊べるものだけのホーム（Issue #18）=====
  // classicの直書きタイルも desktop のグリッドも全機能前提。ゲストには
  // 許可アプリ（appsForRole由来）＋登録カードだけを見せて、行けないページに
  // 誘導しない。マイページは登録導線なのでタイルでは出さず、カードに集約する。
  if (user.role === "GUEST") {
    const playable = appsForRole(user.role).filter((a) => a.id !== "mypage");
    return (
      <div className="space-y-6">
        <section className="rounded-xl border-[2.5px] border-line8 bg-royal p-5 text-white shadow-hard sm:p-6">
          <div className="flex flex-wrap items-stretch gap-5">
            <div className="min-w-[240px] flex-1">
              <p className="font-pixel text-[11px] tracking-[0.14em] text-peri">
                GUEST MODE
              </p>
              <PixelTitle as="h1" className="mt-1.5 text-[24px] leading-snug sm:text-3xl">
                まずは<span className="text-lemon">育てて、潜ろう</span>。
              </PixelTitle>
            </div>
            <PlayerCard
              displayName={user.handle ?? user.name}
              player={player}
              className="sm:w-[300px]"
            />
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {playable.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              title={a.desc}
              className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-line8 bg-surface px-1.5 py-3 text-center shadow-hard-sm transition-transform hover:-translate-y-0.5"
            >
              <PixelIcon id={a.id} px={3} />
              <span className="text-[11.5px] font-bold leading-tight">{a.name}</span>
            </Link>
          ))}
          {/* げんばはゲスト非開放。はじめかたガイドの味見ステップへの入口をタイルとして残す
              （/welcome で「げんばの味見」を約束しているため） */}
          <OpenGenbaTrialTile />
        </div>

        <Link href="/mypage" className="group block">
          <Window
            title="UNLOCK"
            titleEm=".cfg"
            barClass="!bg-pinkhot"
            className="transition-transform group-hover:-translate-y-0.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PixelLabel className="!text-pinkhot">登録すると、ぜんぶ使える</PixelLabel>
              <span className="btn8 btn8-start inline-block text-[12px]">
                ▶ 登録して全部つかう
              </span>
            </div>
          </Window>
        </Link>
      </div>
    );
  }

  // ===== デスクトップシェル: ホーム＝デスクトップ（ゾーン＋アイコン＋TODAY.sys） =====
  if (resolveShell(user) === "desktop") {
    const apps = appsForRole(user.role);
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 lg:order-2">
          <TodaySys userId={user.id} />
          <PlayerCard displayName={user.handle ?? user.name} player={player} />
        </div>
        <div className="space-y-5 lg:order-1">
          {(Object.keys(APP_GROUPS) as AppGroup[]).map((gid) => {
            const groupApps = apps.filter((a) => a.group === gid);
            if (groupApps.length === 0) return null;
            return (
              <section
                key={gid}
                className="rounded-xl border-2 border-dashed border-royal2/50 px-3 pb-3 pt-2"
              >
                <b className="font-pixel text-[11px] font-normal tracking-[0.14em] text-royal2">
                  {APP_GROUPS[gid]}/
                </b>
                <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {groupApps.map((a) => (
                    <Link
                      key={a.id}
                      href={a.href}
                      title={a.desc}
                      className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-transparent px-1.5 py-2.5 text-center hover:border-peri hover:bg-white/60"
                    >
                      <span className="drop-shadow-[2px_2px_0_rgba(18,35,95,0.2)]">
                        <PixelIcon id={a.id} px={3} />
                      </span>
                      <span className="text-[11.5px] font-bold leading-tight">
                        {a.name}
                      </span>
                      <i className="font-pixel text-[9px] not-italic tracking-wide text-inksoft">
                        {a.id.toUpperCase()}
                        {a.ext}
                      </i>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== クラシックシェル: 従来のヒーロー＋タイル =====
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
          </div>

          {/* プレイヤーカード（共通部品: デスクトップホームでも使用） */}
          <PlayerCard
            displayName={user.handle ?? user.name}
            player={player}
            className="sm:w-[320px]"
          />
        </div>
      </section>

      {/* タイルの説明文は持たず、出すのは実データの状態だけ。高さは h-full で行ごとに揃える */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Link href="/report" className="group">
          <Window
            title="週報"
            titleEm=".exe"
            className="h-full transition-transform group-hover:-translate-y-0.5"
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
            className="h-full transition-transform group-hover:-translate-y-0.5"
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
            className="h-full transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>AI MENTOR</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">AIメンター</p>
          </Window>
        </Link>

        <Link href="/plan" className="group">
          <Window
            title="STUDY_PLAN"
            titleEm=".sav"
            className="h-full transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>STUDY PLAN</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">学習プラン</p>
          </Window>
        </Link>

        <Link href="/quiz" className="group">
          <Window
            title="QUIZ_BANK"
            titleEm=".dat"
            className="h-full transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel className={daily.answered ? "" : "!text-pinkhot"}>
              {daily.answered
                ? `${daily.streak}日連続 🔥`
                : "今日の一問 まだ"}
            </PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">良問バンク</p>
            {!daily.answered && daily.question ? (
              <p className="mt-1 text-[13px] text-inksoft">
                今日の1問（{daily.question.topic}）が待っています
              </p>
            ) : review.due > 0 ? (
              <p className="mt-1 text-[13px] text-inksoft">
                復習どきの問題が{review.due}問あります
              </p>
            ) : null}
          </Window>
        </Link>

        <Link href="/roleplay" className="group">
          <Window
            title="ROLEPLAY"
            titleEm=".sim"
            className="h-full transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>ROLE SIMULATOR</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">役割シミュレーター</p>
          </Window>
        </Link>

        <Link href="/yomoyama" className="group">
          <Window
            title="YOMOYAMA"
            titleEm=".log"
            className="h-full transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>よもやま</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">現場のよもやま話</p>
          </Window>
        </Link>

        <Link href="/dungeon" className="group">
          <Window
            title="DUNGEON"
            titleEm=".log"
            className="h-full transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>AUTO EXPLORE</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">ダンジョン</p>
          </Window>
        </Link>

        <Link href="/resume" className="group">
          <Window
            title="経歴書"
            titleEm=".doc"
            className="h-full transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>CAREER SHEET</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">経歴書</p>
            <p className="mt-1 text-[13px] text-inksoft">
              スキル {skillCount} 件・実績 {expCount} 件
            </p>
          </Window>
        </Link>

        <Link href="/discover" className="group">
          <Window
            title="DISCOVER"
            titleEm=".net"
            className="h-full transition-transform group-hover:-translate-y-0.5"
          >
            <PixelLabel>DISCOVER</PixelLabel>
            <p className="mt-1 text-[15px] font-extrabold">発見</p>
          </Window>
        </Link>

        {/* コンディションカードは個人サービス化で撤去（Issue #19 方針A: 本人のみ閲覧） */}
        {user.role === "ADMIN" && (
          <Link href="/admin" className="group">
            <Window
              title="ADMIN"
              titleEm=".sys"
              className="h-full transition-transform group-hover:-translate-y-0.5"
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
        ▶ PRESS START
      </p>
    </div>
  );
}
