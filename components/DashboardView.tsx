"use client";

import { useMemo } from "react";
import { statusCounts } from "@/lib/derive";
import type { DashboardData } from "@/lib/types";
import { useDashboardState } from "@/lib/useDashboardState";
import DashboardShell from "@/components/DashboardShell";
import KpiStrip from "@/components/KpiStrip";
import EvaluationPanel from "@/components/EvaluationPanel";
import ProgressOverview from "@/components/ProgressOverview";
import Links from "@/components/Links";

export default function DashboardView({ data }: { data: DashboardData }) {
  const { basis, setBasis, period, nextEvent } = useDashboardState(data);
  const counts = useMemo(() => statusCounts(data.tasks, basis), [data.tasks, basis]);

  return (
    <DashboardShell
      data={data}
      active="dashboard"
      basis={basis}
      onBasis={setBasis}
      period={period}
      nextEvent={nextEvent}
    >
      <div className="space-y-6">
        {/* KPI ストリップ */}
        <KpiStrip tasks={data.tasks} basis={basis} />

        {/* 評価（管理指標）×3 */}
        <EvaluationPanel tasks={data.tasks} basis={basis} />

        {/* 進捗サマリー（フェーズ＋状況） / 資料リンク */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProgressOverview tasks={data.tasks} counts={counts} basis={basis} />
          </div>
          <div className="lg:col-span-1">
            <Links links={data.links} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
