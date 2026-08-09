import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  authEnabled,
  hashPassword,
  timingSafeEqual,
  verifySession,
} from "@/lib/relief/auth";
import { activeSheetId, hasSheetsCreds, sheetsClient } from "@/lib/google-sheets";

// 担当者認証のサーバ専用部分（next/headers・Sheets 照合に依存するため middleware からは使わない）。

export type SessionMember = { id: string; name: string };

/** members タブから id → { name, password } を引く（password は照合にのみ使い、外へ出さない）。 */
async function readMemberAuthRow(
  memberId: string,
): Promise<{ name: string; password: string } | null> {
  if (!hasSheetsCreds()) return null;
  const sid = await activeSheetId();
  if (!sid) return null;
  try {
    const sheets = sheetsClient("read");
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: "members!A2:J",
    });
    const row = (r.data.values ?? []).find(
      (x) =>
        String(x?.[0] ?? "")
          .trim()
          .toLowerCase() === memberId.trim().toLowerCase(),
    );
    if (!row) return null;
    return { name: String(row[1] ?? "").trim(), password: String(row[9] ?? "").trim() };
  } catch {
    return null;
  }
}

/**
 * 担当者ID＋パスワードを照合する。members の password 列（J列）は
 * 平文・ハッシュ（scripts/hash-password.mjs の出力）のどちらでも照合できる。
 * password 列が空の担当者はログイン不可（成りすまし防止）。
 */
export async function verifyMemberLogin(
  memberId: string,
  password: string,
): Promise<SessionMember | null> {
  const row = await readMemberAuthRow(memberId);
  if (!row || row.password === "") return null;
  const hashed = await hashPassword(password);
  const ok = timingSafeEqual(row.password, password) || timingSafeEqual(row.password, hashed);
  return ok ? { id: memberId.trim(), name: row.name } : null;
}

/** 現在ログイン中の担当者。未ログイン・認証無効時は null。 */
export async function currentMember(): Promise<SessionMember | null> {
  if (!authEnabled()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = await verifySession(token);
  if (!id) return null;
  // 署名が有効でも、名簿から消えた担当者は拒否する。
  const row = await readMemberAuthRow(id);
  return row ? { id, name: row.name } : null;
}
