import DashboardView from "@/components/DashboardView";
import { getDashboardData } from "@/lib/sheets";

export const revalidate = 60;

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardView data={data} />;
}
