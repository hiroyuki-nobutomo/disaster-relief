import { PAL } from "@/lib/palette";

export const WD = ["月", "火", "水", "木", "金", "土", "日"];
// 月曜始まりのため、日曜(0)始まりの getDay() を 月=0..日=6 に変換。
export const monIdx = (dt: Date) => (dt.getDay() + 6) % 7;
export const addDays = (dt: Date, n: number) =>
  new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

// 週表示の時間グリッド（8:00〜20:00・30分刻み・ラベルは 9/12/15/18 のみ）。
export const START_H = 8;
export const END_H = 20;
export const SLOT_H = 16; // 30分あたりの高さ(px)
export const GRID_H = (END_H - START_H) * 2 * SLOT_H;
export const HOUR_LABELS = [9, 12, 15, 18];

// 横断バー（複数日対応）のレイアウト定数。
export const LANE_H = 18; // 1レーンの高さ（バー＋すき間）
export const BAR_H = 15;
export const DAYNUM_H = 24; // 月セルの日付番号ぶんの高さ
export const MONTH_MIN_CELL_H = 96; // 月セルの最小高さ（予定が少ない日も自然な高さを保つ）

export type Ref =
  | {
      kind: "event";
      row: number;
      startDate: string;
      startTime?: string;
      endDate?: string;
      endTime?: string;
      title: string;
      place?: string;
      url?: string;
      note?: string;
    }
  | { kind: "milestone"; id: string; date: string; name: string };
export type View = "month" | "week";
export type EditState = { mode: "add"; date: string } | { mode: "edit"; ref: Ref };

// カレンダーに描く帯（単日・複数日とも startKey〜endKey で表す）。
export type Span = {
  type: "milestone" | "meeting" | "event";
  label: string;
  startKey: string;
  endKey: string;
  ref?: Ref;
  timed: boolean; // 同一日で時刻あり＝週グリッドに時間ブロック表示
  start?: string;
  end?: string;
};

export const CHIP: Record<Span["type"], { bg: string; fg: string }> = {
  milestone: { bg: "#F7ECD9", fg: "#8A5A22" },
  meeting: { bg: PAL.pale, fg: PAL.brand },
  event: { bg: "#E7F1EA", fg: "#2F7A4F" },
};

/** その週(7日)に重なる帯にレーン番号を割り当て、列範囲(cs..ce)を返す。 */
export function layoutWeek(weekKeys: string[], spans: Span[]) {
  const d0 = weekKeys[0];
  const d6 = weekKeys[6];
  const inWk = spans
    .filter((s) => s.endKey >= d0 && s.startKey <= d6)
    .sort((a, b) =>
      a.startKey !== b.startKey ? (a.startKey < b.startKey ? -1 : 1) : a.endKey < b.endKey ? 1 : -1,
    );
  const laneLast: number[] = []; // 各レーンが使用済みの最終列index
  const out: { s: Span; cs: number; ce: number; lane: number }[] = [];
  for (const s of inWk) {
    let cs = weekKeys.findIndex((k) => k >= s.startKey);
    if (cs < 0) cs = 0;
    let ce = 6;
    for (let i = 6; i >= 0; i--) {
      if (weekKeys[i] <= s.endKey) {
        ce = i;
        break;
      }
    }
    if (ce < cs) ce = cs;
    let lane = 0;
    while (lane < laneLast.length && laneLast[lane] >= cs) lane++;
    laneLast[lane] = ce;
    out.push({ s, cs, ce, lane });
  }
  return { out, lanes: laneLast.length };
}
