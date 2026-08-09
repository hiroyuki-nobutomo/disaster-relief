"use client";

import type { DashboardData } from "@/lib/types";
import { useDashboardState } from "@/lib/useDashboardState";
import DashboardShell from "@/components/DashboardShell";
import KpiStrip from "@/components/KpiStrip";
import NoticesPanel from "@/components/NoticesPanel";
import MaterialsPanel from "@/components/MaterialsPanel";
import Calendar from "@/components/Calendar";

export default function OverviewView({ data }: { data: DashboardData }) {
  const { basis, setBasis, period, nextEvent } = useDashboardState(data);

  return (
    <DashboardShell
      data={data}
      active="overview"
      basis={basis}
      onBasis={setBasis}
      period={period}
      nextEvent={nextEvent}
    >
      <div className="space-y-6">
        {/* KPI ストリップ */}
        <KpiStrip tasks={data.tasks} basis={basis} />

        {/* 連絡事項 / 資料 */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <NoticesPanel notices={data.notices} />
          <MaterialsPanel materials={data.materials} />
        </div>

        {/* カレンダー */}
        <Calendar tasks={data.tasks} events={data.events} nextEvent={nextEvent} basis={basis} />
      </div>
    </DashboardShell>
  );
}
