"use client";

import { useMemo, useState } from "react";
import { PAL } from "@/lib/palette";
import SectionTitle from "@/components/ui/SectionTitle";
import type { ActivityReport } from "@/lib/types";

// 蓄積された活動報告（5W1H）の一覧。reports タブ由来。
// 「誰が」「どの作業項目で」で絞り込み、作業日の新しい順に表示する。

export default function ReportsPanel({ reports }: { reports: ActivityReport[] }) {
  const [who, setWho] = useState("");
  const [item, setItem] = useState("");

  const whoOptions = useMemo(
    () => [...new Set(reports.map((r) => r.who).filter(Boolean))].sort(),
    [reports],
  );
  // タスクの選択肢は「id:名称」。id 無し（対応付けなし）の報告は "-" でまとめる。
  const itemOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reports) {
      const key = r.taskId ?? "-";
      const label = r.taskId ? `${r.taskId}. ${r.taskName ?? ""}`.trim() : "（対応付けなし）";
      if (!m.has(key)) m.set(key, label);
    }
    return [...m.entries()].sort((a, b) =>
      a[0] === "-" ? 1 : b[0] === "-" ? -1 : a[0].localeCompare(b[0], "ja", { numeric: true }),
    );
  }, [reports]);

  const filtered = useMemo(
    () =>
      reports
        .filter((r) => !who || r.who === who)
        .filter((r) => {
          if (!item) return true;
          if (item === "-") return r.taskId === undefined;
          return r.taskId === item;
        })
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [reports, who, item],
  );

  const selStyle = { border: `1px solid ${PAL.border}`, color: PAL.body } as const;

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>活動報告レポート</SectionTitle>
        <div className="flex items-center gap-2">
          <select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            style={selStyle}
            className="rounded bg-white px-2 py-1 text-xs"
          >
            <option value="">全員</option>
            {whoOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <select
            value={item}
            onChange={(e) => setItem(e.target.value)}
            style={selStyle}
            className="rounded bg-white px-2 py-1 text-xs"
          >
            <option value="">全小項目（タスク）</option>
            {itemOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <span style={{ color: PAL.slateLt }} className="text-xs whitespace-nowrap">
            {filtered.length} / {reports.length}件
          </span>
        </div>
      </div>

      {reports.length === 0 ? (
        <div style={{ color: PAL.slateLt }} className="text-xs">
          まだ報告がありません。上の「メール取り込み」から登録すると、ここに蓄積されます （Sheet の{" "}
          <code>reports</code> タブ）。
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${PAL.brand}` }} className="pl-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span style={{ color: PAL.ink }} className="text-sm font-semibold">
                  {r.date}
                </span>
                <span style={{ color: PAL.ink }} className="text-sm font-semibold">
                  {r.who}
                </span>
                {r.taskId && (
                  <span
                    style={{ background: PAL.pale, color: PAL.brand }}
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  >
                    {r.taskId}. {r.taskName ?? ""}
                  </span>
                )}
                {r.where && (
                  <span style={{ color: PAL.slate }} className="text-xs">
                    ＠{r.where}
                  </span>
                )}
              </div>
              <div style={{ color: PAL.body }} className="mt-0.5 text-sm leading-relaxed">
                {r.what}
              </div>
              {(r.how || r.why || r.source) && (
                <div style={{ color: PAL.slateLt }} className="mt-0.5 text-xs">
                  {[
                    r.how && `手段: ${r.how}`,
                    r.why && `目的: ${r.why}`,
                    r.source && `出典: ${r.source}`,
                  ]
                    .filter(Boolean)
                    .join("　／　")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
