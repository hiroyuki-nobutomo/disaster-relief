// Google Sheets の列定義の単一情報源（Single Source of Truth）。
//
// 各タブの「列の並び・シート上のヘッダー名・コード内のキー名」をここで一度だけ定義し、
//  - 読み取り層 lib/relief/sheets.ts（取得レンジ・行→レコード変換）
//  - 書き込み層 lib/relief/sheets-write.ts（追記時の列順・セル位置）
//  - 認証層 lib/relief/auth-server.ts（members の name / password 列）
//  - 雛形 docs/seed/*.csv（scripts/check-schema.mts がヘッダー一致を検証）
// のすべてがこれを参照する。列を増減・並べ替えするときはこのファイルと seed CSV を直し、
// `npm run check:schema` で一致を確認する（docs/DESIGN.md §2 は人間向けの説明）。

export type ColumnDef = {
  /** コード内のキー（lib/relief/types.ts のフィールド名と一致させる） */
  key: string;
  /** シート1行目のヘッダー名（docs/seed/*.csv と一致させる） */
  header: string;
  /** true ならクライアントへ返さない（読み取りレンジから除外。例: members.password） */
  clientHidden?: boolean;
};

export type SheetDef = {
  /** タブ名（シート・API 双方でこの名前を使う） */
  name: string;
  /** id 自動採番の接頭辞・連番桁数（meta のような id 無しタブは未設定） */
  idPrefix?: string;
  idPad?: number;
  /** A列からの列定義（先頭は id。meta と images は独自構成） */
  columns: ColumnDef[];
};

const c = (key: string, header: string, clientHidden?: boolean): ColumnDef => ({
  key,
  header,
  ...(clientHidden ? { clientHidden } : {}),
});

export const SHEETS = {
  meta: {
    name: "meta",
    columns: [c("key", "key"), c("value", "value")],
  },
  members: {
    name: "members",
    idPrefix: "M-",
    idPad: 2,
    columns: [
      c("id", "id"),
      c("name", "name"),
      c("kana", "kana"),
      c("org", "org"),
      c("role", "role"),
      c("groupId", "group_id"),
      c("phone", "phone"),
      c("email", "email"),
      c("note", "note"),
      // ログイン照合専用。クライアントへは一切返さない。
      c("password", "password", true),
    ],
  },
  groups: {
    name: "groups",
    idPrefix: "G-",
    idPad: 1,
    columns: [
      c("id", "id"),
      c("name", "name"),
      c("mission", "mission"),
      c("leaderId", "leader_id"),
      c("note", "note"),
    ],
  },
  schedule: {
    name: "schedule",
    idPrefix: "SC-",
    idPad: 3,
    columns: [
      c("id", "id"),
      c("date", "date"),
      c("start", "start"),
      c("end", "end"),
      c("scope", "scope"),
      c("targetId", "target_id"),
      c("title", "title"),
      c("place", "place"),
      c("note", "note"),
    ],
  },
  bookings: {
    name: "bookings",
    idPrefix: "B-",
    idPad: 3,
    columns: [
      c("id", "id"),
      c("memberId", "member_id"),
      c("type", "type"),
      c("startDate", "start_date"),
      c("endDate", "end_date"),
      c("name", "name"),
      c("detail", "detail"),
      c("confNo", "conf_no"),
      c("status", "status"),
      c("note", "note"),
    ],
  },
  supplies: {
    name: "supplies",
    idPrefix: "SP-",
    idPad: 3,
    columns: [
      c("id", "id"),
      c("lotNo", "lot_no"),
      c("item", "item"),
      c("category", "category"),
      c("qty", "qty"),
      c("unit", "unit"),
      c("from", "from"),
      c("toShelterId", "to_shelter_id"),
      c("status", "status"),
      c("shipDate", "ship_date"),
      c("arriveDate", "arrive_date"),
      c("requestId", "request_id"),
      c("note", "note"),
    ],
  },
  requests: {
    name: "requests",
    idPrefix: "R-",
    idPad: 3,
    columns: [
      c("id", "id"),
      c("date", "date"),
      c("shelterId", "shelter_id"),
      c("content", "content"),
      c("qty", "qty"),
      c("urgency", "urgency"),
      c("status", "status"),
      c("note", "note"),
    ],
  },
  shelters: {
    name: "shelters",
    idPrefix: "SH-",
    idPad: 2,
    columns: [
      c("id", "id"),
      c("name", "name"),
      c("type", "type"),
      c("address", "address"),
      c("mapUrl", "map_url"),
      c("contactName", "contact_name"),
      c("phone", "phone"),
      c("capacity", "capacity"),
      c("current", "current"),
      c("needs", "needs"),
      c("status", "status"),
      c("note", "note"),
    ],
  },
  contacts: {
    name: "contacts",
    idPrefix: "C-",
    idPad: 2,
    columns: [
      c("id", "id"),
      c("org", "org"),
      c("name", "name"),
      c("role", "role"),
      c("category", "category"),
      c("phone", "phone"),
      c("email", "email"),
      c("shelterId", "shelter_id"),
      c("note", "note"),
    ],
  },
  logs: {
    name: "logs",
    idPrefix: "L-",
    idPad: 3,
    columns: [
      c("id", "id"),
      c("datetime", "datetime"),
      c("kind", "kind"),
      c("reporter", "reporter"),
      c("shelterId", "shelter_id"),
      c("title", "title"),
      c("content", "content"),
      c("tags", "tags"),
      c("source", "source"),
      c("visibility", "visibility"),
      c("authorId", "author_id"),
      c("createdAt", "created_at"),
    ],
  },
  images: {
    name: "images",
    idPrefix: "IMG-",
    idPad: 3,
    columns: [
      c("id", "id"),
      c("refIds", "ref_ids"),
      c("mime", "mime"),
      c("seq", "seq"),
      c("data", "data"),
      c("createdAt", "created_at"),
    ],
  },
} as const satisfies Record<string, SheetDef>;

export type SheetName = keyof typeof SHEETS;

/** 1始まりの列番号 → A1 記法の列（1→A, 2→B, …）。26列（Z）まで。 */
export function colLetter(n: number): string {
  if (n < 1 || n > 26) throw new Error(`列番号が範囲外です: ${n}`);
  return String.fromCharCode(64 + n);
}

/** 指定キーの列（1始まり）。無ければ例外（定義とコードのズレを即検知する）。 */
export function colIndex(def: SheetDef, key: string): number {
  const i = def.columns.findIndex((col) => col.key === key);
  if (i === -1) throw new Error(`${def.name} に列キー ${key} がありません`);
  return i + 1;
}

/** 指定キーの A1 列（例: logs の visibility → "J"）。 */
export function colLetterOf(def: SheetDef, key: string): string {
  return colLetter(colIndex(def, key));
}

/**
 * データ行の取得レンジ。clientHidden 列は末尾に置く前提で、
 * includeHidden=false のときは非公開列の手前まで（例: members!A2:I）。
 */
export function dataRange(def: SheetDef, opts?: { includeHidden?: boolean }): string {
  const cols = opts?.includeHidden ? def.columns : def.columns.filter((col) => !col.clientHidden);
  return `${def.name}!A2:${colLetter(cols.length)}`;
}

/** シート行（配列）→ キー付きレコード（全て文字列・trim済み）。 */
export function rowToRecord(def: SheetDef, row: unknown[]): Record<string, string> {
  const rec: Record<string, string> = {};
  def.columns.forEach((col, i) => {
    rec[col.key] = String(row?.[i] ?? "").trim();
  });
  return rec;
}

/** キー付きレコード → シート行（id 列を含む全列を定義順に並べる）。 */
export function recordToRow(def: SheetDef, rec: Record<string, string>): string[] {
  return def.columns.map((col) => rec[col.key] ?? "");
}

/** シート1行目のヘッダー（seed CSV との一致検証・新規シート作成の案内に使う）。 */
export function headers(def: SheetDef): string[] {
  return def.columns.map((col) => col.header);
}
