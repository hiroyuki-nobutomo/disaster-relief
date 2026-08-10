import type { Metadata } from "next";
import OpsView from "@/components/relief/OpsView";
import { getReliefData } from "@/lib/relief/sheets";
import { currentMember } from "@/lib/relief/auth-server";

// オペレーションルーム用の統合ボード。4K・大型ディスプレイでの常時表示を想定。
// 認証は他ページと同じ（AUTH_SECRET 設定時はログイン必須）。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "オペレーションルーム｜災害対応 情報管理",
};

export default async function OpsPage() {
  const member = await currentMember();
  const data = await getReliefData(member);
  return <OpsView initial={data} />;
}
