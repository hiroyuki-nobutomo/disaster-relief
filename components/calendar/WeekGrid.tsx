import { PAL } from "@/lib/palette";
import { keyOfDate, toMin } from "@/lib/derive";
import {
  layoutWeek,
  CHIP,
  LANE_H,
  START_H,
  SLOT_H,
  GRID_H,
  HOUR_LABELS,
} from "@/lib/calendar-layout";
import type { Span, EditState } from "@/lib/calendar-layout";
import CalendarBar from "./CalendarBar";

export default function WeekGrid({
  weekDays,
  spans,
  basisKey,
  gridLines,
  setEditing,
}: {
  weekDays: Date[];
  spans: Span[];
  basisKey: string;
  gridLines: string;
  setEditing: (e: EditState | null) => void;
}) {
  const weekKeys = weekDays.map(keyOfDate);
  // 終日帯＝時刻なし・複数日（timed でない帯）。
  const allDay = spans.filter((s) => !s.timed);
  const { out, lanes } = layoutWeek(weekKeys, allDay);
  const bandH = Math.max(lanes, 1) * LANE_H + 6;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `44px repeat(7, minmax(0,1fr))`,
        border: `1px solid ${PAL.borderLt}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* 日付ヘッダ */}
      <div style={{ borderBottom: `1px solid ${PAL.borderLt}` }} />
      {weekDays.map((dt, i) => {
        const isBasis = keyOfDate(dt) === basisKey;
        return (
          <div
            key={`h${i}`}
            className="py-1 text-center"
            style={{
              borderLeft: `1px solid ${PAL.borderLt}`,
              borderBottom: `1px solid ${PAL.borderLt}`,
              background: isBasis ? "#FCEBEC" : "transparent",
              fontSize: 13,
              fontWeight: isBasis ? 700 : 500,
              color: isBasis ? PAL.red : PAL.body,
            }}
          >
            {dt.getDate()}
          </div>
        );
      })}

      {/* 終日帯（横断バー） */}
      <div
        className="px-1 py-1 text-right"
        style={{
          fontSize: 10,
          color: PAL.slateLt,
          borderBottom: `1px solid ${PAL.borderLt}`,
        }}
      >
        終日
      </div>
      <div
        style={{
          gridColumn: "2 / span 7",
          position: "relative",
          height: bandH,
          borderBottom: `1px solid ${PAL.borderLt}`,
        }}
      >
        {/* クリックで追加（各日の領域） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            gridTemplateColumns: "repeat(7,1fr)",
          }}
        >
          {weekDays.map((dt, i) => (
            <div
              key={`ac${i}`}
              onClick={() => setEditing({ mode: "add", date: keyOfDate(dt) })}
              style={{
                borderLeft: i ? `1px solid ${PAL.borderLt}` : "none",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
        <div style={{ position: "absolute", inset: "3px 0 0 0", pointerEvents: "none" }}>
          {out.map((p, k) => (
            <CalendarBar key={k} {...p} setEditing={setEditing} />
          ))}
        </div>
      </div>

      {/* 時間グリッド（軸） */}
      <div style={{ position: "relative", height: GRID_H }}>
        {HOUR_LABELS.map((h) => (
          <div
            key={h}
            style={{
              position: "absolute",
              right: 4,
              top: (h - START_H) * 2 * SLOT_H,
              transform: "translateY(-50%)",
              fontSize: 10,
              color: PAL.slateLt,
            }}
          >
            {h}:00
          </div>
        ))}
      </div>
      {weekDays.map((dt, i) => {
        const key = keyOfDate(dt);
        const isBasis = key === basisKey;
        const timed = spans.filter((s) => s.timed && s.startKey === key && s.start && s.end);
        return (
          <div
            key={`t${i}`}
            onClick={() => setEditing({ mode: "add", date: key })}
            title="クリックで予定/節目を追加"
            style={{
              position: "relative",
              height: GRID_H,
              borderLeft: `1px solid ${PAL.borderLt}`,
              backgroundColor: isBasis ? "rgba(192,0,0,0.04)" : "#fff",
              backgroundImage: gridLines,
              cursor: "pointer",
            }}
          >
            {timed.map((s, k) => {
              const top = Math.max(0, ((toMin(s.start!) - START_H * 60) / 30) * SLOT_H);
              const bottom = Math.min(GRID_H, ((toMin(s.end!) - START_H * 60) / 30) * SLOT_H);
              const h = Math.max(bottom - top, 14);
              const title = s.ref?.kind === "event" ? s.ref.title : s.label;
              return (
                <div
                  key={k}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (s.ref) setEditing({ mode: "edit", ref: s.ref });
                  }}
                  style={{
                    position: "absolute",
                    top,
                    height: h,
                    left: 2,
                    right: 2,
                    background: CHIP.event.bg,
                    color: CHIP.event.fg,
                    border: `1px solid ${CHIP.event.fg}`,
                    borderRadius: 4,
                    fontSize: 9,
                    lineHeight: 1.2,
                    padding: "1px 4px",
                    overflow: "hidden",
                    cursor: "pointer",
                    zIndex: 1,
                  }}
                  title={`${s.start}–${s.end} ${title}`}
                >
                  {s.start}–{s.end} {title}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
