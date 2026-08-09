import { PAL } from "@/lib/palette";
import SectionTitle from "@/components/ui/SectionTitle";

export default function Links({ links }: { links: { label: string; url: string }[] }) {
  return (
    <div className="card p-5">
      <SectionTitle className="mb-3">資料リンク</SectionTitle>
      {links.map((l) => {
        const hasUrl = Boolean(l.url) && l.url !== "#";
        return (
          <div key={l.label} className="mb-2 flex items-center justify-between gap-3">
            <span style={{ color: PAL.body }} className="text-xs">
              {l.label}
            </span>
            {hasUrl ? (
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: PAL.brand }}
                className="text-xs whitespace-nowrap underline"
              >
                開く →
              </a>
            ) : (
              <span style={{ color: PAL.slateLt }} className="text-xs whitespace-nowrap">
                未設定
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
