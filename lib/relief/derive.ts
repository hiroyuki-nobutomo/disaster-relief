import type { Booking, ReliefData, ScheduleItem, Shelter } from "@/lib/relief/types";

// 表示用の純関数ヘルパー（クライアント・サーバー両方から使用可）。

const WEEK = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 今日（JST・YYYY-MM-DD）。Vercel は UTC 実行のためタイムゾーンを明示する。 */
export function todayKeyJST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "2026-08-18" → "8/18（火）"。不正な日付はそのまま返す。 */
export function fmtDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return ymd;
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
}

/** "2026-08-18 11:30" → { date, time } に分解。 */
export function splitDateTime(dt: string): { date: string; time?: string } {
  const [date, time] = dt.trim().split(/\s+/);
  return { date: date ?? "", time };
}

export function memberName(data: ReliefData, id?: string): string {
  if (!id) return "";
  return data.members.find((m) => m.id === id)?.name ?? id;
}

export function groupName(data: ReliefData, id?: string): string {
  if (!id) return "";
  return data.groups.find((g) => g.id === id)?.name ?? id;
}

export function shelterName(data: ReliefData, id?: string): string {
  if (!id) return "";
  return data.shelters.find((s) => s.id === id)?.name ?? id;
}

/** 避難所の地図リンク。mapUrl 優先、無ければ名称＋住所の Google マップ検索。 */
export function shelterMapUrl(sh: Shelter): string {
  if (sh.mapUrl) return sh.mapUrl;
  const q = encodeURIComponent([sh.name, sh.address].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** 指定メンバーに関係するスケジュール（全体＋所属グループ＋本人）。 */
export function scheduleForMember(data: ReliefData, memberId: string): ScheduleItem[] {
  const gid = data.members.find((m) => m.id === memberId)?.groupId;
  return data.schedule.filter(
    (e) =>
      e.scope === "全体" ||
      (e.scope === "グループ" && e.targetId === gid) ||
      (e.scope === "個人" && e.targetId === memberId),
  );
}

/** 指定メンバーの予約（キャンセル除く）。 */
export function bookingsForMember(data: ReliefData, memberId: string): Booking[] {
  return data.bookings.filter((b) => b.memberId === memberId && b.status !== "キャンセル");
}

/** 日付昇順（同日中は開始時刻順・時刻なしは先頭）。 */
function sortSchedule(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) =>
    a.date === b.date ? (a.start ?? "").localeCompare(b.start ?? "") : a.date.localeCompare(b.date),
  );
}

/** 日付ごとにグルーピング（キーは YYYY-MM-DD・昇順）。 */
export function groupByDate(items: ScheduleItem[]): [string, ScheduleItem[]][] {
  const map = new Map<string, ScheduleItem[]>();
  for (const e of sortSchedule(items)) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return [...map.entries()];
}
