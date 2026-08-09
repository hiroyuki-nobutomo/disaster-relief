"use client";

import type { DashboardData } from "@/lib/types";
import { useDashboardState } from "@/lib/useDashboardState";
import DashboardShell from "@/components/DashboardShell";
import ReportIntakePanel from "@/components/ReportIntakePanel";
import ReportsPanel from "@/components/ReportsPanel";

export default function ReportsView({ data }: { data: DashboardData }) {
  const { basis, setBasis, period, nextEvent } = useDashboardState(data);

  return (
    <DashboardShell
      data={data}
      active="reports"
      basis={basis}
      onBasis={setBasis}
      period={period}
      nextEvent={nextEvent}
    >
      <div className="space-y-6">
        <ReportIntakePanel tasks={data.tasks} />
        <ReportsPanel reports={data.reports} />
      </div>
    </DashboardShell>
  );
}
