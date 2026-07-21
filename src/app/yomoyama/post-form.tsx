"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postYomoyama } from "./actions";
import { MicButton } from "@/components/mic-button";
import { notify } from "@/components/toast";

// よもやまの投稿フォーム。AI門番でブロックされたら理由をその場に表示し、
// 本人が直して再投稿できるようにする。

export function PostForm(props: { onPosted?: () => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setError(null);
    setIssues([]);
    start(async () => {
      const res = await postYomoyama(text);
      if (res.ok) {
        setBody("");
        props.onPosted?.();
        notify("ok", "投稿しました");
        router.refresh();
      } else {
        setError(res.error);
        setIssues(res.issues ?? []);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={1000}
          disabled={pending}
          placeholder="現場のできごとを一言…"
          className="field8"
        />
        <MicButton
          disabled={pending}
          onText={(t) => setBody((v) => (v ? `${v} ${t}` : t))}
        />
      </div>

      {error && (
        <div className="rounded-lg border-2 border-pinkhot bg-quotebg px-3 py-2">
          <p className="font-pixel text-[11px] tracking-wide text-pinkhot">
            ⚠ 投稿できませんでした
          </p>
          <p className="mt-1 text-[12.5px] text-ink">{error}</p>
          {issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[11.5px] text-inksoft">
              {issues.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="font-pixel text-[10px] tracking-wide text-inksoft">
          {pending ? "AIが確認中…" : "AIチェックを通ると掲載されます"}
        </span>
        <button
          type="submit"
          className="btn8 btn8-start text-[12px]"
          disabled={pending || !body.trim()}
        >
          {pending ? "確認中…" : "▶ 投稿する"}
        </button>
      </div>
    </form>
  );
}
