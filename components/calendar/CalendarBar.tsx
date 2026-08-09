import { CHIP, LANE_H, BAR_H } from "@/lib/calendar-layout";
import type { Span, EditState } from "@/lib/calendar-layout";

// 横断バー1本を描画。
export default function CalendarBar({
  s,
  cs,
  ce,
  lane,
  setEditing,
}: {
  s: Span;
  cs: number;
  ce: number;
  lane: number;
  setEditing: (e: EditState | null) => void;
}) {
  const place = s.ref?.kind === "event" ? s.ref.place : undefined;
  const tip = [s.label, place ? `@${place}` : "", s.ref ? "（クリックで編集）" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (s.ref) setEditing({ mode: "edit", ref: s.ref });
      }}
      title={tip}
      className="truncate"
      style={{
        position: "absolute",
        left: `calc(${(cs / 7) * 100}% + 2px)`,
        width: `calc(${((ce - cs + 1) / 7) * 100}% - 4px)`,
        top: lane * LANE_H,
        height: BAR_H,
        background: CHIP[s.type].bg,
        color: CHIP[s.type].fg,
        border: `1px solid ${CHIP[s.type].fg}`,
        borderRadius: 4,
        fontSize: 10,
        lineHeight: `${BAR_H - 2}px`,
        padding: "0 5px",
        pointerEvents: "auto",
        cursor: s.ref ? "pointer" : "default",
      }}
    >
      {s.label}
      {place ? ` @${place}` : ""}
    </div>
  );
}
