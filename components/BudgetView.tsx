"use client";

import type { DashboardData } from "@/lib/types";
import { useDashboardState } from "@/lib/useDashboardState";
import {
  budgetTotals,
  formatRate,
  formatYen,
  groupBudget,
  joinBudget,
  type BudgetRow,
} from "@/lib/budget";
import DashboardShell from "@/components/DashboardShell";
import KPI from "@/components/KPI";
import SectionTitle from "@/components/ui/SectionTitle";
import { PAL } from "@/lib/palette";

// 予実管理（金額）。budget タブ（task_id 単位の予算・実績）を tasks と結合し、
// 大項目（phase）→ 中項目（activity）→ 小項目（タスク）の階層で集計表示する。計算は lib/budget.ts。

function RateBar({ rate }: { rate: number | null }) {
  if (rate === null) return null;
  const over = rate > 1;
  const width = Math.min(1, rate) * 100;
  return (
    <div className="flex items-center gap-2">
      <div
        style={{ background: PAL.tint2, height: 6 }}
        className="w-full min-w-16 overflow-hidden rounded-full"
      >
        <div
          style={{ width: `${width}%`, background: over ? PAL.red : PAL.brand, height: 6 }}
          className="rounded-full"
        />
      </div>
      <span
        style={{ color: over ? PAL.red : PAL.slate }}
        className="text-xs font-semibold whitespace-nowrap"
      >
        {formatRate(rate)}
      </span>
    </div>
  );
}

function AmountCells({ budget, actual }: { budget: number; actual: number }) {
  const t = budgetTotals([{ budget, actual }]);
  return (
    <>
      <td style={{ color: PAL.body }} className="py-2 pr-3 text-right text-sm whitespace-nowrap">
        {formatYen(budget)}
      </td>
      <td style={{ color: PAL.body }} className="py-2 pr-3 text-right text-sm whitespace-nowrap">
        {formatYen(actual)}
      </td>
      <td
        style={{ color: t.remaining < 0 ? PAL.red : PAL.body }}
        className="py-2 pr-3 text-right text-sm font-semibold whitespace-nowrap"
      >
        {formatYen(t.remaining)}
      </td>
      <td className="py-2 pl-1" style={{ minWidth: 120 }}>
        <RateBar rate={t.rate} />
      </td>
    </>
  );
}

function ItemRow({ item }: { item: BudgetRow }) {
  return (
    <tr style={{ borderTop: `1px solid ${PAL.borderLt}` }}>
      <td style={{ color: PAL.body }} className="py-2 pr-3 pl-4 text-sm">
        <span style={{ color: item.known ? PAL.slateLt : PAL.red }} className="mr-1.5 text-xs">
          {item.taskId}
        </span>
        {item.name}
        {item.note && (
          <span style={{ color: PAL.slateLt }} className="ml-2 text-xs">
            {item.note}
          </span>
        )}
      </td>
      <AmountCells budget={item.budget} actual={item.actual} />
    </tr>
  );
}

export default function BudgetView({ data }: { data: DashboardData }) {
  const { basis, setBasis, period, nextEvent } = useDashboardState(data);
  const rows = joinBudget(data.budget, data.tasks);
  const total = budgetTotals(rows);
  const phases = groupBudget(rows);
  // 大項目も中項目も無い（全行が未分類）の場合はフラット表に落とす。
  const flat = phases.length === 1 && phases[0].phase === "" && phases[0].activities.length === 1;

  return (
    <DashboardShell
      data={data}
      active="budget"
      basis={basis}
      onBasis={setBasis}
      period={period}
      nextEvent={nextEvent}
    >
      <div className="space-y-6">
        {/* 予実サマリー KPI */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <KPI label="予算合計" value={formatYen(total.budget)} />
          <KPI label="実績合計" value={formatYen(total.actual)} accent={PAL.brand} />
          <KPI
            label="消化率"
            value={formatRate(total.rate)}
            accent={total.rate !== null && total.rate > 1 ? PAL.red : undefined}
          />
          <KPI
            label="残額"
            value={formatYen(total.remaining)}
            accent={total.remaining < 0 ? PAL.red : PAL.green}
          />
        </div>

        {/* 小項目（タスク）別の予実表（大項目 → 中項目 → 小項目） */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>小項目（タスク）別 予実</SectionTitle>
            <span style={{ color: PAL.slateLt }} className="text-xs">
              金額ベース（Sheet の <code>budget</code> タブ・タスクID単位）
            </span>
          </div>

          {rows.length === 0 ? (
            <div style={{ color: PAL.slateLt }} className="text-xs">
              予実データがありません。Sheet に <code>budget</code> タブ（A:task_id / B:budget /
              C:actual / D:note）を作成し、タスクID単位で予算・実績を記入すると表示されます。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["小項目（タスク）", "予算", "実績", "残額", "消化率"].map((h, i) => (
                      <th
                        key={h}
                        style={{ color: PAL.slateLt }}
                        className={`pb-2 text-xs font-semibold ${
                          i === 0 ? "text-left" : i === 4 ? "pl-1 text-left" : "pr-3 text-right"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flat
                    ? rows.map((b) => <ItemRow key={b.taskId} item={b} />)
                    : phases.map((p) => {
                        const pt = budgetTotals(p.activities.flatMap((a) => a.items));
                        return [
                          // 大項目ヘッダ（小計付き）
                          <tr key={`p-${p.phase}`} style={{ borderTop: `2px solid ${PAL.border}` }}>
                            <td style={{ color: PAL.ink }} className="pt-3 pb-1 text-sm font-bold">
                              {p.phase || "（未分類）"}
                            </td>
                            <AmountCells budget={pt.budget} actual={pt.actual} />
                          </tr>,
                          // 中項目グループ（小計付き）→ 小項目（タスク）行
                          ...p.activities.flatMap((a) => {
                            const at = budgetTotals(a.items);
                            const key = `${p.phase}-${a.activity}`;
                            return [
                              a.activity ? (
                                <tr key={`a-${key}`}>
                                  <td
                                    style={{ color: PAL.slate }}
                                    className="pt-2 pb-1 pl-2 text-xs font-bold"
                                  >
                                    {a.activity}
                                    <span
                                      style={{ color: PAL.slateLt }}
                                      className="ml-2 font-normal"
                                    >
                                      小計 {formatYen(at.budget)} → {formatYen(at.actual)}（
                                      {formatRate(at.rate)}）
                                    </span>
                                  </td>
                                  <td colSpan={4} />
                                </tr>
                              ) : null,
                              ...a.items.map((b) => <ItemRow key={b.taskId} item={b} />),
                            ].filter(Boolean);
                          }),
                        ];
                      })}
                  <tr style={{ borderTop: `2px solid ${PAL.border}` }}>
                    <td style={{ color: PAL.ink }} className="py-2.5 pr-3 text-sm font-bold">
                      合計
                    </td>
                    <AmountCells budget={total.budget} actual={total.actual} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
