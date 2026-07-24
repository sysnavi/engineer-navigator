import Link from "next/link";
import { requireFullAccount } from "@/lib/guest";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { DOMAINS } from "@/lib/domains";
import { createQuizQuestion } from "../actions";

// 四択問題の作成フォーム。作成者＝本人。自作問題は自分には出題されない。

export default async function QuizNewPage() {
  await requireFullAccount();
  const labels = ["A", "B", "C", "D"];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <PixelLabel>QUIZ / NEW</PixelLabel>
          <PixelTitle as="h1" className="text-2xl text-royal">
            問題を作る
          </PixelTitle>
        </div>
        <Link href="/quiz" className="btn8 text-[12px]">
          ← 良問バンク
        </Link>
      </div>

      <Window title="NEW QUESTION" titleEm=".edit">
        <form action={createQuizQuestion} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-extrabold">
              お題（トピック）<span className="text-pinkhot">*</span>
            </label>
            <input
              name="topic"
              required
              placeholder="例: AWS IAM"
              className="field8"
            />
            <p className="mt-1 text-[11px] text-inksoft">
              例: AWS IAM / TCP/IP / SQL / Git など。
              同じお題でまとめて出題されるので、既存のお題名に揃えると集まりやすいです。
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-extrabold">
              問題文<span className="text-pinkhot">*</span>
            </label>
            <textarea
              name="prompt"
              required
              rows={3}
              placeholder="例: IAMロールとIAMユーザーの主な違いはどれ？"
              className="field8"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-extrabold">
              選択肢（4つ）と正解<span className="text-pinkhot">*</span>
            </label>
            <p className="mb-2 text-[11px] text-inksoft">
              各行の左のラジオで<b>正解</b>を1つ選んでください。
            </p>
            <div className="space-y-2">
              {labels.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="answerIndex"
                      value={i}
                      required
                      className="h-4 w-4 accent-[var(--pink-hot)]"
                    />
                    <span className="font-pixel text-[12px] text-inksoft">
                      {l}
                    </span>
                  </label>
                  <input
                    name={`choice${i}`}
                    required
                    placeholder={`選択肢 ${l}`}
                    className="field8"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-extrabold">
              解説（任意）
            </label>
            <textarea
              name="explanation"
              rows={2}
              placeholder="なぜその答えになるか。現場での使いどころなど。"
              className="field8"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-extrabold">
              関連領域（任意）
            </label>
            <div className="flex flex-wrap gap-2">
              {DOMAINS.map((d) => (
                <label key={d.id} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="domains"
                    value={d.id}
                    className="peer sr-only"
                  />
                  <span className="inline-flex items-center gap-1 rounded-lg border-2 border-line8 bg-surface px-2.5 py-1 text-[11.5px] shadow-hard-sm peer-checked:bg-royal peer-checked:text-white">
                    {d.emoji} {d.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button className="btn8 btn8-start text-[13px]">▶ 登録する</button>
        </form>
      </Window>
    </div>
  );
}
