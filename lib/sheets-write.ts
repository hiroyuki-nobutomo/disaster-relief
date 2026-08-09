import type { sheets_v4 } from "googleapis";
import { activeSheetId, hasSheetsCreds, sheetsClient } from "@/lib/google-sheets";
import { isTime } from "@/lib/derive";

// ─────────────────────────────────────────────────────────────────────────────
// v2 PMエージェント用の「書き込み」モジュール（読み取り lib/sheets.ts と分離）。
//
// ガードレール（重要）:
//  - 触れてよいのは Google Sheet 上の「データセル」だけ:
//      tasks の name/owner/start/end/progress（既存行の phase/kind/no は変更不可）
//      meta の許可キー（project_name / org）
//      links の url（既存ラベルのみ）
//      行の追加は addTask（kind=task）/ addMilestone（節目）/ addEvent（予定）のみ。行の削除・kind 変更は不可
//  - フレーム・レイアウト・計算ロジック・コードには一切触れない（書き込みAPIを公開しない）。
//  - すべての値はここで検証してから書き込む（progress=0..1、date=YYYY-MM-DD）。
//
// 認証スコープは読み書き（spreadsheets）。実際に書けるかはサービスアカウントが
// 対象シートの「編集者」かどうかにも依存する（READMEの §5 / docs/SETUP.md §⑤）。
// ─────────────────────────────────────────────────────────────────────────────

// 接続情報のチェックは読み取りと同一。共有実装を re-export してドリフトを防ぐ。
export { hasSheetsCreds as hasWriteCreds };

const rw = (): sheets_v4.Sheets => sheetsClient("write");

/**
 * 対象スプレッドシート ID を解決する（マルチテナント時はログインセッション由来）。
 * 解決できなければ書き込み不可としてエラーを返すために空文字を投げる。
 */
async function activeSid(): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const sid = await activeSheetId();
  if (!sid) return { ok: false, error: "対象シートが未解決です（ログインを確認してください）。" };
  return { ok: true, sid };
}

/**
 * 指定タブの A 列を読み、最初の一致行の行番号（A2 起点）を返す。
 * tasks/meta/links いずれも「A 列をキーに 1 行を特定して書く」ため共通化する。
 */
async function findRow(
  sheets: sheets_v4.Sheets,
  sid: string,
  range: string,
  match: (cellA: string) => boolean,
): Promise<{ rows: string[][]; rowNum: number | null }> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range });
  const rows = (res.data.values ?? []) as string[][];
  const idx = rows.findIndex((r) => match(String(r?.[0] ?? "")));
  return { rows, rowNum: idx === -1 ? null : idx + 2 };
}

// ── 検証ヘルパ ───────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && v === d.toISOString().slice(0, 10);
}

/** 進捗を 0..1 に正規化。0..1 はそのまま、1 超〜100 は % とみなす。空文字・範囲外は null。 */
function normProgress(v: number | string): number | null {
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else {
    const s = String(v).replace("%", "").trim();
    if (s === "") return null; // 空入力を 0% と誤認しない
    n = Number(s);
  }
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) n = n / 100;
  if (n < 0 || n > 1) return null;
  return n;
}

export type EventInput = {
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  title: string;
  place?: string;
  url?: string;
  note?: string;
};

type NormEvent = {
  sd: string;
  st: string;
  ed: string;
  et: string;
  title: string;
  place: string;
  url: string;
  note: string;
};

/**
 * 予定（開始日時〜終了日時）を検証・正規化する。
 *  - startDate 必須。endDate 空なら startDate と同じ。endDate >= startDate。
 *  - 時刻は両方空＝終日 / 両方 HH:MM。片方だけは不可。
 *  - 同一日で時刻ありの場合のみ start<end を必須にする（複数日は時刻順は問わない）。
 *  - place / url / note は任意の自由記述。
 */
function normEvent(e: EventInput): { ok: true; v: NormEvent } | { ok: false; error: string } {
  const title = (e.title ?? "").trim();
  if (!title) return { ok: false, error: "予定の内容（名称）を指定してください。" };
  const sd = (e.startDate ?? "").trim();
  if (!isValidDate(sd)) return { ok: false, error: "開始日は YYYY-MM-DD 形式で指定してください。" };
  const ed = (e.endDate ?? "").trim() || sd;
  if (!isValidDate(ed)) return { ok: false, error: "終了日は YYYY-MM-DD 形式で指定してください。" };
  if (ed < sd) return { ok: false, error: "終了日が開始日より前になっています。" };

  const place = (e.place ?? "").trim();
  const url = (e.url ?? "").trim();
  const note = (e.note ?? "").trim();

  const st = (e.startTime ?? "").trim();
  const et = (e.endTime ?? "").trim();
  if (!st && !et) return { ok: true, v: { sd, st: "", ed, et: "", title, place, url, note } };
  if (!st || !et)
    return { ok: false, error: "開始時刻と終了時刻は両方指定してください（終日は両方空）。" };
  if (!isTime(st) || !isTime(et)) {
    return { ok: false, error: "時刻は HH:MM 形式で指定してください（例 10:00）。" };
  }
  if (sd === ed && st >= et) {
    return { ok: false, error: "同じ日では開始時刻が終了時刻以降になっています。" };
  }
  return { ok: true, v: { sd, st, ed, et, title, place, url, note } };
}

// CSV/数式インジェクション対策。USER_ENTERED は先頭が = + - @（やタブ/改行）のセルを
// 数式として解釈するため、テキスト強制の先頭クォートを付けて無害化する。
// 数値・日付は数字始まりなので影響を受けない。
function safeText(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

// ── tasks ────────────────────────────────────────────────────────────────────
// A:I = id, phase(大項目), activity(中項目), kind, name, owner, start, end, progress
// id はプロジェクト内で一意の文字列（例: "1-3"）。行の特定はすべて id で行う。

const TASK_COL: Record<string, string> = {
  name: "E",
  owner: "F",
  start: "G",
  end: "H",
  progress: "I",
};

export type TaskFields = Partial<{
  name: string;
  owner: string;
  start: string;
  end: string;
  progress: number | string;
}>;

/** tasks の指定 id の行を探し、許可フィールドのみ検証して更新する。 */
export async function updateTask(
  id: string,
  fields: TaskFields,
): Promise<{ ok: true; applied: Record<string, string> } | { ok: false; error: string }> {
  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();

  // A:I を読み、行番号と現在値を取得。
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: "tasks!A2:I",
  });
  const rows = (res.data.values ?? []) as string[][];
  const idx = rows.findIndex((r) => String(r?.[0] ?? "").trim() === id.trim());
  if (idx === -1) return { ok: false, error: `タスク id=${id} が見つかりません。` };
  const rowNum = idx + 2;
  const curRow = rows[idx];

  const data: { range: string; values: string[][] }[] = [];
  const applied: Record<string, string> = {};
  // 開始/終了の整合チェック用に、更新後の値（未指定は現在値）を持つ。
  let newStart = String(curRow?.[6] ?? "").trim();
  let newEnd = String(curRow?.[7] ?? "").trim();

  for (const [key, raw] of Object.entries(fields)) {
    if (raw === undefined || raw === null) continue;
    if (!(key in TASK_COL)) {
      return {
        ok: false,
        error: `「${key}」は編集できない項目です（編集可: 名称/担当/開始/終了/進捗）。`,
      };
    }
    let cell: string;
    if (key === "progress") {
      const p = normProgress(raw as number | string);
      if (p === null) return { ok: false, error: `進捗の値が不正です（0〜100% で指定）。` };
      cell = String(p);
      applied[key] = `${Math.round(p * 100)}%`;
    } else if (key === "start" || key === "end") {
      const s = String(raw).trim();
      if (!isValidDate(s))
        return { ok: false, error: `日付は YYYY-MM-DD 形式で指定してください（受領: ${s}）。` };
      cell = s;
      applied[key] = s;
      if (key === "start") newStart = s;
      else newEnd = s;
    } else {
      cell = String(raw).trim();
      applied[key] = cell;
    }
    data.push({ range: `tasks!${TASK_COL[key]}${rowNum}`, values: [[safeText(cell)]] });
  }

  if (data.length === 0) return { ok: false, error: "更新対象の項目がありません。" };
  // 既存値を含めた最終的な開始/終了が逆転していないか（片方だけ変更時も検出）。
  if (isValidDate(newStart) && isValidDate(newEnd) && newStart > newEnd) {
    return {
      ok: false,
      error: `開始日が終了日より後になります（開始 ${newStart} / 終了 ${newEnd}）。`,
    };
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sid,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  return { ok: true, applied };
}

/** tasks の既存 id 一覧を返す（重複チェック・節目IDの自動採番に使用）。 */
async function existingIds(sheets: sheets_v4.Sheets, sid: string): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: "tasks!A2:A",
  });
  return (res.data.values ?? []).map((r) => String(r?.[0] ?? "").trim()).filter((v) => v !== "");
}

/**
 * 新しいタスク（kind=task）を tasks へ 1 件追加する。id は呼び出し側が指定
 * （例: 中項目2の小項目8なら "2-8"。既存IDの体系に合わせること）。重複IDは拒否。
 * progress 未指定は 0。phase（大項目）・activity（中項目）は既存と同じ表記を渡すこと。
 */
export async function addTask(fields: {
  id: string;
  phase: string;
  activity?: string;
  name: string;
  owner?: string;
  start: string;
  end: string;
  progress?: number | string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const id = fields.id.trim();
  const phase = fields.phase.trim();
  const nm = fields.name.trim();
  if (!id) return { ok: false, error: "タスクIDを指定してください（例: 2-8）。" };
  if (!phase) return { ok: false, error: "大項目（phase）を指定してください。" };
  if (!nm) return { ok: false, error: "タスク名を指定してください。" };
  const start = fields.start.trim();
  const end = fields.end.trim();
  if (!isValidDate(start) || !isValidDate(end)) {
    return { ok: false, error: "開始日・終了日は YYYY-MM-DD 形式で指定してください。" };
  }
  if (start > end) return { ok: false, error: "開始日が終了日より後になっています。" };
  let progress = 0;
  if (fields.progress !== undefined && fields.progress !== null && fields.progress !== "") {
    const p = normProgress(fields.progress);
    if (p === null) return { ok: false, error: "進捗の値が不正です（0〜100% で指定）。" };
    progress = p;
  }

  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();
  const ids = await existingIds(sheets, sid);
  if (ids.includes(id)) {
    return { ok: false, error: `タスク id=${id} は既に存在します。別のIDを指定してください。` };
  }

  // A:I = id, phase, activity, kind, name, owner, start, end, progress
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid,
    range: "tasks!A2:I",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          safeText(id),
          safeText(phase),
          safeText((fields.activity ?? "").trim()),
          "task",
          safeText(nm),
          safeText((fields.owner ?? "").trim()),
          start,
          end,
          String(progress),
        ],
      ],
    },
  });
  return { ok: true, id };
}

export type ScheduleUpdate = { id: string; start?: string; end?: string };

/**
 * 複数タスクの開始日・終了日を一括更新する（「1週間後ろ倒し」等の一括調整用）。
 * 全件を事前検証し、1件でも不正なら何も書き込まない（all-or-nothing）。
 */
export async function bulkUpdateTaskDates(
  updates: ScheduleUpdate[],
): Promise<{ ok: true; applied: string[] } | { ok: false; error: string }> {
  if (!updates.length) return { ok: false, error: "更新対象がありません。" };
  if (updates.length > 50) return { ok: false, error: "一度に更新できるのは50件までです。" };

  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();
  // A:I を読み、行番号と現在の開始/終了を取得（整合チェック用）。
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: "tasks!A2:I",
  });
  const rows = (res.data.values ?? []) as string[][];
  const idxOf = (id: string): number =>
    rows.findIndex((r) => String(r?.[0] ?? "").trim() === id.trim());

  // 全件検証 → ranges 組み立て（不正が1つでもあれば書き込まない）。
  const data: { range: string; values: string[][] }[] = [];
  const applied: string[] = [];
  for (const u of updates) {
    const idx = idxOf(u.id);
    if (idx === -1) return { ok: false, error: `タスク id=${u.id} が見つかりません。` };
    const rowNum = idx + 2;
    let newStart = String(rows[idx]?.[6] ?? "").trim();
    let newEnd = String(rows[idx]?.[7] ?? "").trim();
    const parts: string[] = [];
    for (const key of ["start", "end"] as const) {
      const v = u[key];
      if (v === undefined || v === null || String(v).trim() === "") continue;
      const s = String(v).trim();
      if (!isValidDate(s)) {
        return {
          ok: false,
          error: `タスク${u.id} の${key === "start" ? "開始日" : "終了日"}が不正です（${s}）。YYYY-MM-DD で指定してください。`,
        };
      }
      if (key === "start") newStart = s;
      else newEnd = s;
      data.push({ range: `tasks!${TASK_COL[key]}${rowNum}`, values: [[s]] });
      parts.push(`${key}=${s}`);
    }
    if (parts.length === 0) {
      return { ok: false, error: `タスク${u.id} に更新する日付がありません。` };
    }
    // 既存値を含めた最終的な開始/終了が逆転していないか。
    if (isValidDate(newStart) && isValidDate(newEnd) && newStart > newEnd) {
      return {
        ok: false,
        error: `タスク${u.id} は開始日が終了日より後になります（開始 ${newStart} / 終了 ${newEnd}）。`,
      };
    }
    applied.push(`id=${u.id}（${parts.join(", ")}）`);
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sid,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  return { ok: true, applied };
}

/**
 * 節目(milestone)を tasks へ 1 件追加する。
 * id は "M1", "M2", … の形式で自動採番（既存と重複しない最小番号）。
 * phase/activity/owner は空、start=end=指定日、progress は空（節目）。
 */
export async function addMilestone(
  name: string,
  date: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const nm = name.trim();
  if (!nm) return { ok: false, error: "名称を指定してください。" };
  const dt = date.trim();
  if (!isValidDate(dt)) {
    return { ok: false, error: `日付は YYYY-MM-DD 形式で指定してください（受領: ${dt}）。` };
  }

  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();
  const ids = new Set(await existingIds(sheets, sid));
  let n = 1;
  while (ids.has(`M${n}`)) n++;
  const id = `M${n}`;

  // A:I = id, phase, activity, kind, name, owner, start, end, progress
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid,
    range: "tasks!A2:I",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[id, "", "", "milestone", safeText(nm), "", dt, dt, ""]] },
  });
  return { ok: true, id };
}

/**
 * カレンダー予定（ミーティング等）を events タブへ 1 件追加する。
 * 節目(milestone)と違い tasks には触れないため、ガントチャートには出ない。
 */
export async function addEvent(
  e: EventInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = normEvent(e);
  if (!r.ok) return r;
  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const { sd, st, ed, et, title, place, url, note } = r.v;
  try {
    const sheets = rw();
    // A:H = startdate, starttime, enddate, endtime, title, place, url, note
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: "events!A2:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[sd, st, ed, et, safeText(title), safeText(place), safeText(url), safeText(note)]],
      },
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "events タブに書き込めません。Sheet に events タブ（A:startdate / B:starttime / C:enddate / D:endtime / E:title / F:place / G:url / H:note）を作成し、サービスアカウントを編集者にしてください。",
    };
  }
}

/** タブ名から sheetId(gid) を解決（行削除に必要）。 */
async function sheetGid(
  sheets: sheets_v4.Sheets,
  sid: string,
  title: string,
): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sid,
    fields: "sheets(properties(sheetId,title))",
  });
  const s = (meta.data.sheets ?? []).find((x) => x.properties?.title === title);
  return s?.properties?.sheetId ?? null;
}

/** events タブの指定行を更新（開始日時・終了日時・内容）。 */
export async function updateEvent(
  row: number,
  e: EventInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(row) || row < 2) return { ok: false, error: "対象行が不正です。" };
  const r = normEvent(e);
  if (!r.ok) return r;
  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const { sd, st, ed, et, title, place, url, note } = r.v;
  await rw().spreadsheets.values.update({
    spreadsheetId: sid,
    range: `events!A${row}:H${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[sd, st, ed, et, safeText(title), safeText(place), safeText(url), safeText(note)]],
    },
  });
  return { ok: true };
}

/** events タブの指定行を削除。 */
export async function deleteEvent(
  row: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(row) || row < 2) return { ok: false, error: "対象行が不正です。" };
  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();
  const gid = await sheetGid(sheets, sid, "events");
  if (gid === null) return { ok: false, error: "events タブが見つかりません。" };
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: gid, dimension: "ROWS", startIndex: row - 1, endIndex: row },
          },
        },
      ],
    },
  });
  return { ok: true };
}

/** tasks の指定 id の行を削除（節目の削除に使用）。 */
export async function deleteTask(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();
  const { rowNum } = await findRow(sheets, sid, "tasks!A2:A", (a) => a.trim() === id.trim());
  if (rowNum === null) return { ok: false, error: `タスク id=${id} が見つかりません。` };
  const gid = await sheetGid(sheets, sid, "tasks");
  if (gid === null) return { ok: false, error: "tasks タブが見つかりません。" };
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: gid, dimension: "ROWS", startIndex: rowNum - 1, endIndex: rowNum },
          },
        },
      ],
    },
  });
  return { ok: true };
}

// 表示順の変更先。先頭/末尾、または別タスク(refId)の直前/直後。
export type MoveTarget =
  | { position: "top" }
  | { position: "bottom" }
  | { position: "before"; refId: string }
  | { position: "after"; refId: string };

/**
 * tasks タブの行順（＝ガント／一覧の上からの表示順）を変更する。
 * 指定 id の行を、先頭/末尾、または別タスク(refId)の直前/直後へ moveDimension で物理移動する。
 * セルの値・型・書式は保持し、id（識別子）は変わらない。変化が無ければ書き込まない。
 */
export async function moveTask(
  id: string,
  target: MoveTarget,
): Promise<{ ok: true; order: string[] } | { ok: false; error: string }> {
  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();

  // A 列（id）を行順に取得。i 番目の要素の 0-based シート行は i+1（ヘッダが index 0）。
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: "tasks!A2:A" });
  const vals = (res.data.values ?? []).map((r) => String(r?.[0] ?? "").trim());
  const srcI = vals.findIndex((a) => a !== "" && a === id.trim());
  if (srcI === -1) return { ok: false, error: `タスク id=${id} が見つかりません。` };

  let refI = -1;
  if (target.position === "before" || target.position === "after") {
    if (target.refId === id) return { ok: false, error: "同じタスクを基準には指定できません。" };
    refI = vals.findIndex((a) => a !== "" && a === target.refId.trim());
    if (refI === -1) {
      return { ok: false, error: `基準のタスク id=${target.refId} が見つかりません。` };
    }
  }

  // source を除いた配列での挿入位置 k を決める。
  const removal = vals.filter((_, i) => i !== srcI);
  const idxInRemoval = (origIdx: number): number => (origIdx < srcI ? origIdx : origIdx - 1);
  let k: number;
  if (target.position === "top") k = 0;
  else if (target.position === "bottom") k = removal.length;
  else if (target.position === "before") k = idxInRemoval(refI);
  else k = idxInRemoval(refI) + 1; // after

  // 最終的な並び（表示確認用）。変化が無ければ書き込まない。
  const finalArr = [...removal];
  finalArr.splice(k, 0, vals[srcI]);
  const order = finalArr.filter((a) => a !== "");
  if (finalArr.every((v, i) => v === vals[i])) return { ok: true, order };

  // moveDimension の destinationIndex は「source 除去前の座標」基準。
  const sheetSrc = srcI + 1; // 0-based シート行
  const targetSheetIdx = k + 1;
  const dst = targetSheetIdx <= sheetSrc ? targetSheetIdx : targetSheetIdx + 1;

  const gid = await sheetGid(sheets, sid, "tasks");
  if (gid === null) return { ok: false, error: "tasks タブが見つかりません。" };
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: {
      requests: [
        {
          moveDimension: {
            source: {
              sheetId: gid,
              dimension: "ROWS",
              startIndex: sheetSrc,
              endIndex: sheetSrc + 1,
            },
            destinationIndex: dst,
          },
        },
      ],
    },
  });
  return { ok: true, order };
}

// ── reports（活動報告・5W1H） ────────────────────────────────────────────────

export type ReportInput = {
  date: string; // いつ（作業日 YYYY-MM-DD）
  who: string; // 誰が
  taskId?: string; // どのタスクで（tasks の id・任意）
  taskName?: string; // タスク名（スナップショット・任意）
  where?: string; // どこで
  what: string; // どんな作業を
  how?: string; // どうやって
  why?: string; // なぜ（任意）
  source?: string; // 出典（メール件名・差出人等）
};

/** 登録日時（JST・YYYY-MM-DD HH:MM）。 */
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

/**
 * 活動報告（5W1H）を reports タブへまとめて追記する。
 * 全件を事前検証し、1件でも不正なら何も書き込まない（all-or-nothing）。
 * A:J = date, who, task_id, task_name, where, what, how, why, source, created_at
 */
export async function addReports(
  reports: ReportInput[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!reports.length) return { ok: false, error: "登録する報告がありません。" };
  if (reports.length > 50) return { ok: false, error: "一度に登録できるのは50件までです。" };

  const created = nowJST();
  const values: string[][] = [];
  for (const [i, r] of reports.entries()) {
    const date = (r.date ?? "").trim();
    const who = (r.who ?? "").trim();
    const what = (r.what ?? "").trim();
    if (!isValidDate(date)) {
      return { ok: false, error: `${i + 1}件目: 作業日は YYYY-MM-DD 形式で指定してください。` };
    }
    if (!who) return { ok: false, error: `${i + 1}件目: 「誰が」を指定してください。` };
    if (!what) return { ok: false, error: `${i + 1}件目: 「どんな作業を」を指定してください。` };
    values.push([
      date,
      safeText(who),
      safeText((r.taskId ?? "").trim()),
      safeText((r.taskName ?? "").trim()),
      safeText((r.where ?? "").trim()),
      safeText(what),
      safeText((r.how ?? "").trim()),
      safeText((r.why ?? "").trim()),
      safeText((r.source ?? "").trim()),
      created,
    ]);
  }

  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  try {
    await rw().spreadsheets.values.append({
      spreadsheetId: sid,
      range: "reports!A2:J",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return { ok: true, count: values.length };
  } catch {
    return {
      ok: false,
      error:
        "reports タブに書き込めません。Sheet に reports タブ（A:date / B:who / C:task_id / D:task_name / E:where / F:what / G:how / H:why / I:source / J:created_at）を作成し、サービスアカウントを編集者にしてください。",
    };
  }
}

// ── meta ─────────────────────────────────────────────────────────────────────

// 編集可能な meta キーの唯一の定義。route.ts のツールスキーマもこれを参照する。
// 基準日（basis_date）は「アクセス日」を採用し参照しない／次回ミーティングは events 由来のため、
// いずれも編集対象から外している（UI に出ない値を書けてしまう不整合を防ぐ）。
export const META_KEYS = ["project_name", "org"] as const;

export async function updateMeta(
  key: string,
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(META_KEYS as readonly string[]).includes(key)) {
    return {
      ok: false,
      error: `meta の「${key}」は編集対象外です（可: ${META_KEYS.join(" / ")}）。`,
    };
  }
  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();
  const { rowNum } = await findRow(sheets, sid, "meta!A2:A", (a) => a.trim() === key);

  if (rowNum === null) {
    // 未定義キーは末尾に追記（key,value）。
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: "meta!A2:B",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[key, safeText(value.trim())]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `meta!B${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[safeText(value.trim())]] },
    });
  }
  return { ok: true };
}

// ── links ────────────────────────────────────────────────────────────────────

/** 既存ラベルの URL を更新する（新規ラベルの追加は構造変更寄りなので別途）。 */
export async function updateLink(
  label: string,
  url: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await activeSid();
  if (!s.ok) return s;
  const { sid } = s;
  const sheets = rw();
  const { rows, rowNum } = await findRow(
    sheets,
    sid,
    "links!A2:B",
    (a) => a.trim() === label.trim(),
  );
  if (rowNum === null) {
    const labels = rows.map((r) => String(r?.[0]).trim()).filter(Boolean);
    return {
      ok: false,
      error: `資料リンク「${label}」が見つかりません（既存: ${labels.join(" / ") || "なし"}）。`,
    };
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `links!B${rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[safeText(url.trim())]] },
  });
  return { ok: true };
}
