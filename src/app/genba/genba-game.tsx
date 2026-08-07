"use client";

// GENBA.sim のゲーム画面（1画面フェーズ切替: オフィス⇄面接⇄現場⇄精算）。
// イベントの「表示」は seed から共有ロジックで再現し、「成否」は必ずサーバー（actions.ts）が返す。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PixelAvatar } from "@/components/pixel-avatar";
import { Window } from "@/components/retro";
import {
  GENBA,
  interviewPlan,
  npcById,
  offerTemplateById,
  themeById,
  type GenbaTheme,
} from "@/lib/genba/content";
import { eventForDay } from "@/lib/genba/logic";
import { NpcSprite } from "./npc-sprite";
import { applyToOffer, workChoice, type DayResult } from "./actions";

export type OfferView = {
  offerId: string;
  templateId: string;
  theme: GenbaTheme;
  title: string;
  client: string;
  work: string;
  skills: { name: string; level: number; ownedLevel: number }[];
  rate: number;
  days: number;
  stars: number; // 相性 0-5
  blocked: boolean; // 本日面接NG
  era: { period: string } | null; // きおくの現場（星の代わりに年代を出す）
};

export type ActiveView = {
  day: number; // 消化済み現場日数
  totalDays: number;
  title: string;
  theme: GenbaTheme;
  templateId: string;
  rate: number;
  trust: number;
  stamina: number;
  strikes: number;
  seed: number;
};

type HistoryRow = {
  title: string;
  status: string;
  payout: number;
  days: number;
  totalDays: number;
};

// ---- 小物 ----

function Gauge(props: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex justify-between text-[11px]">
        <span>{props.label}</span>
        <span className="tabular-nums">{props.value}</span>
      </div>
      <div className="h-[10px] border-2 border-[var(--ink)] bg-white/40">
        <div
          className="h-full transition-all"
          style={{ width: `${props.value}%`, background: props.color }}
        />
      </div>
    </div>
  );
}

function Stars(props: { n: number }) {
  return (
    <span aria-label={`相性 星${props.n}`} className="text-[12px] tracking-tight">
      {"★".repeat(props.n)}
      <span className="opacity-30">{"★".repeat(5 - props.n)}</span>
    </span>
  );
}

function EnBadge(props: { balance: number }) {
  return (
    <span className="font-pixel inline-flex items-center gap-1 border-2 border-[var(--ink)] bg-[var(--lemon)] px-2 py-[2px] text-[12px] tabular-nums">
      {props.balance.toLocaleString()} <em className="not-italic text-[10px]">EN</em>
    </span>
  );
}

function Bubble(props: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1 rounded-none border-2 border-[var(--ink)] bg-white p-3 text-[13px] leading-relaxed text-[#24292a] dark:bg-[#2a2a26] dark:text-[#e6e9e1]">
      <span className="absolute -left-[10px] top-4 h-0 w-0 border-y-8 border-y-transparent border-r-8 border-r-[var(--ink)]" />
      {props.children}
    </div>
  );
}

// ---- 本体 ----

export function GenbaGame(props: {
  avatarSprite: string;
  avatarName: string;
  balance: number;
  salesTrust: number;
  salesCompleted: number;
  ownedSkills: [string, number][];
  active: ActiveView | null;
  offers: OfferView[] | null;
  history: HistoryRow[];
}) {
  const router = useRouter();
  const owned = new Map(props.ownedSkills);

  return props.active ? (
    <SiteView {...props} active={props.active} owned={owned} router={router} />
  ) : (
    <OfficeView {...props} owned={owned} router={router} />
  );
}

// ---- オフィス（案件紹介 → 面接） ----

function OfficeView(props: {
  balance: number;
  salesTrust: number;
  salesCompleted: number;
  offers: OfferView[] | null;
  history: HistoryRow[];
  owned: Map<string, number>;
  router: ReturnType<typeof useRouter>;
}) {
  const [interview, setInterview] = useState<OfferView | null>(null);
  const [blockedLocal, setBlockedLocal] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const offers = (props.offers ?? []).map((o) => ({
    ...o,
    blocked: o.blocked || blockedLocal.includes(o.offerId),
  }));

  if (interview) {
    return (
      <InterviewView
        offer={interview}
        owned={props.owned}
        onDone={(passed, reason) => {
          if (passed) {
            props.router.refresh();
          } else {
            setBlockedLocal((b) => [...b, interview.offerId]);
            setMessage(reason ?? null);
            setInterview(null);
          }
        }}
        onCancel={() => setInterview(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Window title="OFFICE" titleEm=".sim">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px]">
            <span>えいぎょう信頼</span>
            <span className="tabular-nums font-pixel">{props.salesTrust}</span>
            <span className="opacity-60">満了 {props.salesCompleted}件</span>
          </div>
          <EnBadge balance={props.balance} />
        </div>
        <div className="flex items-start gap-3">
          <div className="shrink-0 text-center">
            <NpcSprite npc="hato" px={5} />
            <p className="mt-1 text-[10px]">ハトリさん</p>
          </div>
          <Bubble>
            {message ? (
              <>{message}</>
            ) : (
              <>
                いい案件、入りました！　きょうは{offers.length}件です。
                <br />
                <span className="text-[11px] opacity-70">
                  相性★はあなたのスキルマップとの一致度。背伸びは単価が良いぶん、現場がきびしい…
                </span>
              </>
            )}
          </Bubble>
        </div>
      </Window>

      {offers.map((o) => {
        const theme = themeById(o.theme);
        return (
          <Window key={o.offerId} title={theme?.name ?? o.theme} titleEm=".job" className={o.blocked ? "opacity-60" : ""}>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-bold">{o.title}</h2>
                {o.era ? (
                  <span className="font-pixel shrink-0 border-2 border-[var(--ink)] bg-[var(--lemon)] px-1.5 py-[2px] text-[10px]">
                    {o.era.period}
                  </span>
                ) : (
                  <Stars n={o.stars} />
                )}
              </div>
              <p className="text-[12px] opacity-80">
                {o.client} ／ {o.work}
              </p>
              <p className="text-[11px] opacity-60">{theme?.flavor}</p>
              {o.era ? (
                <p className="text-[11px]">
                  🕰 もう存在しない現場への、妙な案件。スキル不問——単価は当時の相場です
                </p>
              ) : (
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {o.skills.map((s) => (
                    <span
                      key={s.name}
                      className={`border-2 border-[var(--ink)] px-1.5 py-[1px] ${
                        s.ownedLevel >= s.level
                          ? "bg-[var(--good,#2e9e5b)] text-white"
                          : s.ownedLevel > 0
                            ? "bg-[var(--lemon)]"
                            : "bg-white/50"
                      }`}
                    >
                      {s.name} Lv{s.level}
                      {s.ownedLevel > 0 && (
                        <em className="not-italic opacity-80">（自分{s.ownedLevel}）</em>
                      )}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <p className="font-pixel text-[13px] tabular-nums">
                  {o.rate} EN/日 × {o.days}日
                </p>
                {o.blocked ? (
                  <span className="text-[11px] opacity-70">本日の面接はNGでした</span>
                ) : (
                  <button
                    className="btn8 btn8-ok text-[12px]"
                    onClick={() => setInterview(o)}
                  >
                    面接にすすむ ▶
                  </button>
                )}
              </div>
            </div>
          </Window>
        );
      })}

      {props.history.length > 0 && (
        <Window title="KEIREKI" titleEm=".log" bodyClass="p-4">
          <ul className="space-y-1 text-[12px]">
            {props.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{h.title}</span>
                <span className="shrink-0 tabular-nums">
                  {h.status === "COMPLETED" ? (
                    <span className="text-[var(--good,#2e9e5b)]">満了</span>
                  ) : (
                    <span className="text-[var(--crit,#e5484d)]">
                      退場({h.days}/{h.totalDays})
                    </span>
                  )}{" "}
                  +{h.payout.toLocaleString()}EN
                </span>
              </li>
            ))}
          </ul>
        </Window>
      )}

      <p className="text-[12px]">
        <Link href="/genba/album" className="underline">
          📔 きおくのアルバム — 消えた現場の記録
        </Link>
      </p>
    </div>
  );
}

// ---- 面接 ----

function InterviewView(props: {
  offer: OfferView;
  owned: Map<string, number>;
  onDone: (passed: boolean, reason?: string) => void;
  onCancel: () => void;
}) {
  // qIdx = -1 は ①プロジェクト説明（採点なし・相槌のみ）。0以降が採点対象の設問
  const [qIdx, setQIdx] = useState(-1);
  const [answers, setAnswers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const template = offerTemplateById(props.offer.templateId);
  const theme = themeById(props.offer.theme);
  const interviewer = npcById(theme?.interviewer ?? "owl")!;
  if (!template || !theme) return null;
  const plan = interviewPlan(template);
  const q = qIdx >= 0 ? plan.questions[qIdx] : null;
  const phaseLabel =
    qIdx < 0 ? "① プロジェクト説明" : q!.phase === "経歴書" ? "② 経歴書の説明" : "③ 質疑応答";

  const pick = (i: number) => {
    const next = [...answers, i];
    if (qIdx + 1 < plan.questions.length) {
      setAnswers(next);
      setQIdx(qIdx + 1);
      return;
    }
    startTransition(async () => {
      try {
        const res = await applyToOffer(props.offer.offerId, next);
        if (res.passed) props.onDone(true);
        else props.onDone(false, res.reason);
      } catch (e) {
        setError(e instanceof Error ? e.message : "面接に失敗しました。再読み込みしてください");
        setAnswers([]);
        setQIdx(-1);
      }
    });
  };

  return (
    <Window title="MENSETSU" titleEm=".sim" barClass="!bg-pinkhot">
      <p className="mb-2 flex justify-between gap-2 text-[12px] opacity-70">
        <span className="truncate">
          {props.offer.title} ／ 面接官: {interviewer.name}（{interviewer.role}）
        </span>
        <span className="shrink-0 font-bold">{phaseLabel}</span>
      </p>
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center">
          <NpcSprite npc={interviewer.id} px={5} />
        </div>
        <Bubble>{pending ? "（結果を待っている…）" : (q?.ask ?? plan.intro)}</Bubble>
      </div>
      {error && <p className="mt-2 text-[12px] text-[var(--crit,#e5484d)]">{error}</p>}
      <div className="mt-3 space-y-2">
        {q === null ? (
          <button
            className="btn8 block w-full text-left text-[12.5px]"
            onClick={() => setQIdx(0)}
            disabled={pending}
          >
            「よろしくお願いします」（経歴書を取り出す）
          </button>
        ) : (
          q.choices.map((c, i) => {
            const locked = !!c.needSkill && !props.owned.has(c.needSkill);
            return (
              <button
                key={i}
                disabled={locked || pending}
                onClick={() => pick(i)}
                className="btn8 block w-full text-left text-[12.5px] disabled:opacity-50"
              >
                {locked ? `🔒 ${c.label}（要承認スキル: ${c.needSkill}）` : c.label}
              </button>
            );
          })
        )}
      </div>
      <div className="mt-3 flex justify-between text-[11px] opacity-70">
        <span>
          {qIdx < 0 ? "案件のせつめいを聞いている…" : `しつもん ${qIdx + 1}/${plan.questions.length}`}
        </span>
        <button className="underline" onClick={props.onCancel} disabled={pending}>
          辞退して戻る
        </button>
      </div>
    </Window>
  );
}

// ---- 現場 ----

function SiteView(props: {
  avatarSprite: string;
  avatarName: string;
  balance: number;
  active: ActiveView;
  owned: Map<string, number>;
  router: ReturnType<typeof useRouter>;
}) {
  const a = props.active;
  const [day, setDay] = useState(a.day + 1); // いま挑む現場日
  const [trust, setTrust] = useState(a.trust);
  const [stamina, setStamina] = useState(a.stamina);
  const [strikes, setStrikes] = useState(a.strikes);
  const [result, setResult] = useState<DayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const theme = themeById(a.theme);
  const event = eventForDay(a.seed, a.theme, day);
  const npc = npcById(event.npc)!;
  const choose = (i: number) => {
    startTransition(async () => {
      try {
        setError(null);
        const res = await workChoice(day, i);
        setResult(res);
        setTrust(res.trust);
        setStamina(res.stamina);
        setStrikes(res.strikes);
      } catch (e) {
        setError(e instanceof Error ? e.message : "通信に失敗しました");
      }
    });
  };

  // 精算画面（満了 or 途中退場）
  if (result && result.status !== "ACTIVE") {
    const completed = result.status === "COMPLETED";
    return (
      <Window
        title="SEISAN"
        titleEm=".sim"
        barClass={completed ? "" : "!bg-pinkhot"}
      >
        <div className="space-y-3 text-center">
          <p className="font-pixel text-[16px]">
            {completed ? "🎉 契約満了！" : "⚠ 途中退場…"}
          </p>
          {result.text && (
            <p className="mx-auto max-w-md text-left text-[12.5px] opacity-80">
              {result.text}
            </p>
          )}
          <p className="text-[13px]">
            {completed
              ? `${a.totalDays}日間、走りきった。ハトリさんの信頼も上がった。`
              : "求められる成果を上げられなかった。次の現場で取り返そう。"}
          </p>
          <div className="mx-auto max-w-xs border-2 border-[var(--ink)] bg-white/60 p-3 text-left text-[12.5px] tabular-nums dark:bg-white/10">
            <div className="flex justify-between">
              <span>単価 {a.rate}EN × {result.day}日</span>
              <span>{(a.rate * result.day).toLocaleString()}EN</span>
            </div>
            {completed ? (
              <div className="flex justify-between">
                <span>満了ボーナス（しんらい×2）</span>
                <span>+{result.bonus.toLocaleString()}EN</span>
              </div>
            ) : (
              <div className="flex justify-between text-[var(--crit,#e5484d)]">
                <span>途中退場 精算率60%</span>
                <span>×0.6</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t-2 border-[var(--ink)] pt-1 font-bold">
              <span>お振込</span>
              <span>+{(result.payout ?? 0).toLocaleString()}EN</span>
            </div>
          </div>
          <button className="btn8 btn8-ok text-[13px]" onClick={() => props.router.refresh()}>
            オフィスへもどる ▶
          </button>
        </div>
      </Window>
    );
  }

  return (
    <div className="space-y-4">
      <Window title={theme?.name ?? a.theme} titleEm=".site">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-bold">{a.title}</p>
          <p className="shrink-0 font-pixel text-[12px] tabular-nums">
            {a.rate}EN/日
          </p>
        </div>
        <div className="mb-2 flex items-center gap-3 text-[11px]">
          <span className="tabular-nums">
            {Math.min(day, a.totalDays)}日目 / {a.totalDays}日
          </span>
          <span aria-label={`しくじり ${strikes}/3`}>
            {"⚠".repeat(strikes)}
            <span className="opacity-25">{"⚠".repeat(Math.max(0, GENBA.MAX_STRIKES - strikes))}</span>
          </span>
        </div>
        <div className="flex gap-3">
          <Gauge label="しんらい" value={trust} color="var(--good, #2e9e5b)" />
          <Gauge label="たいりょく" value={stamina} color="var(--warn, #e8a013)" />
        </div>
      </Window>

      {result ? (
        <Window title="KEKKA" titleEm=".log">
          <div className="flex items-start gap-3">
            <div className="shrink-0 text-center">
              <NpcSprite npc={event.npc} px={5} />
            </div>
            <Bubble>
              <p className="mb-1 font-bold">
                {result.ok ? "✔ うまくいった" : result.forced ? "⚠ たいりょくが尽きた…" : "⚠ しくじった…"}
              </p>
              {result.text}
            </Bubble>
          </div>
          <div className="mt-3 text-center">
            <button
              className="btn8 btn8-ok text-[13px]"
              onClick={() => {
                setResult(null);
                setDay(result.day + 1);
              }}
            >
              つぎの日へ ▶
            </button>
          </div>
        </Window>
      ) : (
        <Window title={`DAY ${day}`} titleEm=".ev">
          <div className="flex items-start gap-3">
            <div className="shrink-0 text-center">
              <NpcSprite npc={event.npc} px={5} />
              <p className="mt-1 text-[10px]">
                {npc.name}
                <br />
                <span className="opacity-60">{npc.role}</span>
              </p>
            </div>
            <Bubble>{event.text}</Bubble>
          </div>
          {error && (
            <p className="mt-2 text-[12px] text-[var(--crit,#e5484d)]">{error}</p>
          )}
          <div className="mt-3 space-y-2">
            {event.choices.map((c, i) => {
              const locked = !!c.needSkill && !props.owned.has(c.needSkill);
              const hasTag = !!c.skillTag && props.owned.has(c.skillTag);
              return (
                <button
                  key={i}
                  disabled={locked || pending}
                  onClick={() => choose(i)}
                  className="btn8 block w-full text-left text-[12.5px] disabled:opacity-50"
                >
                  {locked ? `🔒 ${c.label}` : c.label}
                  <span className="ml-1 text-[10.5px] opacity-70">
                    {hasTag && (
                      <em className="not-italic text-[var(--good,#2e9e5b)]">
                        ★{c.skillTag}
                      </em>
                    )}
                    {c.stamina != null && c.stamina < 0 && ` たいりょく${c.stamina}`}
                    {c.stamina != null && c.stamina > 0 && ` たいりょく+${c.stamina}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <PixelAvatar sprite={props.avatarSprite} px={4} />
            <p className="text-[11px] opacity-70">
              {props.avatarName}のあなたが、現場で選択を迫られている——
            </p>
          </div>
        </Window>
      )}
    </div>
  );
}
