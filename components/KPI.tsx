import { PAL } from "@/lib/palette";

export default function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="card px-5 py-4">
      <div style={{ color: PAL.slateLt }} className="mb-1.5 text-xs">
        {label}
      </div>
      <div style={{ color: accent || PAL.ink }} className="text-3xl font-bold tracking-tight">
        {value}
      </div>
    </div>
  );
}
