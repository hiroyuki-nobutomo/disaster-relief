import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import { isMultiTenant } from "@/lib/projects";
import { currentProject } from "@/lib/session";

// Google Sheets への接続を読み取り・書き込みで共有する基盤。
// 認証情報の組み立て（private_key の改行復元）と環境変数チェックは
// 読み取り(lib/sheets.ts)・書き込み(lib/sheets-write.ts)で同一なので、ここに集約する。

/**
 * サービスアカウントが揃っており、対象シートを解決できるか。
 *  - シングルテナント: SHEET_ID（従来どおり）。
 *  - マルチテナント: PROJECTS が設定されていれば対象はログインセッションから解決する。
 * 揃っていなければローカルは SEED 表示で動く。
 */
export function hasSheetsCreds(): boolean {
  const hasServiceAccount = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY,
  );
  if (!hasServiceAccount) return false;
  return isMultiTenant() || Boolean(process.env.SHEET_ID);
}

/**
 * 現在の文脈で対象とするスプレッドシート ID を解決する。
 *  - マルチテナント: ログイン中プロジェクトの sheetId（未ログイン・失効時は空文字）。
 *  - シングルテナント: 環境変数 SHEET_ID。
 * 空文字が返った場合、呼び出し側は SEED 表示／エラー応答で安全に扱うこと。
 */
export async function activeSheetId(): Promise<string> {
  if (isMultiTenant()) {
    const p = await currentProject();
    return p?.sheetId ?? "";
  }
  return process.env.SHEET_ID ?? "";
}

const SCOPES = {
  read: "https://www.googleapis.com/auth/spreadsheets.readonly",
  write: "https://www.googleapis.com/auth/spreadsheets",
} as const;

/** 指定スコープで認証オブジェクトを返す。Sheets / Drive など各 Google API で共用。 */
export function googleAuth(scopes: string[]) {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    },
    scopes,
  });
}

/** 指定モードのスコープで認証済み Sheets クライアントを返す。 */
export function sheetsClient(mode: "read" | "write"): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: googleAuth([SCOPES[mode]]) });
}
