"use client";

import { useRef, useState, useTransition } from "react";
import { saveReportDraft, submitReport } from "@/app/actions";
import { MicButton } from "@/components/mic-button";

// 週報フォーム（クライアント）。入力が止まったら自動で下書き保存する。

const CONDITIONS = [
  { value: 4, label: "☀️ 好調" },
  { value: 3, label: "🌤 普通" },
  { value: 2, label: "☁️ モヤモヤ" },
  { value: 1, label: "🌧 しんどい" },
];

const WORKLOADS = [
  { value: 4, label: "余裕あり" },
  { value: 3, label: "ちょうどいい" },
  { value: 2, label: "忙しい" },
  { value: 1, label: "限界が近い" },
];

const AUTOSAVE_DELAY_MS = 1800;

type ReportData = {
  conditionSelf: number | null;
  workloadSelf: number | null;
  didText: string | null;
  newText: string | null;
  struggleText: string | null;
  nextText: string | null;
  shareText: string | null;
};

function PillRow(props: {
  name: string;
  options: { value: number; label: string }[];
  defaultValue: number | null;
  required?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {props.options.map((o) => (
        <label key={o.value} className="pill8">
          <input
            type="radio"
            name={props.name}
            value={o.value}
            defaultChecked={props.defaultValue === o.value}
            required={props.required}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function Field(props: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | null;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // 音声認識テキストを末尾に追記し、自動保存のためにinputイベントを発火する
  function appendVoice(text: string) {
    const ta = ref.current;
    if (!ta) return;
    ta.value = ta.value ? `${ta.value} ${text}` : text;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  }

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-[13px] font-extrabold">
        {props.label}
        {props.required && <span className="text-pinkhot">*</span>}
      </label>
      <div className="flex items-start gap-2">
        <textarea
          ref={ref}
          name={props.name}
          rows={props.rows ?? 3}
          placeholder={props.placeholder}
          defaultValue={props.defaultValue ?? ""}
          required={props.required}
          className="field8"
        />
        <MicButton onText={appendVoice} title={`${props.label}を音声で入力`} />
      </div>
    </div>
  );
}

export function ReportForm(props: { report: ReportData | null; submitted: boolean }) {
  const r = props.report;
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [, startTransition] = useTransition();

  function scheduleAutosave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      setSaveState("saving");
      startTransition(async () => {
        try {
          await saveReportDraft(new FormData(form));
          setSaveState("saved");
        } catch {
          setSaveState("idle");
        }
      });
    }, AUTOSAVE_DELAY_MS);
  }

  return (
    <form
      ref={formRef}
      className="space-y-6"
      onInput={scheduleAutosave}
      onSubmit={() => {
        if (timer.current) clearTimeout(timer.current);
      }}
    >
      <div className="space-y-2">
        <p className="text-[13px] font-extrabold">
          1. 今週のコンディション <span className="text-pinkhot">*</span>
        </p>
        <PillRow
          name="conditionSelf"
          options={CONDITIONS}
          defaultValue={r?.conditionSelf ?? null}
          required
        />
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-extrabold">
          2. 稼働の体感 <span className="text-pinkhot">*</span>
        </p>
        <PillRow
          name="workloadSelf"
          options={WORKLOADS}
          defaultValue={r?.workloadSelf ?? null}
          required
        />
      </div>

      <Field
        name="didText"
        label="3. 今週やったこと"
        placeholder="・APIの結合テストを完了&#10;・レビュー指摘の修正"
        required
        defaultValue={r?.didText}
        rows={4}
      />
      <Field
        name="newText"
        label="4. 新しく触れた技術・初めてやったこと"
        placeholder="例: 初めてDockerのマルチステージビルドを書いた"
        defaultValue={r?.newText}
      />
      <Field
        name="struggleText"
        label="5. 詰まったこと・モヤモヤしていること"
        placeholder="技術的な詰まりも、現場の人間関係のことでもOK"
        defaultValue={r?.struggleText}
      />
      <Field
        name="nextText"
        label="6. 来週やること・やりたいこと"
        defaultValue={r?.nextText}
      />
      <Field
        name="shareText"
        label="7. AIメンターへの共有・相談"
        placeholder="メンターに聞きたいこと・共有したいこと"
        defaultValue={r?.shareText}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button formAction={submitReport} className="btn8 btn8-start">
          ▶ {props.submitted ? "さいていしゅつ" : "ていしゅつ"}
        </button>
        <button formAction={saveReportDraft} className="btn8">
          したがき保存
        </button>
        <span
          aria-live="polite"
          className="font-pixel text-[12px] tracking-[0.1em] text-royal2"
        >
          {saveState === "saving" && "SAVING…"}
          {saveState === "saved" && "SAVED ✓（自動保存）"}
        </span>
      </div>
      <p className="text-[11.5px] text-inksoft">
        提出するとAIが内容を解析し、スキルマップの更新提案と「今週の成長ポイント」を返します。
        設問5・7に書いた内容は、AIメンターが次の相談のコンテキストとして参照します。
        入力は自動で下書き保存されます。
      </p>
    </form>
  );
}
