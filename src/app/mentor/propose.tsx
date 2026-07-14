"use client";

import { useState, useTransition } from "react";
import { proposeStudyTopics, type StudyTopic } from "@/app/actions";

// 週報の詰まりから学習トピックを先回り提案（本人がボタンで起動）。
// 各トピックの firstQuestion をhiddenで積んで、そのままメンターセッションを開始する。

export function ProposeTopics(props: {
  createAction: (formData: FormData) => void;
}) {
  const [topics, setTopics] = useState<StudyTopic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await proposeStudyTopics();
      setTopics(res.topics);
      if ("error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={run} className="btn8 btn8-start text-[12px]" disabled={pending}>
          {pending ? "SCANNING…" : "▶ 週報の詰まりから提案をもらう"}
        </button>
        {topics && topics.length === 0 && !pending && (
          <span className="text-[12px] text-inksoft">
            提案の材料になる「詰まりごと」がまだありません。週報を書くと出ます。
          </span>
        )}
      </div>
      {error && <p className="text-[12px] text-crit">{error}</p>}
      {topics && topics.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {topics.map((t, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border-2 border-line8 bg-surface p-3 shadow-hard-sm"
            >
              <p className="text-[14px] font-extrabold">{t.title}</p>
              <p className="text-[12.5px] text-inksoft">{t.why}</p>
              <form action={props.createAction} className="mt-auto">
                <input type="hidden" name="topic" value={t.title} />
                <input type="hidden" name="firstMessage" value={t.firstQuestion} />
                <button className="btn8 btn8-ok w-full text-[12px]">
                  ▶ メンターに聞く
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
