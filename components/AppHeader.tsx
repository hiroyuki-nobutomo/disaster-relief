import Link from "next/link";
import { PAL } from "@/lib/palette";
import SessionMenu from "@/components/SessionMenu";
import { formatEventDateShort } from "@/lib/derive";
import FieldLabel from "@/components/ui/FieldLabel";
import type { CalendarEvent } from "@/lib/types";

// フレームワーク（ツール）名。プロジェクトに依存しない固定値。
const TOOL_NAME = "プロジェクト・マネジメント ダッシュボード";

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        color: active ? PAL.brand : PAL.slate,
        borderBottom: active ? `2px solid ${PAL.brand}` : "2px solid transparent",
        textDecoration: "none",
      }}
      className="pb-1.5 text-sm font-semibold"
    >
      {label}
    </Link>
  );
}

export default function AppHeader({
  projectName,
  org,
  period,
  nextEvent,
  basis,
  onBasis,
  active,
}: {
  projectName: string;
  org: string;
  period: string;
  nextEvent: CalendarEvent | null;
  basis: string;
  onBasis: (v: string) => void;
  active: "overview" | "dashboard" | "gantt" | "reports" | "budget";
}) {
  const name = projectName.trim();
  const title = name || TOOL_NAME;
  const subParts = [org.trim(), period && `期間 ${period}`].filter(Boolean);
  const subtitle = subParts.length
    ? subParts.join("　／　")
    : "進捗・スケジュール・管理指標の統合ビュー";

  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          {name && (
            <div style={{ color: PAL.slateLt }} className="mb-0.5 text-xs">
              {TOOL_NAME}
            </div>
          )}
          <div style={{ color: PAL.ink }} className="text-2xl font-bold tracking-tight lg:text-3xl">
            {title}
          </div>
          <div style={{ color: PAL.slate }} className="mt-0.5 text-sm">
            {subtitle}
          </div>
        </div>
        <div className="flex items-center gap-5">
          {/* 基準日（編集可）・次回ミーティング・ログアウトを一直線に配置 */}
          <label className="flex items-center gap-1.5">
            <FieldLabel>基準日</FieldLabel>
            <input
              type="date"
              value={basis}
              onChange={(e) => onBasis(e.target.value)}
              style={{ color: PAL.brand, border: "none", background: "transparent" }}
              className="cursor-pointer p-0 text-sm font-semibold"
            />
          </label>
          {nextEvent && (
            <div className="flex items-center gap-1.5">
              <FieldLabel>次回ミーティング</FieldLabel>
              <span
                style={{ color: PAL.brand }}
                className="text-sm font-semibold"
                title={nextEvent.title || undefined}
              >
                {formatEventDateShort(nextEvent)}
              </span>
            </div>
          )}
          <SessionMenu />
        </div>
      </div>
      <div className="flex items-center gap-5" style={{ borderBottom: `1px solid ${PAL.border}` }}>
        <Tab href="/" label="プロジェクト概要" active={active === "overview"} />
        <Tab href="/dashboard" label="ダッシュボード" active={active === "dashboard"} />
        <Tab href="/gantt" label="ガントチャート" active={active === "gantt"} />
        <Tab href="/budget" label="予実管理" active={active === "budget"} />
        <Tab href="/reports" label="活動報告" active={active === "reports"} />
      </div>
    </div>
  );
}
