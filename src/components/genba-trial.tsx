"use client";

// げんば体験版（チュートリアル内で遊ぶ縮小版）。
// 本物の案件・面接・現場イベント辞書をそのまま使い、面接→現場2日→見込み精算までを
// クライアントだけで完結させる。DBには触れず、ENもEXPも出ない（報酬なしの「味見」）。
// 成否の式は src/lib/genba/trial.ts（本番 actions.ts と同じ）。

import { useState } from "react";
import {
  GENBA,
  interviewPlan,
  npcById,
  themeById,
} from "@/lib/genba/content";
import { eventForDay } from "@/lib/genba/logic";
import {
  TRIAL_DAYS,
  resolveTrialDay,
  trialInterviewPass,
  trialOffer,
  trialOwnedSkills,
  trialProjection,
  type TrialDayResult,
} from "@/lib/genba/trial";
import { NpcSprite } from "@/app/genba/npc-sprite";

type Phase = "offer" | "interview" | "rejected" | "site" | "settle";

function Bubble(props: { children: React.ReactNode }) {
  return (
    <div className="relative min-w-0 flex-1 border-2 border-[var(--ink)] bg-white p-2.5 text-[12.5px] leading-relaxed text-[#24292a] dark:bg-[#2a2a26] dark:text-[#e6e9e1]">
      <span className="absolute -left-[10px] top-3 h-0 w-0 border-y-8 border-y-transparent border-r-8 border-r-[var(--ink)]" />
      {props.children}
    </div>
  );
}

function Npc(props: { id: Parameters<typeof NpcSprite>[0]["npc"]; caption?: boolean }) {
  const npc = npcById(props.id);
  return (
    <div className="shrink-0 text-center">
      <NpcSprite npc={props.id} px={4} />
      {props.caption && npc && (
        <p className="mt-1 text-[10px] leading-tight">
          {npc.name}
          <br />
          <span className="opacity-60">{npc.role}</span>
        </p>
      )}
    </div>
  );
}

function Gauge(props: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex justify-between text-[10.5px]">
        <span>{props.label}</span>
        <span className="tabular-nums">{props.value}</span>
      </div>
      <div className="h-[8px] border-2 border-[var(--ink)] bg-white/40">
        <div className="h-full" style={{ width: `${props.value}%`, background: props.color }} />
      </div>
    </div>
  );
}

function Bar(props: { title: string; em: string; pink?: boolean }) {
  return (
    <p
      className={`font-pixel text-[11px] tracking-wide text-white ${props.pink ? "bg-pinkhot" : "bg-royal"} px-2 py-1`}
    >
      {props.title}
      <em className="not-italic text-peri">{props.em}</em>
    </p>
  );
}

export function GenbaTrial() {
  const offer = trialOffer();
  const theme = themeById(offer.theme)!;
  const owned = trialOwnedSkills(offer);
  const plan = interviewPlan(offer);
  const interviewer = npcById(theme.interviewer)!;

  const [phase, setPhase] = useState<Phase>("offer");
  // 面接: -1 はプロジェクト説明（採点なし）。0以降が設問
  const [qIdx, setQIdx] = useState(-1);
  const [mod, setMod] = useState(0);
  // 現場: 遊ぶたびにイベントの並びが変わるよう seed はマウント時に振る（SSRしない前提）
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [day, setDay] = useState(1);
  const [trust, setTrust] = useState<number>(GENBA.START_TRUST);
  const [stamina, setStamina] = useState<number>(GENBA.START_STAMINA);
  const [strikes, setStrikes] = useState(0);
  const [result, setResult] = useState<TrialDayResult | null>(null);

  function restart() {
    setPhase("offer");
    setQIdx(-1);
    setMod(0);
    setSeed(Math.floor(Math.random() * 0x7fffffff));
    setDay(1);
    setTrust(GENBA.START_TRUST);
    setStamina(GENBA.START_STAMINA);
    setStrikes(0);
    setResult(null);
  }

  const frame = "w-full border-[2.5px] border-line8 bg-surface text-left shadow-hard-sm";

  // ---- 案件紹介 ----
  if (phase === "offer") {
    return (
      <div className={frame}>
        <Bar title="OFFICE" em=".sim" />
        <div className="space-y-2 p-3">
          <div className="flex items-start gap-2.5">
            <Npc id="hato" caption />
            <Bubble>
              お試しの案件、入りました！　まずはこれで“げんば”の一日を味わってみてください。
            </Bubble>
          </div>
          <div className="border-2 border-[var(--ink)] bg-white/60 p-2.5 dark:bg-white/10">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-bold">{offer.title}</p>
              <span className="shrink-0 text-[11px]" aria-label="相性 星5">
                ★★★★★
              </span>
            </div>
            <p className="text-[11px] opacity-80">
              {offer.client} ／ {offer.work}
            </p>
            <p className="text-[10.5px] opacity-60">{theme.flavor}</p>
            <div className="mt-1.5 flex flex-wrap gap-1 text-[10.5px]">
              {offer.skills.map((s) => (
                <span
                  key={s.name}
                  className="border-2 border-[var(--ink)] bg-[var(--good,#2e9e5b)] px-1.5 py-[1px] text-white"
                >
                  {s.name} Lv{s.level}
                </span>
              ))}
            </div>
            <p className="mt-1.5 font-pixel text-[12px] tabular-nums">
              {offer.rate} EN/日 × {offer.days}日
            </p>
          </div>
          <p className="text-[10.5px] opacity-70">
            本番では相性★はスキルマップとの一致度。体験中はぴったり（★5）扱いです。
          </p>
          <button className="btn8 btn8-ok w-full text-[12px]" onClick={() => setPhase("interview")}>
            面接にすすむ ▶
          </button>
        </div>
      </div>
    );
  }

  // ---- 面接 ----
  if (phase === "interview") {
    const q = qIdx >= 0 ? plan.questions[qIdx] : null;
    const phaseLabel =
      qIdx < 0 ? "① プロジェクト説明" : q!.phase === "経歴書" ? "② 経歴書の説明" : "③ 質疑応答";
    const pick = (i: number) => {
      const c = q!.choices[i];
      const nextMod = mod + c.mod;
      if (qIdx + 1 < plan.questions.length) {
        setMod(nextMod);
        setQIdx(qIdx + 1);
        return;
      }
      setPhase(trialInterviewPass(nextMod) ? "site" : "rejected");
    };
    return (
      <div className={frame}>
        <Bar title="MENSETSU" em=".sim" pink />
        <div className="space-y-2 p-3">
          <p className="flex justify-between gap-2 text-[10.5px] opacity-70">
            <span className="truncate">
              面接官: {interviewer.name}（{interviewer.role}）
            </span>
            <span className="shrink-0 font-bold">{phaseLabel}</span>
          </p>
          <div className="flex items-start gap-2.5">
            <Npc id={interviewer.id} />
            <Bubble>{q?.ask ?? plan.intro}</Bubble>
          </div>
          <div className="space-y-1.5">
            {q === null ? (
              <button className="btn8 block w-full text-left text-[12px]" onClick={() => setQIdx(0)}>
                「よろしくお願いします」（経歴書を取り出す）
              </button>
            ) : (
              q.choices.map((c, i) => {
                const locked = !!c.needSkill && !owned.has(c.needSkill);
                return (
                  <button
                    key={i}
                    disabled={locked}
                    onClick={() => pick(i)}
                    className="btn8 block w-full text-left text-[12px] disabled:opacity-50"
                  >
                    {locked ? `🔒 ${c.label}（要承認スキル: ${c.needSkill}）` : c.label}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-[10.5px] opacity-70">
            {qIdx < 0
              ? "案件のせつめいを聞いている…"
              : `しつもん ${qIdx + 1}/${plan.questions.length}。受け答えで通過率が上下するよ`}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "rejected") {
    return (
      <div className={frame}>
        <Bar title="OFFICE" em=".sim" />
        <div className="space-y-2 p-3">
          <div className="flex items-start gap-2.5">
            <Npc id="hato" caption />
            <Bubble>お見送りの連絡が来た。ハトリさんが少し悲しそうだ。</Bubble>
          </div>
          <p className="text-[10.5px] opacity-70">
            本番だと同じ案件は翌日まで受け直せないけど、体験中は何度でも。
          </p>
          <button className="btn8 btn8-ok w-full text-[12px]" onClick={restart}>
            もう一度 面接を受ける ▶
          </button>
        </div>
      </div>
    );
  }

  // ---- 見込み精算 ----
  if (phase === "settle") {
    const proj = trialProjection(offer, trust);
    return (
      <div className={frame}>
        <Bar title="SEISAN" em=".sim" />
        <div className="space-y-2 p-3">
          <p className="text-center font-pixel text-[14px]">お試しは ここまで！</p>
          <p className="text-[12px]">
            本番はこの調子で{offer.days}日を走りきると、こんな精算に。
          </p>
          <div className="border-2 border-[var(--ink)] bg-white/60 p-2.5 text-[12px] tabular-nums dark:bg-white/10">
            <div className="flex justify-between">
              <span>
                単価 {offer.rate}EN × {offer.days}日
              </span>
              <span>{proj.base.toLocaleString()}EN</span>
            </div>
            <div className="flex justify-between">
              <span>満了ボーナス（しんらい{trust}×2）</span>
              <span>+{proj.bonus.toLocaleString()}EN</span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-[var(--ink)] pt-1 font-bold">
              <span>お振込（見込み）</span>
              <span>{proj.total.toLocaleString()}EN</span>
            </div>
          </div>
          <p className="text-[10.5px] opacity-70">
            体験モードなので振込はありません。稼いだENはおかいものでマイホームの家具になるよ。
          </p>
          <button className="btn8 w-full text-[12px]" onClick={restart}>
            もう一度あそぶ
          </button>
        </div>
      </div>
    );
  }

  // ---- 現場 ----
  const event = eventForDay(seed, offer.theme, day);
  const choose = (i: number) => {
    const res = resolveTrialDay(event, i, { trust, stamina, strikes }, owned);
    setResult(res);
    setTrust(res.trust);
    setStamina(res.stamina);
    setStrikes(res.strikes);
  };
  return (
    <div className={frame}>
      <Bar title={`DAY ${day}`} em={`.ev  ${theme.name}`} />
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-3 text-[10.5px]">
          <span className="tabular-nums">
            {day}日目 / 体験{TRIAL_DAYS}日
          </span>
          <span aria-label={`しくじり ${strikes}/3`}>
            {"⚠".repeat(strikes)}
            <span className="opacity-25">
              {"⚠".repeat(Math.max(0, GENBA.MAX_STRIKES - strikes))}
            </span>
          </span>
        </div>
        <div className="flex gap-3">
          <Gauge label="しんらい" value={trust} color="var(--good, #2e9e5b)" />
          <Gauge label="たいりょく" value={stamina} color="var(--warn, #e8a013)" />
        </div>
        {result ? (
          <>
            <div className="flex items-start gap-2.5">
              <Npc id={event.npc} />
              <Bubble>
                <p className="mb-1 font-bold">
                  {result.ok ? "✔ うまくいった" : result.forced ? "⚠ たいりょくが尽きた…" : "⚠ しくじった…"}
                </p>
                {result.text}
              </Bubble>
            </div>
            <button
              className="btn8 btn8-ok w-full text-[12px]"
              onClick={() => {
                setResult(null);
                if (day >= TRIAL_DAYS) setPhase("settle");
                else setDay(day + 1);
              }}
            >
              {day >= TRIAL_DAYS ? "精算へ ▶" : "つぎの日へ ▶"}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2.5">
              <Npc id={event.npc} caption />
              <Bubble>{event.text}</Bubble>
            </div>
            <div className="space-y-1.5">
              {event.choices.map((c, i) => {
                const locked = !!c.needSkill && !owned.has(c.needSkill);
                const hasTag = !!c.skillTag && owned.has(c.skillTag);
                return (
                  <button
                    key={i}
                    disabled={locked}
                    onClick={() => choose(i)}
                    className="btn8 block w-full text-left text-[12px] disabled:opacity-50"
                  >
                    {locked ? `🔒 ${c.label}` : c.label}
                    <span className="ml-1 text-[10px] opacity-70">
                      {hasTag && (
                        <em className="not-italic text-[var(--good,#2e9e5b)]">★{c.skillTag}</em>
                      )}
                      {c.stamina != null && c.stamina < 0 && ` たいりょく${c.stamina}`}
                      {c.stamina != null && c.stamina > 0 && ` たいりょく+${c.stamina}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
