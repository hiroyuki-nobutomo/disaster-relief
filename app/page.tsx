import ReliefApp from "@/components/relief/ReliefApp";
import { getReliefData } from "@/lib/relief/sheets";
import { currentMember } from "@/lib/relief/auth-server";

// ログイン中の担当者（Cookie）に応じて logs のフィルタと個人出し分けが変わるため動的描画。
export const dynamic = "force-dynamic";

export default async function Page() {
  const member = await currentMember();
  const data = await getReliefData(member);
  return <ReliefApp initial={data} />;
}
