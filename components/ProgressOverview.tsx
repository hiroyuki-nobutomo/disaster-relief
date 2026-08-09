import { PAL } from "@/lib/palette";
import { phasesOf, phaseProgress, statusOf } from "@/lib/derive";
import Pill from "@/components/Pill";
import SectionTitle from "@/components/ui/SectionTitle";
import type { Status, Task } from "@/lib/types";

const STATUS_ORDER: Status[] = ["完了", "進行中", "未着手", "遅延"];

function Label({ children }: { children: React.ReactNode }) {
  return <SectionTitle className="mb-4">{children}</SectionTitle>;
}

export default function ProgressOverview({
  tasks,
  counts,
  basis,
}: {
  tasks: Task[];
  counts: Record<Status, number>;
  basis: string;
}) {
  return (
    <div className="card p-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        {/* フェーズ別 進捗 */}
        <div>
          <Label>フェーズ別 進捗</Label>
          <div style={{ color: PAL.slateLt, fontSize: 11 }} className="-mt-2 mb-3">
            バーは進捗率（実績）。完了＝100%のみ。期日超過の未完は「遅延」。
          </div>
          {phasesOf(tasks).map((p, i, arr) => {
            const v = phaseProgress(tasks, p);
            const rows = tasks.filter((t) => t.phase === p && t.kind === "task");
            const done = rows.filter((t) => t.progress >= 1).length;
            const overdue = rows.filter((t) => statusOf(t, basis) === "遅延").length;
            return (
              <div
                key={p}
                className={`flex items-center gap-3 ${i < arr.length - 1 ? "mb-4" : ""}`}
              >
                <div className="w-32 shrink-0">
                  <div style={{ color: PAL.body }} className="text-sm leading-tight">
                    {p}
                  </div>
                  <div style={{ color: PAL.slateLt, fontSize: 11 }}>
                    完了 {done}/{rows.length}
                    {overdue > 0 && (
                      <span style={{ color: PAL.red, fontWeight: 700 }}>　遅延 {overdue}</span>
                    )}
                  </div>
                </div>
                <div
                  style={{ background: PAL.tint2 }}
                  className="h-2 flex-1 overflow-hidden rounded-full"
                >
                  <div
                    style={{ background: overdue > 0 ? PAL.red : PAL.brand, width: `${v * 100}%` }}
                    className="h-full rounded-full"
                  />
                </div>
                <div style={{ color: PAL.ink }} className="w-9 text-right text-sm font-semibold">
                  {Math.round(v * 100)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* 状況別 タスク数 */}
        <div>
          <Label>状況別 タスク数</Label>
          {STATUS_ORDER.map((s) => (
            <div key={s} className="mb-3 flex items-center justify-between">
              <Pill s={s} />
              <span style={{ color: PAL.ink }} className="text-sm font-semibold">
                {counts[s]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
