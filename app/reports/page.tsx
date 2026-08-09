import ReportsView from "@/components/ReportsView";
import { getDashboardData } from "@/lib/sheets";

export const revalidate = 60;

export default async function ReportsPage() {
  const data = await getDashboardData();
  return <ReportsView data={data} />;
}
