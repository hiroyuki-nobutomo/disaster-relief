import OverviewView from "@/components/OverviewView";
import { getDashboardData } from "@/lib/sheets";

// Sheets を開いている人の編集が概ね 1 分以内に反映されるよう、60 秒で再検証（HANDOFF §6）。
// マルチテナント時は getDashboardData が Cookie を参照するため、Next が自動的に動的描画へ切替える。
export const revalidate = 60;

export default async function Page() {
  const data = await getDashboardData();
  return <OverviewView data={data} />;
}
