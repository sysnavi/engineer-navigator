"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment } from "./actions";

// コメント投稿フォーム。投稿と同じAI門番を通すので、ブロック時は理由をその場に表示。
export function CommentForm(props: { postId: string }) {
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
      const res = await addComment(props.postId, text);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error);
        setIssues(res.issues ?? []);
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-1.5">
      <div className="flex items-end gap-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          maxLength={500}
          disabled={pending}
          placeholder="コメントする…（AIチェックあり）"
          className="field8"
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="btn8 btn8-start shrink-0 px-2.5 py-1 text-[11px]"
        >
          {pending ? "確認中…" : "返信"}
        </button>
      </div>
      {error && (
        <div className="rounded border-2 border-pinkhot bg-quotebg px-2 py-1 text-[11.5px] text-ink">
          {error}
          {issues.length > 0 && (
            <ul className="mt-0.5 list-inside list-disc text-[11px] text-inksoft">
              {issues.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
