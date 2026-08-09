import type { BudgetItem, Task } from "@/lib/types";

// 予実（金額）の集計・整形。生データは Sheet の budget タブ（task_id 単位）、
// 名称・分類（大項目・中項目）は tasks タブから引く。計算はすべてここ（UI 側に置かない）。

export interface BudgetTotals {
  budget: number;
  actual: number;
  /** 消化率 actual/budget（予算 0 なら null） */
  rate: number | null;
  /** 残額 budget - actual（マイナス＝超過） */
  remaining: number;
}

/** タスク情報と結合済みの予実1行。 */
export interface BudgetRow extends BudgetItem {
  /** タスク名（tasks に無い taskId の場合はID表示のフォールバック） */
  name: string;
  /** 大項目（tasks.phase） */
  phase: string;
  /** 中項目（tasks.activity） */
  activity: string;
  /** tasks に対応行があるか（無い行は入力ミスの可能性として明示表示） */
  known: boolean;
}

/** 予実サマリーを計算する。 */
export function budgetTotals(items: { budget: number; actual: number }[]): BudgetTotals {
  const budget = items.reduce((s, b) => s + b.budget, 0);
  const actual = items.reduce((s, b) => s + b.actual, 0);
  return {
    budget,
    actual,
    rate: budget > 0 ? actual / budget : null,
    remaining: budget - actual,
  };
}

/** budget タブの行を tasks と結合し、tasks の行順（＝大項目→中項目の階層順）に並べる。 */
export function joinBudget(budget: BudgetItem[], tasks: Task[]): BudgetRow[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const order = new Map(tasks.map((t, i) => [t.id, i]));
  return budget
    .map((b) => {
      const t = byId.get(b.taskId);
      return {
        ...b,
        name: t ? t.name : `（タスク未登録: ${b.taskId}）`,
        phase: t?.phase ?? "",
        activity: t?.activity ?? "",
        known: !!t,
      };
    })
    .slice()
    .sort((a, b) => (order.get(a.taskId) ?? 1e9) - (order.get(b.taskId) ?? 1e9));
}

/** 大項目（phase）→ 中項目（activity）の2階層でグルーピングする。空の分類は末尾。 */
export function groupBudget(
  rows: BudgetRow[],
): { phase: string; activities: { activity: string; items: BudgetRow[] }[] }[] {
  const phases: { phase: string; activities: { activity: string; items: BudgetRow[] }[] }[] = [];
  for (const r of rows) {
    let p = phases.find((x) => x.phase === r.phase);
    if (!p) {
      p = { phase: r.phase, activities: [] };
      phases.push(p);
    }
    let a = p.activities.find((x) => x.activity === r.activity);
    if (!a) {
      a = { activity: r.activity, items: [] };
      p.activities.push(a);
    }
    a.items.push(r);
  }
  return phases;
}

/** 金額（円）を「¥1,234,567」形式に整形する。 */
export function formatYen(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}¥${Math.abs(Math.round(n)).toLocaleString("ja-JP")}`;
}

/** 消化率を「63%」形式に。予算 0（null）は「—」。 */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}
