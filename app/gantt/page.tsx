import GanttView from "@/components/GanttView";
import { getDashboardData } from "@/lib/sheets";

export const revalidate = 60;

export default async function GanttPage() {
  const data = await getDashboardData();
  return <GanttView data={data} />;
}
