"use client";

import { useActionState } from "react";
import { createStudyPlan, type PlanFormState } from "@/app/actions";
import { CertPicker } from "@/components/cert-picker";
import { SubmitButton } from "@/components/submit-button";

// 学習プランの新規作成フォーム。バリデーション失敗（試験日が近すぎる等）や
// AI一時停止のメッセージは、エラーバウンダリに飛ばさずフォーム上に表示する。
// min はサーバー側で計算して受け取る（検証と同じUTC基準に揃えるため）。

const initialState: PlanFormState = { error: null };

export function PlanCreateForm({ minExamDate }: { minExamDate: string }) {
  const [state, formAction] = useActionState(createStudyPlan, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-extrabold">
            資格 <span className="text-pinkhot">*</span>
          </label>
          <CertPicker />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-extrabold">
            試験日 <span className="text-pinkhot">*</span>
          </label>
          <input name="examDate" type="date" required min={minExamDate} className="field8" />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-[12.5px] font-extrabold text-pinkhot">
          ⚠ {state.error}
        </p>
      )}
      <SubmitButton className="btn8 btn8-start" pendingLabel="AIが作成中…">
        ▶ プランを作成
      </SubmitButton>
    </form>
  );
}
