import type { Task, Status, CalendarEvent } from "@/lib/types";

export const DAY = 86400000;
export const d = (s: string) => new Date(s + "T00:00:00");

// 共有の日付・時刻ユーティリティ（カレンダー／書き込み検証で共用）。
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const keyOfDate = (dt: Date) =>
  `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
export const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
/** HH:MM 形式か。 */
export const isTime = (s?: string) => !!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
/** 基準日のフォールバック値（通常はサーバ算出の今日を使い、空のときだけこれ＝seed基準）。 */
export const DEFAULT_BASIS = "2026-06-22";
/** プロジェクト期間レンジの表示文字列（"2026/06/01 〜 2026/06/30"）。 */
export const formatRange = (range: { start: string; end: string } | null) =>
  range ? `${range.start.replace(/-/g, "/")} 〜 ${range.end.replace(/-/g, "/")}` : "";

/**
 * カレンダー予定（events）のうち、fromKey（YYYY-MM-DD）以降で最も早い予定を返す。
 * fromKey 省略時は「今日」を起点にする（基準日のシミュレーション値ではなく実日付）。
 * 同日内は開始時刻順。該当が無ければ null。右上「次回ミーティング」表示に使う。
 */
export function nextMeetingEvent(
  events: CalendarEvent[],
  fromKey: string = keyOfDate(new Date()),
): CalendarEvent | null {
  const upcoming = events
    .filter((e) => e.startDate && e.startDate >= fromKey)
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
  return upcoming[0] ?? null;
}

/** 予定の日付を短縮表示（"26/06/17"＝YY/MM/DD）。右上「次回ミーティング」の一行表示用。 */
export function formatEventDateShort(e: CalendarEvent): string {
  const dt = d(e.startDate);
  return `${pad2(dt.getFullYear() % 100)}/${pad2(dt.getMonth() + 1)}/${pad2(dt.getDate())}`;
}

// ── 派生ロジック（HANDOFF §4 と完全一致させること）────────────────────────
export function statusOf(t: Task, basis: string): Status {
  const b = d(basis);
  if (t.kind === "milestone") return b > d(t.end) ? "遅延" : "予定";
  if (t.progress >= 1) return "完了";
  if (t.progress === 0 && b < d(t.start)) return "未着手";
  if (b > d(t.end)) return "遅延";
  return "進行中";
}

export const taskRows = (tasks: Task[]) => tasks.filter((t) => t.kind === "task");

export const overallProgress = (tasks: Task[]) => {
  const r = taskRows(tasks);
  return r.length ? r.reduce((a, t) => a + t.progress, 0) / r.length : 0;
};

export const phaseProgress = (tasks: Task[], phase: string) => {
  const r = tasks.filter((t) => t.phase === phase && t.kind === "task");
  return r.length ? r.reduce((a, t) => a + t.progress, 0) / r.length : 0;
};

export function statusCounts(tasks: Task[], basis: string) {
  const c = { 完了: 0, 進行中: 0, 未着手: 0, 遅延: 0 } as Record<Status, number>;
  taskRows(tasks).forEach((t) => {
    c[statusOf(t, basis)]++;
  });
  return c;
}

// ── 表示用の補助（プレビューと同じ）──────────────────────────────────────
export const fmt = (s: string) => {
  const x = d(s);
  return `${x.getMonth() + 1}/${x.getDate()}`;
};

/** タスクデータから登場順にフェーズ名を抽出（フレームワークは特定プロジェクトに依存しない）。 */
export const phasesOf = (tasks: Task[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tasks) {
    if (t.phase && !seen.has(t.phase)) {
      seen.add(t.phase);
      out.push(t.phase);
    }
  }
  return out;
};

/** フェーズの期間（そのフェーズの最小開始〜最大終了）をデータから算出。 */
export const phasePeriod = (tasks: Task[], phase: string): string => {
  const rows = tasks.filter((t) => t.phase === phase);
  if (!rows.length) return "";
  const a = new Date(Math.min(...rows.map((t) => +d(t.start))));
  const b = new Date(Math.max(...rows.map((t) => +d(t.end))));
  return `${a.getMonth() + 1}/${a.getDate()}〜${b.getMonth() + 1}/${b.getDate()}`;
};

/** プロジェクト全体の期間（全タスクの最小開始〜最大終了）。ガント範囲・ヘッダ表示に使用。 */
export const projectRange = (tasks: Task[]): { start: string; end: string } | null => {
  if (!tasks.length) return null;
  const a = new Date(Math.min(...tasks.map((t) => +d(t.start))));
  const b = new Date(Math.max(...tasks.map((t) => +d(t.end))));
  return { start: keyOfDate(a), end: keyOfDate(b) };
};
