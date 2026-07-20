"use client";

// 問い合わせフォーム（Issue #9）。送信結果をその場で出すためクライアント側で扱う。

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitInquiry } from "./actions";
import { INQUIRY_CATEGORIES, BODY_MAX, type InquiryCategory } from "@/lib/inquiry";

export function ContactForm(props: { loggedIn: boolean }) {
  const [category, setCategory] = useState<InquiryCategory>("bug");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [done, setDone] = useState<null | { savedToAccount: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("category", category);
      fd.set("body", body);
      if (!props.loggedIn && replyTo) fd.set("replyTo", replyTo);
      const r = await submitInquiry(fd);
      if (r.ok) {
        setDone({ savedToAccount: r.savedToAccount });
        setBody("");
        setReplyTo("");
        setError(null);
      } else {
        setError(r.error);
      }
    });
  };

  if (done) {
    return (
      <div className="space-y-3 py-2 text-center">
        <p className="font-pixel text-[15px] tracking-[0.14em] text-pinkhot">
          ★ そうしんかんりょう！ ★
        </p>
        <p className="text-[13px] leading-relaxed">
          ありがとうございます。運営に届きました。
          <br />
          {done.savedToAccount ? (
            <>
              返信は<b>マイページの「運営とのやりとり」</b>に届きます（メールは使いません）。
            </>
          ) : (
            <>
              いただいた声は運営に通知されました。
              <span className="text-inksoft">
                （未ログインの場合、内容はサイトに保存していません）
              </span>
            </>
          )}
        </p>
        <div className="flex justify-center gap-2.5">
          <button className="btn8 px-4 py-2 text-[12px]" onClick={() => setDone(null)}>
            もう一件おくる
          </button>
          <Link
            href={props.loggedIn ? "/mypage" : "/welcome"}
            className="btn8 btn8-start px-4 py-2 text-[12px]"
          >
            ▶ もどる
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[12px] font-extrabold">どんなご用件ですか？</label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(INQUIRY_CATEGORIES) as [InquiryCategory, string][]).map(
            ([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                aria-pressed={category === id}
                className={`rounded-lg border-[2.5px] border-line8 px-3 py-1.5 text-[12.5px] font-bold shadow-hard-sm ${
                  category === id ? "bg-royal text-white" : "bg-surface text-ink"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] font-extrabold">
          内容
          <span className="ml-1.5 font-normal text-inksoft">
            （{body.length} / {BODY_MAX}文字）
          </span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          rows={6}
          className="field8"
          placeholder={
            category === "bug"
              ? "例: ダンジョンの結果画面で「とじる」を押しても閉じないことがあります（iPhone / Safari）"
              : "例: 週報の下書きを複数保存できると嬉しいです"
          }
        />
        <p className="mt-1 text-[11px] text-inksoft">
          不具合のご報告は「どの画面で・何をしたら・どうなったか」があると助かります。
        </p>
      </div>

      {!props.loggedIn && (
        <div className="rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2.5">
          <label className="mb-1.5 block text-[12px] font-extrabold">
            返信先（任意）
          </label>
          <input
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            maxLength={120}
            className="field8"
            placeholder="返信が必要な場合のみ。メールやSNSのIDなど"
            autoCapitalize="none"
            spellCheck={false}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-inksoft">
            🔒 未ログインのご連絡は<b>サイトに保存しません</b>。運営への通知に流すだけです。
            ログインしてから送っていただくと、<b>返信をサイト内で受け取れます</b>（メール不要）。
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border-2 border-pinkhot bg-quotebg px-3 py-2 text-[12.5px] font-bold text-ink">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          className="btn8 btn8-start px-5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={pending || body.trim().length < 5}
          onClick={send}
        >
          {pending ? "…そうしんちゅう" : "▶ おくる"}
        </button>
        <span className="text-[11.5px] text-inksoft">
          {props.loggedIn
            ? "返信はマイページに届きます"
            : "ログインすると返信を受け取れます"}
        </span>
      </div>
    </div>
  );
}
