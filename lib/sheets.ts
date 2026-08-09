import type {
  ActivityReport,
  BudgetItem,
  CalendarEvent,
  DashboardData,
  Material,
  Notice,
  Task,
} from "@/lib/types";
import { SEED_DATA } from "@/lib/seed";
import { activeSheetId, hasSheetsCreds, sheetsClient } from "@/lib/google-sheets";
import { listFolderFiles } from "@/lib/drive";

function toNum(v: unknown): number {
  const n = Number(String(v ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** 金額セル（"1,200,000" / "¥1200000" 等）を数値（円）に。不正は 0。 */
function toAmount(v: unknown): number {
  const n = Number(
    String(v ?? "")
      .replace(/[¥￥,\s]/g, "")
      .replace(/円$/, ""),
  );
  return Number.isFinite(n) ? n : 0;
}

/** アクセス日（日本時間の「今日」, YYYY-MM-DD）。基準日の既定値に使う。
 *  Vercel は UTC 実行のため、タイムゾーンを明示して日本の日付に揃える。 */
function todayKeyJST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Google Sheets（データ層）から DashboardData を読み取る（閲覧専用・決定A1）。
 * 環境変数（サービスアカウント＋SHEET_ID）が無い場合は SEED をそのまま返し、
 * ローカル開発や未設定デプロイでも UI を確認できるようにする。
 */
export async function getDashboardData(): Promise<DashboardData> {
  // activeSheetId() はマルチテナント時に Cookie を参照する。先に呼ぶことで、
  // 認証情報の有無に関わらずページが動的描画（テナント別）に切り替わるようにする。
  const spreadsheetId = await activeSheetId();
  // 認証情報なし／対象シート未解決（未ログイン等）は SEED（実害なく描画）。
  if (!hasSheetsCreds() || !spreadsheetId) return SEED_DATA;

  const sheets = sheetsClient("read");
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["tasks!A2:I", "meta!A2:B", "links!A2:B"],
  });

  const [taskRange, metaRange, linkRange] = data.valueRanges ?? [];

  // A:I = id, phase(大項目), activity(中項目), kind, name, owner, start, end, progress
  const tasks: Task[] = (taskRange?.values ?? [])
    .filter((r) => r && r[0] !== undefined && String(r[0]).trim() !== "")
    .map((r) => {
      const kind = (
        String(r[3] ?? "task").trim() === "milestone" ? "milestone" : "task"
      ) as Task["kind"];
      return {
        id: String(r[0]).trim(),
        phase: String(r[1] ?? "").trim(),
        activity: String(r[2] ?? "").trim(),
        kind,
        name: String(r[4] ?? "").trim(),
        owner: String(r[5] ?? "").trim(),
        start: String(r[6] ?? "").trim(),
        end: String(r[7] ?? "").trim(),
        progress: kind === "milestone" ? 0 : clamp01(toNum(r[8])),
      };
    });

  const meta = new Map<string, string>();
  (metaRange?.values ?? []).forEach((r) => {
    if (r && r[0]) meta.set(String(r[0]).trim(), String(r[1] ?? "").trim());
  });

  const links = (linkRange?.values ?? [])
    .filter((r) => r && r[0])
    .map((r) => ({ label: String(r[0]).trim(), url: String(r[1] ?? "").trim() }));

  // notices タブ（大切な連絡事項の箇条書き）は任意。未作成でも本体が壊れないよう別取得＋try/catch。
  let notices: Notice[] = [];
  try {
    const nr = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "notices!A2:B",
    });
    notices = (nr.data.values ?? [])
      .filter((r) => r && String(r[0] ?? "").trim() !== "")
      .map((r) => ({
        text: String(r[0]).trim(),
        date: String(r[1] ?? "").trim() || undefined,
      }));
  } catch {
    notices = [];
  }

  // events タブ（カレンダー予定）は任意。未作成でも本体が壊れないよう別取得＋try/catch。
  let events: CalendarEvent[] = [];
  try {
    const er = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "events!A2:H",
    });
    // A:H = startdate, starttime, enddate, endtime, title, place, url, note
    events = (er.data.values ?? [])
      .map((r, i) => ({
        startDate: String(r?.[0] ?? "").trim(),
        startTime: String(r?.[1] ?? "").trim() || undefined,
        endDate: String(r?.[2] ?? "").trim() || undefined,
        endTime: String(r?.[3] ?? "").trim() || undefined,
        title: String(r?.[4] ?? "").trim(),
        place: String(r?.[5] ?? "").trim() || undefined,
        url: String(r?.[6] ?? "").trim() || undefined,
        note: String(r?.[7] ?? "").trim() || undefined,
        row: i + 2, // events タブの実行番号（A2 起点）
      }))
      .filter((e) => e.startDate !== "" && e.title !== "");
  } catch {
    events = [];
  }

  // reports タブ（活動報告・5W1H）は任意。未作成でも本体が壊れないよう別取得＋try/catch。
  let reports: ActivityReport[] = [];
  try {
    const rr = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "reports!A2:J",
    });
    // A:J = date, who, task_id, task_name, where, what, how, why, source, created_at
    reports = (rr.data.values ?? [])
      .map((r) => {
        return {
          date: String(r?.[0] ?? "").trim(),
          who: String(r?.[1] ?? "").trim(),
          taskId: String(r?.[2] ?? "").trim() || undefined,
          taskName: String(r?.[3] ?? "").trim() || undefined,
          where: String(r?.[4] ?? "").trim() || undefined,
          what: String(r?.[5] ?? "").trim(),
          how: String(r?.[6] ?? "").trim() || undefined,
          why: String(r?.[7] ?? "").trim() || undefined,
          source: String(r?.[8] ?? "").trim() || undefined,
          createdAt: String(r?.[9] ?? "").trim() || undefined,
        };
      })
      .filter((r) => r.date !== "" && r.what !== "");
  } catch {
    reports = [];
  }

  // budget タブ（予実・金額）は任意。未作成でも本体が壊れないよう別取得＋try/catch。
  let budget: BudgetItem[] = [];
  try {
    const br = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "budget!A2:D",
    });
    // A:D = task_id, budget, actual, note（項目名・分類は tasks から引く）
    budget = (br.data.values ?? [])
      .map((r) => ({
        taskId: String(r?.[0] ?? "").trim(),
        budget: toAmount(r?.[1]),
        actual: toAmount(r?.[2]),
        note: String(r?.[3] ?? "").trim() || undefined,
      }))
      .filter((b) => b.taskId !== "");
  } catch {
    budget = [];
  }

  // 資料（meta.drive_folder_id のフォルダ）。Drive API 未有効化や未共有でも本体は壊さない。
  let materials: Material[] = [];
  const driveFolderId = meta.get("drive_folder_id");
  if (driveFolderId) {
    try {
      materials = await listFolderFiles(driveFolderId);
    } catch {
      materials = [];
    }
  }

  return {
    projectName: meta.get("project_name") ?? "",
    org: meta.get("org") ?? "",
    // 基準日はアクセス日（今日・JST）を既定にする。固定の基準日はシートで管理せず、
    // その場限りの変更は画面の日付ピッカーで行う（meta.basis_date は参照しない）。
    basisDate: todayKeyJST(),
    tasks,
    links,
    notices,
    events,
    materials,
    reports,
    budget,
    source: "sheets",
  };
}

/** 資料プロキシ用に meta.drive_folder_id を取得（route から軽量に参照する）。 */
export async function getDriveFolderId(): Promise<string | null> {
  if (!hasSheetsCreds()) return null;
  const spreadsheetId = await activeSheetId();
  if (!spreadsheetId) return null;
  try {
    const sheets = sheetsClient("read");
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "meta!A2:B",
    });
    const row = (r.data.values ?? []).find((x) => String(x?.[0]).trim() === "drive_folder_id");
    return row ? String(row[1] ?? "").trim() || null : null;
  } catch {
    return null;
  }
}
