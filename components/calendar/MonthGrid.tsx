import { PAL } from "@/lib/palette";
import { keyOfDate } from "@/lib/derive";
import { layoutWeek, LANE_H, DAYNUM_H, MONTH_MIN_CELL_H } from "@/lib/calendar-layout";
import type { Span, EditState } from "@/lib/calendar-layout";
import CalendarBar from "./CalendarBar";

export default function MonthGrid({
  weeks,
  spans,
  cur,
  basisKey,
  setEditing,
}: {
  weeks: Date[][];
  spans: Span[];
  cur: Date;
  basisKey: string;
  setEditing: (e: EditState | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {weeks.map((wk, wi) => {
        const weekKeys = wk.map(keyOfDate);
        const { out, lanes } = layoutWeek(weekKeys, spans);
        const cellH = Math.max(MONTH_MIN_CELL_H, DAYNUM_H + Math.max(lanes, 1) * LANE_H + 6);
        return (
          <div key={wi} style={{ position: "relative" }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(7, minmax(0,1fr))` }}>
              {wk.map((dt, ci) => {
                const key = keyOfDate(dt);
                const inMonth = dt.getMonth() === cur.getMonth();
                const isBasis = key === basisKey;
                return (
                  <div
                    key={ci}
                    onClick={() => setEditing({ mode: "add", date: key })}
                    title="クリックで予定/節目を追加"
                    style={{
                      minHeight: cellH,
                      background: isBasis ? "#FCEBEC" : inMonth ? PAL.tint : "#FBFCFD",
                      border: `1px solid ${PAL.borderLt}`,
                      cursor: "pointer",
                    }}
                    className="rounded-lg p-1"
                  >
                    <div
                      className="flex items-center justify-center text-xs"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 9999,
                        background: isBasis ? PAL.red : "transparent",
                        color: isBasis ? "#fff" : inMonth ? PAL.body : PAL.slateLt,
                        fontWeight: isBasis ? 700 : 500,
                      }}
                    >
                      {dt.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 横断バー（レーン段組み） */}
            <div
              style={{
                position: "absolute",
                top: DAYNUM_H + 2,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: "none",
              }}
            >
              {out.map((p, k) => (
                <CalendarBar key={k} {...p} setEditing={setEditing} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
