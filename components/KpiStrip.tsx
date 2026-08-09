import KPI from "@/components/KPI";
import { PAL } from "@/lib/palette";
import { overallProgress, statusCounts, taskRows } from "@/lib/derive";
import type { Task } from "@/lib/types";

/** 全体進捗率・完了・進行中・遅延の KPI ストリップ。概要／ダッシュボードで共用。 */
export default function KpiStrip({ tasks, basis }: { tasks: Task[]; basis: string }) {
  const rows = taskRows(tasks);
  const overall = overallProgress(tasks);
  const counts = statusCounts(tasks, basis);

  return (
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
      <KPI
        label="全体進捗率（タスク平均）"
        value={`${Math.round(overall * 100)}%`}
        accent={PAL.brand}
      />
      <KPI label="完了タスク / 全タスク" value={`${counts.完了} / ${rows.length}`} />
      <KPI label="進行中" value={counts.進行中} />
      <KPI label="遅延タスク" value={counts.遅延} accent={counts.遅延 ? PAL.red : PAL.ink} />
    </div>
  );
}
