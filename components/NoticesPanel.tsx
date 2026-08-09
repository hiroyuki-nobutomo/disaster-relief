import { PAL } from "@/lib/palette";
import SectionTitle from "@/components/ui/SectionTitle";
import type { Notice } from "@/lib/types";

/** 大切な連絡事項（箇条書き）。Sheet の notices タブ由来。未設定でも安全に空表示。 */
export default function NoticesPanel({ notices }: { notices: Notice[] }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>連絡事項</SectionTitle>
        <span style={{ color: PAL.slateLt }} className="text-xs">
          大切なお知らせ
        </span>
      </div>

      {notices.length === 0 ? (
        <div style={{ color: PAL.slateLt }} className="text-xs">
          表示する連絡事項がありません（Sheet の <code>notices</code>{" "}
          タブに記入すると表示されます）。
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {notices.map((n, i) => (
            <li key={i} className="flex gap-2.5 text-sm" style={{ color: PAL.body }}>
              <span style={{ color: PAL.brand }} aria-hidden className="mt-0.5 leading-none">
                ●
              </span>
              <span className="flex-1 leading-relaxed">
                {n.text}
                {n.date && (
                  <span style={{ color: PAL.slateLt }} className="ml-2 text-xs whitespace-nowrap">
                    {n.date}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
