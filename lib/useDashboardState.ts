"use client";

import { useState } from "react";
import { DEFAULT_BASIS, formatRange, nextMeetingEvent, projectRange } from "@/lib/derive";
import type { CalendarEvent, DashboardData } from "@/lib/types";

/**
 * ダッシュボード各ビュー（概要／ダッシュボード／ガント）で共通の表示状態。
 *  - basis: 基準日（既定はサーバ算出の今日。画面の日付ピッカーで一時変更可）
 *  - period: プロジェクト期間の表示文字列
 *  - nextEvent: 右上「次回ミーティング」に出す直近の予定（今日以降）
 * 3ビューでの重複（state・派生値・AppHeader 配線）を1か所に集約する。
 */
export function useDashboardState(data: DashboardData): {
  basis: string;
  setBasis: (v: string) => void;
  period: string;
  nextEvent: CalendarEvent | null;
} {
  const [basis, setBasis] = useState(data.basisDate || DEFAULT_BASIS);
  const period = formatRange(projectRange(data.tasks));
  const nextEvent = nextMeetingEvent(data.events);
  return { basis, setBasis, period, nextEvent };
}
