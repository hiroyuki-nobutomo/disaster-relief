import { isMultiTenant } from "@/lib/projects";
import { currentProject } from "@/lib/session";

// 現在のログイン状態（プロジェクトID）を返す。ヘッダのログアウト表示などに使う。
export const dynamic = "force-dynamic";

export async function GET() {
  const multiTenant = isMultiTenant();
  const project = multiTenant ? await currentProject() : null;
  return Response.json(
    { multiTenant, projectId: project?.id ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
