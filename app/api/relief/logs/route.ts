import { authEnabled } from "@/lib/relief/auth";
import { currentMember } from "@/lib/relief/auth-server";
import { updateLogVisibility } from "@/lib/relief/sheets-write";

// 記録（logs）の公開範囲変更。下書き→共有 など、作成者本人のみ実行できる。
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  if (!authEnabled()) {
    return Response.json(
      { error: "ログインが設定されていないため、公開範囲は変更できません。" },
      { status: 400 },
    );
  }
  const member = await currentMember();
  if (!member) return Response.json({ error: "ログインが必要です。" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; visibility?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const visibility = typeof body.visibility === "string" ? body.visibility : "";
  if (!id || !["共有", "下書き", "プライベート"].includes(visibility)) {
    return Response.json(
      { error: "id と公開範囲（共有/下書き/プライベート）を指定してください。" },
      { status: 400 },
    );
  }
  const r = await updateLogVisibility(
    id,
    visibility as "共有" | "下書き" | "プライベート",
    member.id,
  );
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ ok: true });
}
