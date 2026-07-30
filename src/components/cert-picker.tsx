"use client";

import { useState } from "react";
import { CERTIFICATIONS } from "@/lib/certifications";

// 学習プラン作成の資格選択。カタログをカードで見せて、押すと入力欄が埋まる。
// 自由入力も残す（カタログ外の資格でも従来どおりプランは作れる）ため、
// select ではなく「チップ＋テキスト入力」の形にしている。

export function CertPicker({ name = "certification" }: { name?: string }) {
  const [value, setValue] = useState("");
  const picked = CERTIFICATIONS.find((c) => c.label === value);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {CERTIFICATIONS.map((c) => {
          const on = c.label === value;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setValue(on ? "" : c.label)}
              aria-pressed={on}
              className={`rounded border-2 border-line8 px-2 py-1 text-[11.5px] shadow-hard-sm transition-transform hover:-translate-y-0.5 ${
                on ? "bg-royal text-white" : "bg-surface"
              }`}
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
              <span
                className={`ml-1 font-pixel text-[9px] ${on ? "text-white/80" : "text-inksoft"}`}
              >
                {c.chapters.length}章
              </span>
            </button>
          );
        })}
      </div>

      <input
        name={name}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="または自由に入力"
        className="field8"
      />

      <p className="mt-1 text-[11px] text-inksoft">
        {picked
          ? `${picked.hint}／章ごとに腕試しへ飛べます`
          : "上にない資格（例: 情報処理安全確保支援士）も入力できます"}
      </p>
    </div>
  );
}
