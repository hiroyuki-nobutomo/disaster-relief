import BudgetView from "@/components/BudgetView";
import { getDashboardData } from "@/lib/sheets";

export const revalidate = 60;

export default async function BudgetPage() {
  const data = await getDashboardData();
  return <BudgetView data={data} />;
}
