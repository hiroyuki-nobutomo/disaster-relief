"use client";

import { useState } from "react";
import { PAL } from "@/lib/palette";
import { d, keyOfDate, isTime } from "@/lib/derive";
import type { CalendarEvent, Task } from "@/lib/types";
import { WD, monIdx, addDays, SLOT_H, CHIP } from "@/lib/calendar-layout";
import type { Span, View, EditState } from "@/lib/calendar-layout";
import MonthGrid from "@/components/calendar/MonthGrid";
import WeekGrid from "@/components/calendar/WeekGrid";
import EventEditorModal from "@/components/calendar/EventEditorModal";

export default function Calendar({
  tasks,
  events: calEvents,
  nextEvent,
  basis,
}: {
  tasks: Task[];
  events: CalendarEvent[];
  nextEvent: CalendarEvent | null;
  basis: string;
}) {
  const b = d(basis);
  const [view, setView] = useState<View>("month");
  const [cur, setCur] = useState<Date>(() => new Date(b.getFullYear(), b.getMonth(), b.getDate()));
  const [editing, setEditing] = useState<EditState | null>(null);

  // ── 帯（spans）を構築 ───────────────────────────────────────────────
  const spans: Span[] = [];
  tasks
    .filter((t) => t.kind === "milestone")
    .forEach((m) => {
      const k = keyOfDate(d(m.start));
      spans.push({
        type: "milestone",
        label: m.name,
        startKey: k,
        endKey: k,
        timed: false,
        ref: { kind: "milestone", id: m.id, date: m.start, name: m.name },
      });
    });
  calEvents.forEach((e) => {
    if (!e.startDate) return;
    const sdKey = keyOfDate(d(e.startDate));
    const edKey = e.endDate && e.endDate >= e.startDate ? keyOfDate(d(e.endDate)) : sdKey;
    const singleTimed = sdKey === edKey && isTime(e.startTime) && isTime(e.endTime);
    // 開始/終了が揃っている時だけ時刻を見出しに付ける（時間グリッド表示と整合）。
    const label = isTime(e.startTime) && isTime(e.endTime) ? `${e.startTime} ${e.title}` : e.title;
    spans.push({
      type: "event",
      label,
      startKey: sdKey,
      endKey: edKey,
      timed: singleTimed,
      start: e.startTime,
      end: e.endTime,
      ref: e.row
        ? {
            kind: "event",
            row: e.row,
            startDate: e.startDate,
            startTime: e.startTime,
            endDate: e.endDate,
            endTime: e.endTime,
            title: e.title,
            place: e.place,
            url: e.url,
            note: e.note,
          }
        : undefined,
    });
  });
  // 次回ミーティング＝基準日以降で最も近い予定（events）。その予定の日を「次回MTG」で強調。
  if (nextEvent?.startDate) {
    const k = keyOfDate(d(nextEvent.startDate));
    spans.push({ type: "meeting", label: "次回MTG", startKey: k, endKey: k, timed: false });
  }

  const basisKey = keyOfDate(b);

  // 表示する週（月＝月をカバーする複数週／週＝1週）。各週は7日の Date 配列。
  const weeks: Date[][] = [];
  if (view === "month") {
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    let dt = addDays(first, -monIdx(first)); // 月初を含む週の月曜
    const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const end = addDays(lastDay, 6 - monIdx(lastDay)); // 月末を含む週の日曜
    while (dt <= end) {
      weeks.push(Array.from({ length: 7 }, (_, i) => addDays(dt, i)));
      dt = addDays(dt, 7);
    }
  } else {
    const ws = addDays(cur, -monIdx(cur));
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(ws, i)));
  }
  const weekDays = weeks[0]; // 週表示は単一週。月表示ではラベル用に未使用。

  const label = (() => {
    if (view === "month") return `${cur.getFullYear()}年${cur.getMonth() + 1}月`;
    const we = weekDays[6];
    return `${weekDays[0].getMonth() + 1}/${weekDays[0].getDate()}〜${we.getMonth() + 1}/${we.getDate()}`;
  })();

  const prev = () =>
    setCur((c) =>
      view === "month" ? new Date(c.getFullYear(), c.getMonth() - 1, 1) : addDays(c, -7),
    );
  const next = () =>
    setCur((c) =>
      view === "month" ? new Date(c.getFullYear(), c.getMonth() + 1, 1) : addDays(c, 7),
    );

  const legend: { type: Span["type"] | "basis"; label: string }[] = [
    { type: "basis", label: "基準日" },
    { type: "milestone", label: "節目" },
    { type: "event", label: "予定" },
    { type: "meeting", label: "MTG" },
  ];

  const gridLines = `repeating-linear-gradient(to bottom, ${PAL.borderLt} 0, ${PAL.borderLt} 1px, transparent 1px, transparent ${SLOT_H}px)`;

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            style={{ color: PAL.brand, borderBottom: `2px solid ${PAL.brand}` }}
            className="inline-block pb-1 text-sm font-bold"
          >
            カレンダー
          </div>
          <div
            className="flex overflow-hidden rounded-md"
            style={{ border: `1px solid ${PAL.border}` }}
          >
            {(["month", "week"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                style={{
                  background: view === v ? PAL.brand : "#fff",
                  color: view === v ? "#fff" : PAL.slate,
                }}
                className="px-2.5 py-0.5 text-xs font-semibold"
              >
                {v === "month" ? "月" : "週"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEditing({ mode: "add", date: keyOfDate(b) })}
            style={{ border: `1px solid ${PAL.border}`, color: PAL.brand }}
            className="rounded-md px-2.5 py-0.5 text-xs font-semibold"
          >
            ＋ 追加
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2" style={{ fontSize: 11, color: PAL.slate }}>
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: l.type === "basis" ? 9999 : 2,
                    background: l.type === "basis" ? PAL.red : CHIP[l.type].bg,
                    border: l.type === "basis" ? "none" : `1px solid ${CHIP[l.type].fg}`,
                    display: "inline-block",
                  }}
                />
                {l.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              aria-label={view === "month" ? "前の月" : "前の週"}
              style={{ color: PAL.slate }}
              className="rounded-md px-2 py-0.5 text-base leading-none"
            >
              ‹
            </button>
            <div style={{ color: PAL.ink }} className="w-28 text-center text-sm font-semibold">
              {label}
            </div>
            <button
              onClick={next}
              aria-label={view === "month" ? "次の月" : "次の週"}
              style={{ color: PAL.slate }}
              className="rounded-md px-2 py-0.5 text-base leading-none"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* 曜日ヘッダ */}
      <div
        className="grid"
        style={{ gridTemplateColumns: view === "week" ? `44px repeat(7, 1fr)` : `repeat(7, 1fr)` }}
      >
        {view === "week" && <div />}
        {WD.map((w, i) => (
          <div
            key={w}
            className="pb-1 text-center"
            style={{ fontSize: 11, color: i === 6 ? PAL.red : i === 5 ? PAL.brand : PAL.slateLt }}
          >
            {w}
          </div>
        ))}
      </div>

      {view === "month" ? (
        <MonthGrid
          weeks={weeks}
          spans={spans}
          cur={cur}
          basisKey={basisKey}
          setEditing={setEditing}
        />
      ) : (
        <WeekGrid
          weekDays={weekDays}
          spans={spans}
          basisKey={basisKey}
          gridLines={gridLines}
          setEditing={setEditing}
        />
      )}

      {editing && (
        <EventEditorModal
          init={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  );
}
