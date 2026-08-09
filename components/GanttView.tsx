"use client";

import { useState } from "react";
import { PAL } from "@/lib/palette";
import { fmt, statusOf } from "@/lib/derive";
import type { DashboardData } from "@/lib/types";
import { useDashboardState } from "@/lib/useDashboardState";
import DashboardShell from "@/components/DashboardShell";
import Gantt from "@/components/Gantt";
import Pill from "@/components/Pill";
import SectionTitle from "@/components/ui/SectionTitle";

export default function GanttView({ data }: { data: DashboardData }) {
  const { tasks } = data;
  const { basis, setBasis, period, nextEvent } = useDashboardState(data);
  const [sel, setSel] = useState<string | null>(null);

  const selected = sel != null ? (tasks.find((t) => t.id === sel) ?? null) : null;

  return (
    <DashboardShell
      data={data}
      active="gantt"
      basis={basis}
      onBasis={setBasis}
      period={period}
      nextEvent={nextEvent}
    >
      {/* スケジュール（ガント＋主要マイルストーンを同一カード内に統合） */}
      <Gantt tasks={tasks} basis={basis} sel={sel} onSel={setSel} />

      <div className="mt-5">
        {/* タスク詳細（v1は閲覧専用） */}
        <div className="card p-5">
          <SectionTitle className="mb-3">タスク詳細</SectionTitle>
          {!selected ? (
            <div style={{ color: PAL.slateLt }} className="text-xs">
              ガントの行をタップすると、ここで詳細を確認できます。
            </div>
          ) : selected.kind === "milestone" ? (
            <div>
              <div style={{ color: PAL.body }} className="mb-2 text-xs">
                {selected.name}
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span style={{ color: PAL.slateLt }} className="text-xs">
                  {fmt(selected.start)}
                </span>
                <Pill s={statusOf(selected, basis)} />
              </div>
              <div style={{ color: PAL.slateLt }} className="text-xs">
                マイルストーンは日付で管理します。
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: PAL.body }} className="mb-1 text-xs">
                {selected.name}
              </div>
              <div
                style={{ color: PAL.slateLt }}
                className="mb-2 flex flex-wrap items-center gap-2 text-xs"
              >
                <span>{selected.owner}</span>
                <span>
                  {fmt(selected.start)} 〜 {fmt(selected.end)}
                </span>
                <Pill s={statusOf(selected, basis)} />
              </div>
              <div style={{ color: PAL.slateLt }} className="mb-1 text-xs">
                進捗：
                <span style={{ color: PAL.brand, fontWeight: 700 }}>
                  {Math.round(selected.progress * 100)}%
                </span>
              </div>
              <div style={{ background: PAL.tint2 }} className="h-2.5 overflow-hidden rounded-full">
                <div
                  style={{ background: PAL.brand, width: `${selected.progress * 100}%` }}
                  className="h-full rounded-full"
                />
              </div>
              <div style={{ color: PAL.slateLt }} className="mt-2 text-xs">
                進捗の編集は右下の PMエージェント、または Google Sheets
                から行えます（フレーム・ロジックは変更不可）。
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
