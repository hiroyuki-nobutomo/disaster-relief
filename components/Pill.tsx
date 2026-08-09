import { CHIP } from "@/lib/palette";
import type { Status } from "@/lib/types";

export default function Pill({ s }: { s: Status }) {
  const [bg, fg] = CHIP[s] || CHIP["予定"];
  return (
    <span
      style={{ background: bg, color: fg, fontWeight: 600 }}
      className="rounded px-2 py-0.5 text-xs whitespace-nowrap"
    >
      {s}
    </span>
  );
}
