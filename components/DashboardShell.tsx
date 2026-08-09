"use client";

import type { ReactNode } from "react";
import { PAL } from "@/lib/palette";
import AppHeader from "@/components/AppHeader";
import SourceNote from "@/components/SourceNote";
import type { CalendarEvent, DashboardData } from "@/lib/types";

/**
 * ダッシュボード共通の外枠（背景・最大幅・AppHeader・SourceNote）。
 * 各ビューは children に中身だけを渡す。ヘッダ周りの変更はここ1か所で済む。
 */
export default function DashboardShell({
  data,
  active,
  basis,
  onBasis,
  period,
  nextEvent,
  children,
}: {
  data: DashboardData;
  active: "overview" | "dashboard" | "gantt" | "reports" | "budget";
  basis: string;
  onBasis: (v: string) => void;
  period: string;
  nextEvent: CalendarEvent | null;
  children: ReactNode;
}) {
  return (
    <div style={{ background: PAL.tint, color: PAL.body }} className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <AppHeader
          projectName={data.projectName}
          org={data.org}
          period={period}
          nextEvent={nextEvent}
          basis={basis}
          onBasis={onBasis}
          active={active}
        />
        {children}
        <SourceNote source={data.source} />
      </div>
    </div>
  );
}
