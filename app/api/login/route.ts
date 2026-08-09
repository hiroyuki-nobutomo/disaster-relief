import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  isMultiTenant,
  signSession,
  verifyCredentials,
} from "@/lib/projects";

// ログイン: ID＋パスワードを照合し、署名付きセッション Cookie を発行する。
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isMultiTenant()) {
    return Response.json({ error: "ログインは設定されていません。" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; password?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!id || !password) {
    return Response.json({ error: "ID とパスワードを入力してください。" }, { status: 400 });
  }

  const projectId = await verifyCredentials(id, password);
  if (!projectId) {
    return Response.json({ error: "ID またはパスワードが違います。" }, { status: 401 });
  }

  const token = await signSession(projectId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return Response.json({ ok: true, id: projectId });
}
