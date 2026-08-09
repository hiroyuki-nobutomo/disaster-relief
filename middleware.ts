import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isMultiTenant, verifySession } from "@/lib/projects";

// マルチテナント（PROJECTS 設定時）のみ全ページ・APIをログイン必須にする。
// シングルテナント（従来の SHEET_ID 運用）では何もしない＝後方互換。
//
// 認証情報はリクエストの Cookie（署名付きセッション）で判定。Web Crypto のみ使うため Edge で動く。

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout"]);

export async function middleware(req: NextRequest) {
  if (!isMultiTenant()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const id = token ? await verifySession(token) : null;
  if (id) return NextResponse.next();

  // 未認証: API は 401、ページはログイン画面へ（戻り先を next で保持）。
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname && pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // 静的アセット・画像最適化・favicon を除く全リクエストに適用。
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
