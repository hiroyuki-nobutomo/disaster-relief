import type { ReactNode } from "react";
import { PAL } from "@/lib/palette";

/**
 * 各カードの先頭に置くブランド色＋下線のセクション見出し。
 * 余白は呼び出し側のレイアウトに合わせて className（例: "mb-3"）で渡す。
 */
export default function SectionTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      style={{ color: PAL.brand, borderBottom: `2px solid ${PAL.brand}` }}
      className={`inline-block pb-1 text-sm font-bold${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
