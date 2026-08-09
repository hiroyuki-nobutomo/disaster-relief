import { activeSheetId, hasSheetsCreds, sheetsClient } from "@/lib/google-sheets";

// 災害対応データの書き込み層。
// ガードレール（PMダッシュボード時代からの方針を踏襲）:
//  - 書き込みは「行の追記」のみ。既存行の更新・削除はスプレッドシート側で行う（v1）。
//  - id は各シートの接頭辞で自動採番（例 M-01, SP-003）。呼び出し側は指定しない。
//  - 全件を事前検証し、1件でも不正なら何も書き込まない（all-or-nothing）。
//  - 先頭が = + - @ 等のセルはテキスト強制（数式インジェクション対策）。

export { hasSheetsCreds as hasReliefWriteCreds };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && v === d.toISOString().slice(0, 10);
}

function safeText(s: string): string {
  return /^[=+\-@\t\r\n]/.test(s) ? `'${s}` : s;
}

function nowJST(): string {
  const d = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => d.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** 取り込み対象シートの定義（タブ名・ID接頭辞・列数・行の組み立てと検証）。 */
export type ReliefTable =
  | "members"
  | "schedule"
  | "bookings"
  | "supplies"
  | "requests"
  | "shelters"
  | "contacts"
  | "logs";

type Rec = Record<string, string | undefined>;

type TableDef = {
  idPrefix: string;
  idPad: number; // 連番の桁数（例 2 → M-01）
  lastCol: string; // A〜lastCol
  /** id を除いた B 列以降の値を組み立てる。不正なら error を返す。 */
  build: (r: Rec) => { ok: true; cells: string[] } | { ok: false; error: string };
};

const v = (r: Rec, k: string): string => String(r[k] ?? "").trim();

function requireDate(r: Rec, k: string, label: string): string | { error: string } {
  const d = v(r, k);
  if (!isValidDate(d))
    return { error: `${label}は YYYY-MM-DD 形式で指定してください（受領: ${d || "空"}）。` };
  return d;
}

function optionalDate(r: Rec, k: string, label: string): string | { error: string } {
  const d = v(r, k);
  if (d === "") return "";
  return requireDate(r, k, label);
}

function optionalTime(r: Rec, k: string, label: string): string | { error: string } {
  const t = v(r, k);
  if (t === "") return "";
  if (!TIME_RE.test(t)) return { error: `${label}は HH:MM 形式で指定してください（受領: ${t}）。` };
  return t;
}

function pick<T extends string>(r: Rec, k: string, allowed: readonly T[], fallback: T): T {
  const t = v(r, k) as T;
  return allowed.includes(t) ? t : fallback;
}

const isErr = (x: string | { error: string }): x is { error: string } => typeof x !== "string";

export const RELIEF_TABLES: Record<ReliefTable, TableDef> = {
  members: {
    idPrefix: "M-",
    idPad: 2,
    lastCol: "I",
    build: (r) => {
      const name = v(r, "name");
      if (!name) return { ok: false, error: "氏名（name）は必須です。" };
      return {
        ok: true,
        cells: [
          name,
          v(r, "kana"),
          v(r, "org"),
          v(r, "role"),
          v(r, "groupId"),
          v(r, "phone"),
          v(r, "email"),
          v(r, "note"),
        ],
      };
    },
  },
  schedule: {
    idPrefix: "SC-",
    idPad: 3,
    lastCol: "I",
    build: (r) => {
      const title = v(r, "title");
      if (!title) return { ok: false, error: "予定の内容（title）は必須です。" };
      const date = requireDate(r, "date", "日付");
      if (isErr(date)) return { ok: false, ...date };
      const start = optionalTime(r, "start", "開始時刻");
      if (isErr(start)) return { ok: false, ...start };
      const end = optionalTime(r, "end", "終了時刻");
      if (isErr(end)) return { ok: false, ...end };
      const scope = pick(r, "scope", ["全体", "グループ", "個人"] as const, "全体");
      const targetId = v(r, "targetId");
      if (scope !== "全体" && !targetId) {
        return { ok: false, error: `scope=${scope} の予定には targetId（対象のID）が必要です。` };
      }
      return {
        ok: true,
        cells: [
          date,
          start,
          end,
          scope,
          scope === "全体" ? "" : targetId,
          title,
          v(r, "place"),
          v(r, "note"),
        ],
      };
    },
  },
  bookings: {
    idPrefix: "B-",
    idPad: 3,
    lastCol: "J",
    build: (r) => {
      const name = v(r, "name");
      if (!name) return { ok: false, error: "予約名（ホテル名・便名等）は必須です。" };
      const memberId = v(r, "memberId");
      if (!memberId) return { ok: false, error: "対象の担当者（memberId）は必須です。" };
      const sd = requireDate(r, "startDate", "開始日");
      if (isErr(sd)) return { ok: false, ...sd };
      const ed = optionalDate(r, "endDate", "終了日");
      if (isErr(ed)) return { ok: false, ...ed };
      if (ed !== "" && ed < sd) return { ok: false, error: "終了日が開始日より前になっています。" };
      return {
        ok: true,
        cells: [
          memberId,
          pick(
            r,
            "type",
            ["ホテル", "飛行機", "新幹線", "レンタカー", "その他"] as const,
            "その他",
          ),
          sd,
          ed,
          name,
          v(r, "detail"),
          v(r, "confNo"),
          pick(r, "status", ["予約済", "仮予約", "キャンセル"] as const, "仮予約"),
          v(r, "note"),
        ],
      };
    },
  },
  supplies: {
    idPrefix: "SP-",
    idPad: 3,
    lastCol: "M",
    build: (r) => {
      const item = v(r, "item");
      if (!item) return { ok: false, error: "品目名（item）は必須です。" };
      const ship = optionalDate(r, "shipDate", "発送日");
      if (isErr(ship)) return { ok: false, ...ship };
      const arrive = optionalDate(r, "arriveDate", "到着日");
      if (isErr(arrive)) return { ok: false, ...arrive };
      return {
        ok: true,
        cells: [
          v(r, "lotNo"),
          item,
          v(r, "category"),
          v(r, "qty"),
          v(r, "unit"),
          v(r, "from"),
          v(r, "toShelterId"),
          pick(r, "status", ["手配中", "輸送中", "到着", "配布済"] as const, "手配中"),
          ship,
          arrive,
          v(r, "requestId"),
          v(r, "note"),
        ],
      };
    },
  },
  requests: {
    idPrefix: "R-",
    idPad: 3,
    lastCol: "H",
    build: (r) => {
      const content = v(r, "content");
      if (!content) return { ok: false, error: "要請内容（content）は必須です。" };
      const date = requireDate(r, "date", "受付日");
      if (isErr(date)) return { ok: false, ...date };
      return {
        ok: true,
        cells: [
          date,
          v(r, "shelterId"),
          content,
          v(r, "qty"),
          pick(r, "urgency", ["高", "中", "低"] as const, "中"),
          pick(r, "status", ["受付", "手配中", "対応済"] as const, "受付"),
          v(r, "note"),
        ],
      };
    },
  },
  shelters: {
    idPrefix: "SH-",
    idPad: 2,
    lastCol: "L",
    build: (r) => {
      const name = v(r, "name");
      if (!name) return { ok: false, error: "避難所・拠点名（name）は必須です。" };
      return {
        ok: true,
        cells: [
          name,
          v(r, "type"),
          v(r, "address"),
          v(r, "mapUrl"),
          v(r, "contactName"),
          v(r, "phone"),
          v(r, "capacity"),
          v(r, "current"),
          v(r, "needs"),
          pick(r, "status", ["開設", "閉鎖"] as const, "開設"),
          v(r, "note"),
        ],
      };
    },
  },
  contacts: {
    idPrefix: "C-",
    idPad: 2,
    lastCol: "I",
    build: (r) => {
      const org = v(r, "org");
      if (!org) return { ok: false, error: "組織名（org）は必須です。" };
      return {
        ok: true,
        cells: [
          org,
          v(r, "name"),
          v(r, "role"),
          v(r, "category"),
          v(r, "phone"),
          v(r, "email"),
          v(r, "shelterId"),
          v(r, "note"),
        ],
      };
    },
  },
  logs: {
    idPrefix: "L-",
    idPad: 3,
    lastCol: "L",
    build: (r) => {
      const title = v(r, "title");
      if (!title) return { ok: false, error: "記録の見出し（title）は必須です。" };
      const dt = v(r, "datetime");
      // "YYYY-MM-DD" または "YYYY-MM-DD HH:MM"
      const [d, t] = dt.split(/\s+/);
      if (!isValidDate(d ?? "") || (t !== undefined && !TIME_RE.test(t))) {
        return {
          ok: false,
          error: `日時は「YYYY-MM-DD」または「YYYY-MM-DD HH:MM」で指定してください（受領: ${dt || "空"}）。`,
        };
      }
      return {
        ok: true,
        cells: [
          dt,
          pick(r, "kind", ["ヒアリング", "時系列", "指示・決定", "申し送り"] as const, "時系列"),
          v(r, "reporter"),
          v(r, "shelterId"),
          title,
          v(r, "content"),
          v(r, "tags"),
          v(r, "source"),
          // 公開範囲。既定は「共有」。下書き・プライベートは作成者本人のみ閲覧できる。
          pick(r, "visibility", ["共有", "下書き", "プライベート"] as const, "共有"),
          // 作成者（保存 API がログインセッションから設定する。クライアント指定は信用しない）
          v(r, "authorId"),
          nowJST(),
        ],
      };
    },
  },
};

// ── 添付画像（images タブ） ──────────────────────────────────────────────────
// A:F = id, ref_ids(カンマ区切り), mime, seq, data(base64チャンク), created_at
// Sheets のセル上限（5万文字）に収まるよう base64 を分割して複数行に保存する。

const IMAGE_CHUNK = 40_000; // 1セルあたりの base64 文字数
const IMAGE_MAX_BASE64 = 400_000; // 1枚あたり上限（≒300KB。クライアント側で圧縮済み想定）

export type ImageInput = { mime: string; base64: string };

/**
 * 圧縮済み画像を images タブへ追記し、refIds（保存済みレコードのID群）に紐づける。
 * 失敗してもレコード本体の保存は成立している前提で、エラーは呼び出し側が通知に使う。
 */
export async function appendReliefImages(
  images: ImageInput[],
  refIds: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  if (!images.length) return { ok: true, ids: [] };
  if (images.length > 5) return { ok: false, error: "画像は一度に5枚までです。" };
  for (const [i, img] of images.entries()) {
    if (!/^image\/(jpeg|png|webp)$/.test(img.mime)) {
      return { ok: false, error: `${i + 1}枚目: 対応していない画像形式です（${img.mime}）。` };
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(img.base64) || img.base64.length === 0) {
      return { ok: false, error: `${i + 1}枚目: 画像データが不正です。` };
    }
    if (img.base64.length > IMAGE_MAX_BASE64) {
      return { ok: false, error: `${i + 1}枚目: 画像が大きすぎます（圧縮後300KBまで）。` };
    }
  }

  const sid = await activeSheetId();
  if (!hasSheetsCreds() || !sid) {
    return { ok: false, error: "Google Sheet の接続情報が未設定のため画像を保存できません。" };
  }
  const sheets = sheetsClient("write");
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: "images!A2:A" });
    const ids = (res.data.values ?? []).map((r) => String(r?.[0] ?? "").trim());
    let n = nextIdNumber(ids, "IMG-");
    const created = nowJST();
    const refs = refIds.join(",");
    const values: string[][] = [];
    const newIds: string[] = [];
    for (const img of images) {
      const id = `IMG-${String(n++).padStart(3, "0")}`;
      newIds.push(id);
      const chunks = Math.ceil(img.base64.length / IMAGE_CHUNK);
      for (let c = 0; c < chunks; c++) {
        values.push([
          id,
          refs,
          img.mime,
          String(c + 1),
          img.base64.slice(c * IMAGE_CHUNK, (c + 1) * IMAGE_CHUNK),
          created,
        ]);
      }
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: "images!A2:F",
      valueInputOption: "RAW",
      requestBody: { values },
    });
    return { ok: true, ids: newIds };
  } catch {
    return {
      ok: false,
      error:
        "images タブに書き込めません。Sheet に images タブ（A:id / B:ref_ids / C:mime / D:seq / E:data / F:created_at）を作成してください。",
    };
  }
}

/**
 * logs の公開範囲を変更する（例: 下書き → 共有）。
 * 作成者本人（author_id 一致）だけが変更できる。
 */
export async function updateLogVisibility(
  logId: string,
  visibility: "共有" | "下書き" | "プライベート",
  requesterId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!["共有", "下書き", "プライベート"].includes(visibility)) {
    return { ok: false, error: "公開範囲の値が不正です。" };
  }
  const sid = await activeSheetId();
  if (!hasSheetsCreds() || !sid) {
    return { ok: false, error: "Google Sheet の接続情報が未設定のため変更できません。" };
  }
  const sheets = sheetsClient("write");
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: "logs!A2:K" });
  const rows = (res.data.values ?? []) as string[][];
  const idx = rows.findIndex((r) => String(r?.[0] ?? "").trim() === logId.trim());
  if (idx === -1) return { ok: false, error: `記録 id=${logId} が見つかりません。` };
  const authorId = String(rows[idx]?.[10] ?? "").trim();
  if (authorId === "" || authorId !== requesterId.trim()) {
    return { ok: false, error: "この記録の公開範囲を変更できるのは作成者本人だけです。" };
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `logs!J${idx + 2}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[visibility]] },
  });
  return { ok: true };
}

/** A 列の既存 id から次の連番を求める（接頭辞不一致の id は無視）。 */
function nextIdNumber(ids: string[], prefix: string): number {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

export type AppendResult =
  | { ok: true; table: ReliefTable; ids: string[] }
  | { ok: false; table: ReliefTable; error: string };

/**
 * 指定シートへレコードを追記する。id は自動採番。
 * シート単位で all-or-nothing（検証エラーが1件でもあればそのシートには書き込まない）。
 */
export async function appendReliefRows(table: ReliefTable, records: Rec[]): Promise<AppendResult> {
  const def = RELIEF_TABLES[table];
  if (!def) return { ok: false, table, error: `未知のシートです: ${table}` };
  if (!records.length) return { ok: false, table, error: "登録する行がありません。" };
  if (records.length > 50) return { ok: false, table, error: "一度に登録できるのは50件までです。" };

  // 全件検証（id 以外のセルを組み立て）。
  const built: string[][] = [];
  for (const [i, rec] of records.entries()) {
    const b = def.build(rec);
    if (!b.ok) return { ok: false, table, error: `${i + 1}件目: ${b.error}` };
    built.push(b.cells.map(safeText));
  }

  const sid = await activeSheetId();
  if (!hasSheetsCreds() || !sid) {
    return { ok: false, table, error: "Google Sheet の接続情報が未設定のため保存できません。" };
  }
  const sheets = sheetsClient("write");

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: `${table}!A2:A`,
    });
    const ids = (res.data.values ?? []).map((r) => String(r?.[0] ?? "").trim());
    let n = nextIdNumber(ids, def.idPrefix);
    const newIds: string[] = [];
    const values = built.map((cells) => {
      const id = `${def.idPrefix}${String(n++).padStart(def.idPad, "0")}`;
      newIds.push(id);
      return [id, ...cells];
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: `${table}!A2:${def.lastCol}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return { ok: true, table, ids: newIds };
  } catch {
    return {
      ok: false,
      table,
      error: `${table} タブに書き込めません。Sheet に ${table} タブ（docs/DESIGN.md の列構成）を作成し、サービスアカウントを編集者にしてください。`,
    };
  }
}
