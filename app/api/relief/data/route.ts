import { getReliefData } from "@/lib/relief/sheets";
import { currentMember } from "@/lib/relief/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await currentMember();
  const data = await getReliefData(member);
  return Response.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
