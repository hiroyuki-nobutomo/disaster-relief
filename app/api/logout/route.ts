import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/relief/auth";

// ログアウト: セッション Cookie を破棄する。
export const dynamic = "force-dynamic";

export async function POST() {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return Response.json({ ok: true });
}
