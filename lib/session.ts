import { cookies } from "next/headers";
import { SESSION_COOKIE, findProject, isMultiTenant, verifySession } from "@/lib/projects";

// リクエストスコープで現在のログインセッションを解決する（next/headers 依存＝サーバ専用）。
// middleware と違い、ここはページ／ルートハンドラ／サーバアクションから使う。

/** 現在ログイン中のプロジェクト（id と対象 sheetId）。未ログイン・シングルテナントは null。 */
export async function currentProject(): Promise<{ id: string; sheetId: string } | null> {
  if (!isMultiTenant()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = await verifySession(token);
  if (!id) return null;
  const p = findProject(id);
  return p ? { id: p.id, sheetId: p.sheetId } : null;
}
