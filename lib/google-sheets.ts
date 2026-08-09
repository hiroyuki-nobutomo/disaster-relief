import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";

// Google Sheets への接続基盤（読み取り・書き込みで共有）。
// 認証情報の組み立て（private_key の改行復元）と環境変数チェックをここに集約する。

/** サービスアカウントと対象シート（SHEET_ID）が揃っているか。無ければ SEED 表示で動く。 */
export function hasSheetsCreds(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.SHEET_ID,
  );
}

/** 対象スプレッドシート ID（環境変数 SHEET_ID）。未設定は空文字。 */
export async function activeSheetId(): Promise<string> {
  return process.env.SHEET_ID ?? "";
}

const SCOPES = {
  read: "https://www.googleapis.com/auth/spreadsheets.readonly",
  write: "https://www.googleapis.com/auth/spreadsheets",
} as const;

/** 指定スコープで認証オブジェクトを返す。 */
function googleAuth(scopes: string[]) {
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
