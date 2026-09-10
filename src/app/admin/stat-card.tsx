// 管理画面の数字カード（/admin と /admin/analytics で共用）
export function StatCard(props: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border-[2.5px] border-line8 bg-surface px-4 py-3 shadow-hard-sm">
      <p className="font-pixel text-[10px] tracking-wide text-inksoft">
        {props.label}
      </p>
      <p className="mt-1 font-pixel text-2xl text-royal">{props.value}</p>
      {props.hint && (
        <p className="mt-0.5 text-[10.5px] text-inksoft">{props.hint}</p>
      )}
    </div>
  );
}
