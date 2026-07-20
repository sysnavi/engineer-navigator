"use client";

// レアキャラ来訪のフローティングUI + 会話モーダル（Issue #2）。
// きょうの Encounter が PENDING の間だけ画面隅に現れる。話しかけるのは任意
// （閉じてもその日のうちなら再度話せる。日が変わると EXPIRED=逃した）。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { speciesById, TALK_TREES, type TalkNode } from "@/lib/pets/species";
import { judgeTalk, aiTalkStep, namePet } from "@/app/home/actions";

type Phase =
  | "idle"
  | "first"
  | "second"
  | "ai"
  | "judging"
  | "befriended"
  | "fled";
type AiTurn = { role: "user" | "pet"; text: string };

export function Visitor(props: {
  encounterId: string;
  speciesId: string;
  aiEnabled: boolean;
}) {
  const species = speciesById(props.speciesId);
  const [phase, setPhase] = useState<Phase>("idle");
  const [choices, setChoices] = useState<number[]>([]);
  const [reply, setReply] = useState<string | null>(null);
  const [aiLog, setAiLog] = useState<AiTurn[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [petId, setPetId] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [named, setNamed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!species) return null;
  const tree = TALK_TREES[species.personality];
  const happy = species.sprites.happy ?? species.sprites.normal;
  // 判定が確定した＝この子との今日の出会いは終わっている（DBもPENDINGではない）
  const resolved = phase === "befriended" || phase === "fled";

  const pickChoice = (node: TalkNode, idx: number) => {
    const c = node.choices[idx];
    setReply(c.reply);
    const nextChoices = [...choices, idx];
    setChoices(nextChoices);
    if (c.next === "second") {
      setTimeout(() => {
        setReply(null);
        setPhase("second");
      }, 1400);
    } else {
      setPhase("judging");
      startTransition(async () => {
        try {
          const r = await judgeTalk(props.encounterId, nextChoices);
          if (r.befriended && r.petId) {
            setPetId(r.petId);
            setPetName(species.name);
            setPhase("befriended");
          } else {
            setPhase("fled");
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "会話に失敗しました");
        }
      });
    }
  };

  const sendAi = () => {
    const text = aiInput.trim();
    if (!text || pending) return;
    const log: AiTurn[] = [...aiLog, { role: "user", text }];
    setAiLog(log);
    setAiInput("");
    startTransition(async () => {
      try {
        const r = await aiTalkStep(props.encounterId, log);
        setAiLog((l) => [...l, { role: "pet", text: r.reply }]);
        if (r.verdict) {
          setTimeout(() => {
            if (r.verdict!.befriended) {
              setPetName(species.name);
              setPhase("befriended");
              // AI経路は petId を返さないため名前付けは /home 側でも可能にしてある
            } else {
              setPhase("fled");
            }
          }, 1600);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "会話に失敗しました");
      }
    });
  };

  const saveName = () => {
    if (!petId) {
      setNamed(true);
      return;
    }
    startTransition(async () => {
      try {
        await namePet(petId, petName);
        setNamed(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "名前をつけられませんでした");
      }
    });
  };

  const close = () => {
    setReply(null);
    setError(null);
    // 会話が済んだ子は二度と現れない。サーバー側の再取得（router.refresh）を
    // 待つ間もフローティングに戻さないよう、resolved なら以降は何も描かない。
    // ここを phase="idle" に戻すと、仲間になったのに左下に居座って見える。
    if (resolved) {
      setDismissed(true);
    } else {
      setPhase("idle");
    }
    router.refresh();
  };

  // 判定が済んだあとは、この来訪者のUIは役目を終えている
  if (dismissed) return null;

  // ===== 待機（画面隅でとことこ） =====
  if (phase === "idle") {
    return (
      <button
        onClick={() => setPhase("first")}
        className="no-print fixed bottom-16 left-3 z-40 flex flex-col items-center gap-0.5 sm:bottom-20"
        aria-label={`${species.name}が遊びに来ています。話しかける`}
      >
        <span className="rounded-md border-2 border-line8 bg-win px-1.5 py-0.5 font-pixel text-[9.5px] tracking-wide text-ink shadow-hard-sm">
          👋 …？
        </span>
        <span className="alien-patapata block drop-shadow-[3px_3px_0_rgba(18,35,95,0.3)]">
          <Image
            src={species.sprites.normal}
            alt=""
            width={56}
            height={56}
            style={{ imageRendering: "pixelated" }}
            unoptimized
          />
        </span>
      </button>
    );
  }

  // ===== 会話モーダル =====
  const node = phase === "second" ? tree.second : tree.first;
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-[rgba(18,35,95,0.55)] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border-[2.5px] border-line8 bg-win shadow-hard">
        <div className="flex items-center justify-between bg-ink px-3 py-1.5 font-pixel text-[10.5px] tracking-[0.12em] text-white">
          <span>VISITOR.sys — {species.name}</span>
          {phase !== "befriended" && (
            <button onClick={close} className="text-white hover:text-pinkhot" aria-label="とじる">
              ×
            </button>
          )}
        </div>
        <div className="p-4">
          <div className="mb-3 flex justify-center">
            <span className={phase === "befriended" ? "hatch-born" : ""}>
              <Image
                src={phase === "befriended" || reply ? happy : species.sprites.normal}
                alt=""
                width={96}
                height={96}
                style={{ imageRendering: "pixelated" }}
                unoptimized
              />
            </span>
          </div>

          {error && <p className="mb-2 text-center text-[12px] font-bold text-[var(--crit)]">{error}</p>}

          {(phase === "first" || phase === "second") && (
            <>
              <div className="space-y-1 rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2 text-[13px] leading-relaxed">
                {/* 1ターン目は種族固有の第一声（性格ツリーの汎用導入とは重複させない） */}
                {(reply ? [reply] : phase === "first" ? [species.intro] : node.lines).map(
                  (l) => (
                    <p key={l}>{l.replaceAll("{name}", species.name)}</p>
                  )
                )}
              </div>
              {!reply && (
                <div className="mt-3 grid gap-2">
                  {node.choices.map((c, i) => (
                    <button
                      key={c.label}
                      className="btn8 px-3 py-2 text-left text-[12.5px]"
                      disabled={pending}
                      onClick={() => pickChoice(node, i)}
                    >
                      ▶ {c.label}
                    </button>
                  ))}
                  {props.aiEnabled && phase === "first" && (
                    <button
                      className="btn8 px-3 py-2 text-left text-[12.5px] !border-dashed"
                      onClick={() => setPhase("ai")}
                    >
                      💬 じぶんの言葉で話す（AI会話）
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {phase === "ai" && (
            <>
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2 text-[12.5px] leading-relaxed">
                <p className="text-inksoft">{species.intro}</p>
                {aiLog.map((t, i) => (
                  <p key={i} className={t.role === "user" ? "text-right" : ""}>
                    {t.role === "pet" && <b>{species.name}: </b>}
                    {t.text}
                  </p>
                ))}
                {pending && <p className="text-inksoft">…</p>}
              </div>
              <div className="mt-2.5 flex gap-2">
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendAi()}
                  maxLength={200}
                  placeholder="はなしかけてみる…（3往復で気持ちが決まる）"
                  className="field8 flex-1"
                />
                <button className="btn8 btn8-start px-4 text-[12px]" onClick={sendAi} disabled={pending}>
                  ▶
                </button>
              </div>
            </>
          )}

          {phase === "judging" && (
            <p className="py-3 text-center font-pixel text-[12px] tracking-[0.14em] text-royal">
              {species.name}は かんがえている…
            </p>
          )}

          {phase === "befriended" && (
            <div className="space-y-3 text-center">
              <p className="font-pixel text-[13px] tracking-[0.14em] text-pinkhot">
                ★ {species.name}が なかまになった！ ★
              </p>
              {!named ? (
                <div className="flex items-center justify-center gap-2">
                  <input
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    maxLength={12}
                    className="field8 w-40 text-center"
                    aria-label="なまえをつける"
                  />
                  <button className="btn8 btn8-start px-4 py-2 text-[12px]" onClick={saveName} disabled={pending}>
                    ▶ なまえ決定
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[13px]">
                    <b>{petName}</b> はマイホームに住みはじめた！
                  </p>
                  <Link href="/home" className="btn8 btn8-start inline-block px-5 py-2 text-[12.5px]" onClick={close}>
                    ▶ マイホームで会う
                  </Link>
                </>
              )}
            </div>
          )}

          {phase === "fled" && (
            <div className="space-y-3 text-center">
              <p className="text-[13px] leading-relaxed">
                {species.name}は そっと帰っていった…。
                <br />
                <span className="text-inksoft">（また いつか 会えるかもしれない）</span>
              </p>
              <button className="btn8 px-5 py-2 text-[12px]" onClick={close}>
                みおくる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
