import type { ReactNode } from "react";
import { PAL } from "@/lib/palette";

/** 値の上／横に添える極小ラベル（基準日・次回ミーティング等）。 */
export default function FieldLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span style={{ color: PAL.slateLt }} className={`text-xs${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}
