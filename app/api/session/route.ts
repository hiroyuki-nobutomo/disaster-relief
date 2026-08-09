import { authEnabled } from "@/lib/relief/auth";
import { currentMember } from "@/lib/relief/auth-server";

// 現在のログイン状態（担当者）を返す。ヘッダの表示・ログアウトメニューに使う。
export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = authEnabled();
  const member = enabled ? await currentMember() : null;
  return Response.json(
    { authEnabled: enabled, memberId: member?.id ?? null, name: member?.name ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
