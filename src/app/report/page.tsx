import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf, formatWeek } from "@/lib/week";
import { saveReportDraft, submitReport } from "@/app/actions";

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

function TextArea(props: {
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {props.label}
        {props.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <textarea
        name={props.name}
        rows={props.rows ?? 3}
        placeholder={props.placeholder}
        defaultValue={props.defaultValue ?? ""}
        className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
    </div>
  );
}

function RadioRow(props: {
  name: string;
  options: { value: number; label: string }[];
  defaultValue?: number | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.options.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white"
        >
          <input
            type="radio"
            name={props.name}
            value={o.value}
            defaultChecked={props.defaultValue === o.value}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export default async function ReportPage() {
  const user = await getCurrentUser();
  const weekStart = mondayOf(new Date());
  const report = await prisma.weeklyReport.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    include: { analysis: true },
  });

  const submitted = report?.status === "SUBMITTED";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">今週の週報</h1>
        <p className="text-sm text-zinc-500">
          {formatWeek(weekStart)} ・ {user.name}
        </p>
      </div>

      {submitted && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-800">✅ 提出済みです</p>
          {report?.analysis?.feedbackText && (
            <p className="mt-2 text-green-900">
              <span className="font-medium">今週の成長ポイント: </span>
              {report.analysis.feedbackText}
            </p>
          )}
          {report?.analysis?.status === "FAILED" && (
            <p className="mt-2 text-amber-700">
              AI解析に失敗しました（提出は完了しています）
            </p>
          )}
        </div>
      )}

      <form className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            1. 今週のコンディション <span className="text-red-500">*</span>
          </p>
          <RadioRow
            name="conditionSelf"
            options={CONDITIONS}
            defaultValue={report?.conditionSelf}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            2. 稼働の体感 <span className="text-red-500">*</span>
          </p>
          <RadioRow
            name="workloadSelf"
            options={WORKLOADS}
            defaultValue={report?.workloadSelf}
          />
        </div>

        <TextArea
          name="didText"
          label="3. 今週やったこと"
          placeholder="・APIの結合テストを完了&#10;・レビュー指摘の修正"
          required
          defaultValue={report?.didText}
          rows={4}
        />
        <TextArea
          name="newText"
          label="4. 新しく触れた技術・初めてやったこと"
          placeholder="初めてDockerのマルチステージビルドを書いた、など。経歴書に反映されます"
          defaultValue={report?.newText}
        />
        <TextArea
          name="struggleText"
          label="5. 詰まったこと・モヤモヤしていること"
          placeholder="技術的な詰まりも、現場の人間関係のことでもOK"
          defaultValue={report?.struggleText}
        />
        <TextArea
          name="nextText"
          label="6. 来週やること・やりたいこと"
          placeholder=""
          defaultValue={report?.nextText}
        />
        <TextArea
          name="shareText"
          label="7. 会社への共有・相談"
          placeholder=""
          defaultValue={report?.shareText}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="wantsConsultation"
            defaultChecked={report?.wantsConsultation}
          />
          営業に直接相談したい（チェックすると担当営業へすぐに通知されます）
        </label>

        <div className="flex gap-3">
          <button
            formAction={saveReportDraft}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-100"
          >
            下書き保存
          </button>
          <button
            formAction={submitReport}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {submitted ? "再提出する" : "提出する"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          提出するとAIが内容を解析し、スキルマップの更新提案と「今週の成長ポイント」を返します。
          コンディションに関する記述は本人・管理者・担当営業のみ閲覧でき、人事評価には使用されません。
        </p>
      </form>
    </div>
  );
}
