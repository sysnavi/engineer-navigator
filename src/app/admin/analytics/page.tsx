// 来訪者分析（管理者限定）。数字の定義と読み方は docs/analytics.md。
//
// 見たいことは3つ:
//  1. 来ている人が増えているか（日次ユニーク訪問・WAU/MAU）
//  2. ゲストがどこで止まって、どれだけ登録に至るか（ファネル・遮断された機能・OAuthの結果）
//  3. 登録した人が戻ってくるか（登録週ごとの D1/D7/D30）・何を使っているか
// グラフは装飾でなく比較のため、色は「登録済み=royal / ゲスト=pink-hot」の2色だけに固定。

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getVisitorAnalytics } from "@/lib/analytics/queries";
import { pct } from "@/lib/analytics/stats";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { StatCard } from "@/app/admin/stat-card";

const GATE_LABELS: Record<string, string> = {
  report: "週報",
  skills: "スキルマップ",
  resume: "経歴書",
  mentor: "AIメンター",
  plan: "学習プラン",
  roleplay: "役割演習",
  yomoyama: "よもやま",
  discover: "発見",
  quiz: "問題づくり",
  genba: "げんば",
  shop: "おかいもの",
};

const OUTCOME_LABELS: Record<string, string> = {
  promoted: "✓ 昇格した",
  "already-linked": "⚠ 既存アカウントと衝突（別データあり）",
  "fail:denied": "認可画面でキャンセル",
  "fail:state": "確認情報の不一致",
  "fail:exchange": "プロバイダ通信の失敗",
  "fail:verifier": "アプリの確認コード欠落",
  "fail:provider": "無効なプロバイダ",
};

function gateLabel(app: string): string {
  if (app.startsWith("ai:")) return `AI呼び出し（${app.slice(3)}）`;
  return GATE_LABELS[app] ?? app;
}

function fmtDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default async function AnalyticsPage() {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") notFound();

  const a = await getVisitorAnalytics();
  const maxDaily = Math.max(1, ...a.daily.map((p) => p.guest + p.member));
  const maxStep = Math.max(1, ...a.funnel.steps.map((s) => s.users));
  const since = a.eventsSince
    ? a.eventsSince.toISOString().slice(0, 10)
    : null;

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <PixelLabel>ADMIN CONSOLE</PixelLabel>
          <PixelTitle as="h1" className="text-3xl text-royal">
            来訪者分析
          </PixelTitle>
          <p className="mt-1 text-[13px] text-inksoft">
            直近30日。だれが来て、ゲストはどこで止まり、登録した人は戻ってくるか。
          </p>
        </div>
        <Link href="/admin" className="btn8 shrink-0 px-3 py-1.5 text-[12px]">
          ← 管理ダッシュボード
        </Link>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="TODAY"
          value={a.today.member + a.today.guest}
          hint={`登録済み ${a.today.member} / ゲスト ${a.today.guest}`}
        />
        <StatCard
          label="WAU"
          value={a.wau.member + a.wau.guest}
          hint={`登録済み ${a.wau.member} / ゲスト ${a.wau.guest}`}
        />
        <StatCard
          label="MAU"
          value={a.mau.member + a.mau.guest}
          hint={`登録済み ${a.mau.member} / ゲスト ${a.mau.guest}`}
        />
        <StatCard label="MEMBERS" value={a.members} hint="登録済み 累計" />
        <StatCard
          label="NEW 30D"
          value={a.newDirect30 + a.promoted30}
          hint={`直接 ${a.newDirect30} / ゲスト昇格 ${a.promoted30}`}
        />
        <StatCard
          label="GUESTS 30D"
          value={a.newGuests30}
          hint={`登録率 ${pct(a.promoted30, a.newGuests30)}`}
        />
      </div>

      {/* 日次ユニーク訪問（14日） */}
      <Window title="VISITORS" titleEm=".log">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PixelLabel>日次ユニーク訪問 — 直近14日</PixelLabel>
          <div className="flex items-center gap-3 text-[11px] text-inksoft">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-royal" aria-hidden="true" />
              登録済み
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-pinkhot" aria-hidden="true" />
              ゲスト
            </span>
          </div>
        </div>
        <div className="mt-3 flex h-36 items-end gap-1.5" role="img" aria-label="日次ユニーク訪問の棒グラフ">
          {a.daily.map((p) => {
            const total = p.guest + p.member;
            return (
              <div
                key={p.day}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 self-stretch"
                title={`${fmtDay(p.day)}: 登録済み ${p.member} / ゲスト ${p.guest}`}
              >
                <span className="text-[10px] leading-none text-inksoft">
                  {total > 0 ? total : ""}
                </span>
                <div className="flex w-full flex-col justify-end gap-[2px]" style={{ height: `${(total / maxDaily) * 100}%` }}>
                  {p.guest > 0 && (
                    <div
                      className="w-full rounded-t-[4px] bg-pinkhot"
                      style={{ flexGrow: p.guest, flexBasis: 0 }}
                    />
                  )}
                  {p.member > 0 && (
                    <div
                      className={`w-full bg-royal ${p.guest > 0 ? "" : "rounded-t-[4px]"}`}
                      style={{ flexGrow: p.member, flexBasis: 0 }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1.5">
          {a.daily.map((p, i) => (
            <span key={p.day} className="flex-1 text-center text-[9.5px] text-inksoft">
              {i % 2 === 0 ? fmtDay(p.day) : ""}
            </span>
          ))}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-[11.5px] text-inksoft">表で見る</summary>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b-2 border-line8 text-left font-pixel text-[10px] text-inksoft">
                <th className="py-1 pr-3">日</th>
                <th className="px-2">登録済み</th>
                <th className="px-2">ゲスト</th>
                <th className="px-2">合計</th>
              </tr>
            </thead>
            <tbody>
              {a.daily.map((p) => (
                <tr key={p.day} className="border-b border-grid8">
                  <td className="py-1 pr-3">{p.day}</td>
                  <td className="px-2">{p.member}</td>
                  <td className="px-2">{p.guest}</td>
                  <td className="px-2 font-bold">{p.member + p.guest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Window>

      {/* ゲスト→本登録ファネル */}
      <Window title="GUEST FUNNEL" titleEm=".log" barClass="!bg-pinkhot">
        <PixelLabel className="!text-pinkhot">ゲスト → 本登録 — 直近30日にお試しを始めた人</PixelLabel>
        <p className="mt-1.5 text-[12px] leading-relaxed text-inksoft">
          各段は「その行動をした人数」。段の落差が大きいところがハードル。
          「登録限定に触れた」が少なければ登録の動機に出会えていない、
          「連携を始めた」のあとで減っていればOAuthの途中で失敗している。
          {since && (
            <>
              {" "}
              ⚠ イベント記録は {since} から。それ以前に始めたゲストは中間の段が欠ける。
            </>
          )}
        </p>
        <div className="mt-4 space-y-2">
          {a.funnel.steps.map((s) => (
            <div key={s.key} className="flex items-center gap-3" title={`${s.label}: ${s.users}人`}>
              <span className="w-32 shrink-0 text-[12.5px] font-bold">{s.label}</span>
              <div className="h-5 flex-1 rounded-r-[4px] bg-surface2">
                <div
                  className={`h-full rounded-r-[4px] ${s.key === "promoted" ? "bg-royal" : "bg-pinkhot"}`}
                  style={{ width: `${(s.users / maxStep) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-pixel text-[14px] text-royal">{s.users}</span>
              <span className="w-12 shrink-0 text-[11px] text-inksoft">{s.hint}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-inksoft">
          登録までの日数の中央値:{" "}
          <b className="text-ink">
            {a.funnel.medianDaysToPromote === null ? "—" : `${a.funnel.medianDaysToPromote}日`}
          </b>
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <PixelLabel>どの機能で弾かれたか（件数）</PixelLabel>
            <p className="mt-1 text-[11px] text-inksoft">
              登録の動機になっている機能。多いものを登録案内で真っ先に見せる。
            </p>
            {a.funnel.gateByApp.length === 0 ? (
              <p className="mt-2 text-[12px] text-inksoft">まだ記録がありません。</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {a.funnel.gateByApp.map((g) => (
                  <li key={g.app} className="flex justify-between border-b border-grid8 py-1 text-[12.5px]">
                    <span>{gateLabel(g.app)}</span>
                    <span className="font-pixel text-royal">{g.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <PixelLabel>ゲストの連携の結果（件数）</PixelLabel>
            <p className="mt-1 text-[11px] text-inksoft">
              「既存アカウントと衝突」はお試しのデータが宙に浮くケース。増えるならマージ導線が要る。
            </p>
            {a.funnel.oauthOutcomes.length === 0 ? (
              <p className="mt-2 text-[12px] text-inksoft">まだ記録がありません。</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {a.funnel.oauthOutcomes.map((o) => (
                  <li key={o.outcome} className="flex justify-between border-b border-grid8 py-1 text-[12.5px]">
                    <span>{OUTCOME_LABELS[o.outcome] ?? o.outcome}</span>
                    <span className="font-pixel text-royal">{o.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Window>

      {/* 定着 */}
      <Window title="RETENTION" titleEm=".log">
        <PixelLabel>登録週ごとの定着 — 登録からN日以上あとに戻ってきた人の割合</PixelLabel>
        <p className="mt-1.5 text-[12px] text-inksoft">
          「—」はまだその日数が経っていないコホート。D1が低ければ初日の体験、D7が低ければ翌週に戻る理由が弱い。
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b-2 border-line8 text-left font-pixel text-[10px] tracking-wide text-inksoft">
                <th className="py-2 pr-3">登録週（月曜）</th>
                <th className="px-2">人数</th>
                <th className="px-2">D1</th>
                <th className="px-2">D7</th>
                <th className="px-2">D30</th>
              </tr>
            </thead>
            <tbody>
              {a.retention.map((r) => (
                <tr key={r.weekStart} className="border-b border-grid8">
                  <td className="py-1.5 pr-3">{r.weekStart}</td>
                  <td className="px-2">{r.size}</td>
                  {[r.d1, r.d7, r.d30].map((v, i) => (
                    <td key={i} className="px-2">
                      {v === null || r.size === 0 ? "—" : `${v}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Window>

      {/* 機能利用 */}
      <Window title="FEATURES" titleEm=".log">
        <PixelLabel>機能ごとの利用 — 直近30日に使った人数 / 回数</PixelLabel>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b-2 border-line8 text-left font-pixel text-[10px] tracking-wide text-inksoft">
                <th className="py-2 pr-3">機能</th>
                <th className="px-2">人数</th>
                <th className="px-2">登録済みに対する割合</th>
                <th className="px-2">回数</th>
              </tr>
            </thead>
            <tbody>
              {a.features.map((f) => (
                <tr key={f.key} className="border-b border-grid8">
                  <td className="py-1.5 pr-3 font-bold">{f.label}</td>
                  <td className="px-2">{f.users}</td>
                  <td className="px-2">{pct(f.users, a.members)}</td>
                  <td className="px-2">{f.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Window>
    </div>
  );
}
