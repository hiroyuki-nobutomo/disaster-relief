import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, verifySession } from "@/lib/relief/auth";

// 担当者ログイン（AUTH_SECRET 設定時のみ）の入口ガード（Next.js 16 の proxy 規約）。
// 未設定のとき（ローカル・デモ）は何もしない。
//
// Cookie の署名検証だけを Edge で行い、名簿との突き合わせはサーバ側
// （lib/relief/auth-server.currentMember）が行う二段構え。

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout"]);

export async function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

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
